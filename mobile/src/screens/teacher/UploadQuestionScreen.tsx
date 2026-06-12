import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  Chips,
  EmptyState,
  ExamPicker,
  Input,
  Screen,
  SectionTitle,
} from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../lib/alert';
import { extractQuestions } from '../../lib/api';
import { pickPdf } from '../../lib/pdf';
import { supabase } from '../../lib/supabase';
import { radius, spacing, ThemeColors } from '../../lib/theme';
import { ExtractedQuestion, QuestionType } from '../../lib/types';
import { useScheduledExams } from '../../lib/useExams';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const TYPES: { key: QuestionType; label: string }[] = [
  { key: 'mcq', label: 'MCQ' },
  { key: 'theoretical', label: 'Theory' },
];
// Seed suggestions; the live list is merged with subjects already in the bank.
const SEED_SUBJECTS = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'General Studies'];

export default function UploadQuestionScreen() {
  const { profile } = useAuth();
  const { exams } = useScheduledExams();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<'manual' | 'pdf'>('manual');
  const [examId, setExamId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>(SEED_SUBJECTS);

  // Manual form
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [marks, setMarks] = useState('1');
  const [body, setBody] = useState('');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correct, setCorrect] = useState<string>('A');
  const [busy, setBusy] = useState(false);

  // PDF import
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [engine, setEngine] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedQuestion[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);

  // Dynamically grow the subject quick-picks from existing questions.
  const loadSubjects = useCallback(async () => {
    const { data } = await supabase.from('questions').select('subject').limit(500);
    const fromDb = (data as { subject: string }[] | null)?.map((r) => r.subject) ?? [];
    setSubjectSuggestions(Array.from(new Set([...SEED_SUBJECTS, ...fromDb])).sort());
  }, []);

  useEffect(() => {
    void loadSubjects();
  }, [loadSubjects]);

  const setOption = (index: number, text: string) =>
    setOptions((prev) => prev.map((o, i) => (i === index ? text : o)));

  const resetManual = () => {
    setTopic('');
    setBody('');
    setOptions(['', '', '', '']);
    setCorrect('A');
    setMarks(qType === 'mcq' ? '1' : '5');
  };

  const examName = exams.find((e) => e.id === examId)?.name ?? 'the exam';

  const submitManual = async () => {
    if (!profile) return;
    if (!examId) {
      showAlert('Pick an exam', 'Questions must belong to an exam scheduled by the Admin.');
      return;
    }
    if (!subject.trim()) {
      showAlert('Pick a subject', 'Enter or choose a subject for this question.');
      return;
    }
    if (body.trim().length < 10) {
      showAlert('Incomplete', 'Write the full question text (at least 10 characters).');
      return;
    }
    if (qType === 'mcq' && options.some((o) => !o.trim())) {
      showAlert('Incomplete', 'Fill in all four options for an MCQ.');
      return;
    }
    const marksNum = Math.max(1, parseInt(marks, 10) || 1);

    setBusy(true);
    const { error } = await supabase.from('questions').insert({
      teacher_id: profile.id,
      exam_id: examId,
      subject: subject.trim(),
      topic: topic.trim() || null,
      difficulty,
      question_type: qType,
      marks: marksNum,
      source: 'manual',
      body: body.trim(),
      options: qType === 'mcq' ? options.map((o) => o.trim()) : [],
      correct_index:
        qType === 'mcq' ? OPTION_LABELS.indexOf(correct as (typeof OPTION_LABELS)[number]) : null,
      status: 'submitted',
    });
    setBusy(false);

    if (error) {
      showAlert('Upload failed', error.message);
      return;
    }
    showAlert('Question secured 🔐', `Added to the bank for "${examName}".`);
    resetManual();
    void loadSubjects();
  };

  const onPickPdf = async () => {
    try {
      const file = await pickPdf();
      if (!file) return;
      setPdfName(file.name);
      setExtracted([]);
      setPicked({});
      setExtracting(true);
      const res = await extractQuestions(file.base64, file.name);
      setEngine(res.engine);
      setExtracted(res.questions);
      // Pre-select everything that parsed.
      const all: Record<number, boolean> = {};
      res.questions.forEach((_, i) => (all[i] = true));
      setPicked(all);
      if (res.questions.length === 0) {
        showAlert('No questions found', 'The parser could not detect questions in that PDF.');
      }
    } catch (e) {
      showAlert('Extraction failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setExtracting(false);
    }
  };

  const selectedCount = Object.values(picked).filter(Boolean).length;

  const importSelected = async () => {
    if (!profile) return;
    if (!examId) {
      showAlert('Pick an exam', 'Choose the exam these questions belong to.');
      return;
    }
    if (!subject.trim()) {
      showAlert('Pick a subject', 'Choose a default subject for questions the PDF did not label.');
      return;
    }
    const rows = extracted
      .filter((_, i) => picked[i])
      .map((q) => ({
        teacher_id: profile.id,
        exam_id: examId,
        subject: (q.subject || subject).trim(),
        topic: q.topic?.trim() || null,
        difficulty: q.difficulty || 'medium',
        question_type: q.question_type,
        marks: q.marks || (q.question_type === 'mcq' ? 1 : 5),
        source: 'pdf' as const,
        body: q.body.trim(),
        options: q.question_type === 'mcq' ? q.options : [],
        correct_index: q.question_type === 'mcq' ? (q.correct_index ?? 0) : null,
        status: 'submitted' as const,
      }));

    if (rows.length === 0) {
      showAlert('Nothing selected', 'Select at least one question to import.');
      return;
    }

    setImporting(true);
    const { error } = await supabase.from('questions').insert(rows);
    setImporting(false);
    if (error) {
      showAlert('Import failed', error.message);
      return;
    }
    showAlert('Imported 🔐', `${rows.length} question(s) added to the bank for "${examName}".`);
    setExtracted([]);
    setPicked({});
    setPdfName(null);
    void loadSubjects();
  };

  // Questions can only target an exam the Admin has scheduled.
  if (exams.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="calendar-clear-outline"
          title="No exams scheduled yet"
          subtitle="Questions can only be submitted for an exam scheduled by the Admin. This screen unlocks automatically the moment one is scheduled."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.modeRow}>
        <Chips
          options={['Type one', 'Import PDF']}
          value={mode === 'manual' ? 'Type one' : 'Import PDF'}
          onChange={(v) => setMode(v === 'Type one' ? 'manual' : 'pdf')}
        />
      </View>

      <SectionTitle title="Exam" />
      <ExamPicker exams={exams} value={examId} onChange={setExamId} />
      {!examId ? <Text style={styles.hint}>Select the exam these questions are for.</Text> : null}

      <SectionTitle title="Subject" />
      <Card>
        <Input
          label="Subject"
          placeholder="e.g. Physics (type any subject)"
          value={subject}
          onChangeText={setSubject}
        />
        <Chips options={subjectSuggestions} value={subject} onChange={setSubject} />
      </Card>

      {mode === 'manual' ? (
        <>
          <SectionTitle title="Question type" />
          <Chips
            options={TYPES.map((t) => t.label)}
            value={TYPES.find((t) => t.key === qType)!.label}
            onChange={(label) => {
              const next = TYPES.find((t) => t.label === label)!.key;
              setQType(next);
              setMarks(next === 'mcq' ? '1' : '5');
            }}
          />

          <SectionTitle title="Difficulty & marks" />
          <Chips options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />

          <SectionTitle title="Question" />
          <Card>
            <Input label="Topic (optional)" placeholder="e.g. Thermodynamics" value={topic} onChangeText={setTopic} />
            <Input
              label="Marks"
              placeholder="1"
              keyboardType="number-pad"
              value={marks}
              onChangeText={setMarks}
            />
            <Input
              label="Question text"
              placeholder="Type the full question…"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              style={styles.multiline}
            />
            {qType === 'mcq' ? (
              <>
                {OPTION_LABELS.map((label, index) => (
                  <Input
                    key={label}
                    label={`Option ${label}`}
                    placeholder={`Answer choice ${label}`}
                    value={options[index]}
                    onChangeText={(text) => setOption(index, text)}
                  />
                ))}
                <Text style={styles.correctLabel}>Correct option</Text>
                <Chips options={OPTION_LABELS} value={correct} onChange={setCorrect} />
              </>
            ) : (
              <Text style={styles.theoryNote}>
                Theory question — no options needed. Model answers are graded offline.
              </Text>
            )}
          </Card>

          <Button title="Submit to Secure Bank" icon="lock-closed-outline" onPress={() => void submitManual()} loading={busy} />
        </>
      ) : (
        <>
          <SectionTitle title="Import from PDF (NLP)" />
          <Card>
            <Text style={styles.pdfBlurb}>
              Upload a PDF of questions (MCQ and/or theory). The AI service extracts and structures
              them for review — nothing is saved until you confirm.
            </Text>
            <Button
              title={pdfName ? `Re-pick PDF (${pdfName})` : 'Choose PDF file'}
              variant="ghost"
              icon="document-attach-outline"
              onPress={() => void onPickPdf()}
              loading={extracting}
            />
            {engine ? (
              <Text style={styles.engineNote}>
                Parsed by: {engine === 'claude' ? 'Claude NLP' : engine === 'offline-fallback' ? 'offline parser (LLM unavailable)' : 'offline parser'}
              </Text>
            ) : null}
          </Card>

          {extracted.length > 0 ? (
            <>
              <SectionTitle title={`Review (${selectedCount}/${extracted.length} selected)`} />
              {extracted.map((q, i) => {
                const isSel = !!picked[i];
                return (
                  <Pressable key={i} onPress={() => setPicked((p) => ({ ...p, [i]: !p[i] }))}>
                    <Card style={isSel ? styles.cardSelected : undefined}>
                      <View style={styles.reviewRow}>
                        <Ionicons
                          name={isSel ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSel ? colors.primary : colors.textDim}
                        />
                        <View style={{ flex: 1 }}>
                          <View style={styles.reviewTags}>
                            <View style={styles.typePill}>
                              <Text style={styles.typePillText}>
                                {q.question_type === 'mcq' ? 'MCQ' : 'THEORY'}
                              </Text>
                            </View>
                            <Text style={styles.reviewMeta}>
                              {q.subject || subject || 'subject?'} · {q.marks} mk
                            </Text>
                          </View>
                          <Text style={styles.reviewBody}>{q.body}</Text>
                          {q.question_type === 'mcq'
                            ? q.options.map((o, oi) => (
                                <Text
                                  key={oi}
                                  style={[
                                    styles.reviewOption,
                                    oi === q.correct_index && styles.reviewCorrect,
                                  ]}
                                >
                                  {String.fromCharCode(65 + oi)}. {o || '—'}
                                  {oi === q.correct_index ? '  ✓' : ''}
                                </Text>
                              ))
                            : null}
                        </View>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}

              <Button
                title={`Import ${selectedCount} question(s)`}
                icon="cloud-upload-outline"
                onPress={() => void importSelected()}
                loading={importing}
                style={{ marginTop: spacing.sm }}
              />
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modeRow: {
      marginBottom: spacing.sm,
    },
    hint: {
      color: colors.warning,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    multiline: {
      minHeight: 96,
      textAlignVertical: 'top',
    },
    correctLabel: {
      color: colors.textDim,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    theoryNote: {
      color: colors.textDim,
      fontSize: 13,
      fontStyle: 'italic',
      lineHeight: 18,
    },
    pdfBlurb: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: spacing.md,
    },
    engineNote: {
      color: colors.accent,
      fontSize: 12,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.lg,
    },
    reviewRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    reviewTags: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 6,
    },
    typePill: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    typePillText: {
      color: colors.textDim,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    reviewMeta: {
      color: colors.textDim,
      fontSize: 12,
    },
    reviewBody: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    reviewOption: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 20,
      marginTop: 2,
    },
    reviewCorrect: {
      color: colors.success,
      fontWeight: '600',
    },
  });
