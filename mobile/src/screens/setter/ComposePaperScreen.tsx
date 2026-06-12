import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Card,
  CeremonyModal,
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
import { sealPaper } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { labelFor, radius, spacing, ThemeColors } from '../../lib/theme';
import { Question } from '../../lib/types';
import { useScheduledExams } from '../../lib/useExams';

export default function ComposePaperScreen() {
  const { profile } = useAuth();
  const setterId = profile?.id;
  const { exams } = useScheduledExams();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [examId, setExamId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState<string>('All subjects');
  const [pool, setPool] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [sealModal, setSealModal] = useState(false);
  const [pendingPaperId, setPendingPaperId] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .in('status', ['submitted', 'approved'])
      .order('created_at', { ascending: false });
    setPool((data as Question[] | null) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  // Subjects available for the chosen exam — derived from the pool, not hardcoded.
  const subjectOptions = useMemo(() => {
    const scoped = pool.filter((q) => q.exam_id === examId);
    return ['All subjects', ...Array.from(new Set(scoped.map((q) => q.subject))).sort()];
  }, [pool, examId]);

  const visiblePool = pool.filter(
    (q) => q.exam_id === examId && (subject === 'All subjects' || q.subject === subject)
  );

  const totalMarks = visiblePool
    .filter((q) => selected[q.id])
    .reduce((sum, q) => sum + (q.marks || 0), 0);

  const resetForm = () => {
    setTitle('');
    setSelected({});
    setPendingPaperId(null);
    void load();
  };

  /** Inserts the draft paper + its question list; returns the new paper id. */
  const createDraft = async (): Promise<string | null> => {
    if (!setterId) return null;
    if (!examId) {
      showAlert('Pick an exam', 'Every paper belongs to an exam scheduled by the Admin.');
      return null;
    }
    if (title.trim().length < 4) {
      showAlert('Missing title', 'Give the paper a title (e.g. "NEET 2026 — Physics Set A").');
      return null;
    }
    if (selectedIds.length === 0) {
      showAlert('No questions', 'Select at least one question from the pool below.');
      return null;
    }

    // The paper's subject column reflects the filter, or "Mixed" when drawing
    // from all subjects.
    const paperSubject = subject === 'All subjects' ? 'Mixed' : subject;

    const { data: paper, error } = await supabase
      .from('papers')
      .insert({
        title: title.trim(),
        subject: paperSubject,
        setter_id: setterId,
        exam_id: examId,
        status: 'draft',
        question_count: selectedIds.length,
      })
      .select('id')
      .single();
    if (error || !paper) {
      showAlert('Failed to create draft', error?.message ?? 'Unknown error');
      return null;
    }

    const paperId = (paper as { id: string }).id;
    const { error: linkError } = await supabase.from('paper_questions').insert(
      selectedIds.map((questionId, index) => ({
        paper_id: paperId,
        question_id: questionId,
        position: index,
      }))
    );
    if (linkError) {
      showAlert('Failed to attach questions', linkError.message);
      return null;
    }
    return paperId;
  };

  const saveDraft = async () => {
    setBusy(true);
    const paperId = await createDraft();
    setBusy(false);
    if (paperId) {
      showAlert('Draft saved', 'You can seal it any time from My Papers.');
      resetForm();
    }
  };

  const createAndSeal = async () => {
    setBusy(true);
    const paperId = await createDraft();
    setBusy(false);
    if (paperId) {
      setPendingPaperId(paperId);
      setSealModal(true);
    }
  };

  const handleSeal = async (values: Record<string, string>) => {
    const passphrase = values.passphrase ?? '';
    if (passphrase.length < 8) {
      showAlert('Weak passphrase', 'Use at least 8 characters. You will need it again at the print ceremony.');
      return;
    }
    if (!pendingPaperId) return;
    setSealing(true);
    try {
      await sealPaper(pendingPaperId, passphrase);
      setSealModal(false);
      showAlert(
        'Paper sealed 🔐',
        'Encrypted with AES-256. You hold key share 1 of 2. The Admin has been notified to co-sign — watch the status update live in My Papers.'
      );
      resetForm();
    } catch (e) {
      showAlert('Sealing failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSealing(false);
    }
  };

  if (exams.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="calendar-clear-outline"
          title="No exams scheduled yet"
          subtitle="Papers are composed for a specific exam. Ask the Admin to schedule one — this screen unlocks automatically."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <SectionTitle title="Exam" />
      <ExamPicker
        exams={exams}
        value={examId}
        onChange={(id) => {
          setExamId(id);
          setSelected({});
          setSubject('All subjects');
        }}
      />

      <SectionTitle title="Paper details" />
      <Card>
        <Input
          label="Paper title"
          placeholder='e.g. "NEET 2026 — Physics Set A"'
          value={title}
          onChangeText={setTitle}
        />
        <Text style={styles.fieldLabel}>Filter by subject</Text>
        <Chips
          options={subjectOptions}
          value={subject}
          onChange={(s) => {
            setSubject(s);
          }}
        />
      </Card>

      <SectionTitle
        title={`Select questions (${selectedIds.length} chosen · ${totalMarks} marks)`}
      />
      {!examId ? (
        <Card>
          <Text style={styles.emptyText}>
            Pick an exam above — only that exam's question bank can go into this paper.
          </Text>
        </Card>
      ) : visiblePool.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>
            No available questions for this exam/subject. Teachers' uploads appear here once
            submitted.
          </Text>
        </Card>
      ) : (
        visiblePool.map((q) => {
          const isSelected = !!selected[q.id];
          return (
            <Pressable key={q.id} onPress={() => toggle(q.id)}>
              <Card style={isSelected ? styles.cardSelected : undefined}>
                <View style={styles.qRow}>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={isSelected ? colors.primary : colors.textDim}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={styles.qTags}>
                      <View style={styles.typePill}>
                        <Text style={styles.typePillText}>{labelFor(q.question_type)}</Text>
                      </View>
                      <Text style={styles.qMeta}>
                        {q.subject} · {q.difficulty} · {q.marks} mk
                      </Text>
                    </View>
                    <Text style={styles.qBody} numberOfLines={3}>
                      {q.body}
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}

      <View style={styles.actions}>
        <Button title="Save as Draft" variant="ghost" icon="save-outline" onPress={() => void saveDraft()} disabled={busy} />
        <Button
          title={`Create & Seal (${selectedIds.length})`}
          icon="lock-closed-outline"
          onPress={() => void createAndSeal()}
          loading={busy}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      <CeremonyModal
        visible={sealModal}
        title="Sealing Ceremony — Key Share 1/2"
        subtitle="Your passphrase wraps the first half of the encryption key. Without it (plus the Admin's share), this paper can never be decrypted. Do not forget it."
        fields={[
          {
            key: 'passphrase',
            label: 'Setter passphrase (min 8 chars)',
            placeholder: 'Secret passphrase',
            secure: true,
          },
        ]}
        submitLabel="Seal Paper"
        busy={sealing}
        onSubmit={(values) => void handleSeal(values)}
        onClose={() => setSealModal(false)}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fieldLabel: {
      color: colors.textDim,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    emptyText: {
      color: colors.textDim,
      fontSize: 14,
      lineHeight: 20,
    },
    cardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.lg,
    },
    qRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'flex-start',
    },
    qTags: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: 4,
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
    qBody: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    qMeta: {
      color: colors.textDim,
      fontSize: 12,
    },
    actions: {
      marginTop: spacing.lg,
    },
  });
