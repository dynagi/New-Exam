import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, Screen } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { labelFor, spacing, ThemeColors } from '../../lib/theme';
import { Question } from '../../lib/types';

export default function MyQuestionsScreen() {
  const { profile } = useAuth();
  const teacherId = profile?.id;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!teacherId) return;
    const { data } = await supabase
      .from('questions')
      .select('*, exam:exams(name)')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });
    setQuestions((data as Question[] | null) ?? []);
  }, [teacherId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Screen>
      <FlatList
        data={questions}
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
            icon="document-text-outline"
            title="No questions yet"
            subtitle="Questions you type or import from a PDF appear here with their lifecycle status."
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
                {item.source === 'pdf' ? (
                  <View style={styles.typePill}>
                    <Text style={styles.typePillText}>PDF</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
            {item.question_type === 'mcq' ? (
              item.options.map((option, index) => (
                <Text
                  key={index}
                  style={[styles.option, index === item.correct_index && styles.correctOption]}
                >
                  {String.fromCharCode(65 + index)}. {option}
                  {index === item.correct_index ? '  ✓' : ''}
                </Text>
              ))
            ) : (
              <Text style={styles.theoryHint}>Theory question · model answer set offline</Text>
            )}
            <Text style={styles.meta}>
              {item.exam?.name ? `${item.exam.name} · ` : ''}
              {item.subject}
              {item.topic ? ` · ${item.topic}` : ''} · {item.difficulty} · {item.marks} mark
              {item.marks === 1 ? '' : 's'}
            </Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      marginBottom: spacing.sm,
    },
    option: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 20,
    },
    correctOption: {
      color: colors.success,
      fontWeight: '600',
    },
    theoryHint: {
      color: colors.textFaint,
      fontSize: 12,
      fontStyle: 'italic',
    },
    meta: {
      color: colors.textDim,
      fontSize: 12,
      marginTop: spacing.sm,
      opacity: 0.85,
    },
  });
