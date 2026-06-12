import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, Chips, EmptyState, ExamPicker, Screen } from '../../components/UI';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../lib/alert';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { labelFor, spacing, ThemeColors } from '../../lib/theme';
import { Question } from '../../lib/types';
import { useScheduledExams } from '../../lib/useExams';

type PoolQuestion = Question & { teacher?: { full_name: string } | null };

const TYPE_FILTERS = ['All types', 'MCQ', 'Theory'] as const;

export default function QuestionPoolScreen() {
  const { exams } = useScheduledExams();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [questions, setQuestions] = useState<PoolQuestion[]>([]);
  const [examId, setExamId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState<string>('All types');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('questions')
      .select('*, teacher:profiles(full_name), exam:exams(name)')
      .order('created_at', { ascending: false });
    setQuestions((data as PoolQuestion[] | null) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Realtime: new teacher uploads land in the pool instantly.
  useEffect(() => {
    const channel = supabase
      .channel('questions-pool')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'questions' },
        () => void load()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const approve = async (question: PoolQuestion) => {
    const { error } = await supabase
      .from('questions')
      .update({ status: 'approved' })
      .eq('id', question.id);
    if (error) {
      showAlert('Failed', error.message);
      return;
    }
    setQuestions((prev) =>
      prev.map((q) => (q.id === question.id ? { ...q, status: 'approved' } : q))
    );
  };

  // Subjects are derived dynamically from whatever questions exist —
  // no hardcoded subject list.
  const subjectFilters = useMemo(() => {
    const scoped = examId ? questions.filter((q) => q.exam_id === examId) : questions;
    const subjects = Array.from(new Set(scoped.map((q) => q.subject))).sort();
    return ['All', ...subjects];
  }, [questions, examId]);

  const visible = questions
    .filter((q) => (examId ? q.exam_id === examId : true))
    .filter((q) => (subjectFilter === 'All' ? true : q.subject === subjectFilter))
    .filter((q) =>
      typeFilter === 'All types'
        ? true
        : typeFilter === 'MCQ'
          ? q.question_type === 'mcq'
          : q.question_type === 'theoretical'
    );

  return (
    <Screen>
      <View style={styles.filterWrap}>
        <ExamPicker exams={exams} value={examId} onChange={setExamId} allowAll />
      </View>
      <View style={styles.filterWrap}>
        <Chips options={subjectFilters} value={subjectFilter} onChange={setSubjectFilter} />
      </View>
      <View style={styles.filterWrap}>
        <Chips options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.text}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="library-outline"
            title="Pool is empty"
            subtitle={
              examId
                ? "No questions submitted for this exam yet — teachers' uploads appear here in real time."
                : 'Questions uploaded by teachers appear here in real time.'
            }
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Badge status={item.status} />
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{labelFor(item.question_type)}</Text>
                </View>
              </View>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.meta}>
              {item.exam?.name ? `${item.exam.name} · ` : ''}
              {item.subject} · {item.difficulty} · {item.marks} mk · by{' '}
              {item.teacher?.full_name ?? 'Unknown'}
            </Text>
            {item.status === 'submitted' && (
              <Button
                title="Approve for papers"
                variant="ghost"
                icon="checkmark-circle-outline"
                onPress={() => void approve(item)}
                style={styles.approveBtn}
              />
            )}
          </Card>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    filterWrap: {
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
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
    time: {
      color: colors.textDim,
      fontSize: 12,
    },
    body: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    meta: {
      color: colors.accent,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    approveBtn: {
      marginTop: spacing.md,
    },
  });
