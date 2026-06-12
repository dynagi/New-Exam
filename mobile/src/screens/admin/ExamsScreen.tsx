import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge, Button, Card, EmptyState, Input, Screen } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../lib/alert';
import { supabase } from '../../lib/supabase';
import { radius, spacing, ThemeColors } from '../../lib/theme';
import { Exam, ExamSlot, Paper } from '../../lib/types';

type ExamWithPaper = Exam & { paper?: { title: string } | null };
type SlotDraft = { start: string; end: string };

const DEFAULT_SLOTS: SlotDraft[] = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '17:00' },
];

function minutesBetween(date: string, start: string, end: string): number {
  const s = new Date(`${date}T${start}:00`).getTime();
  const e = new Date(`${date}T${end}:00`).getTime();
  return Math.round((e - s) / 60000);
}

export default function ExamsScreen() {
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [exams, setExams] = useState<ExamWithPaper[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [eligiblePapers, setEligiblePapers] = useState<Paper[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [paperId, setPaperId] = useState<string | null>(null);
  const [slotDrafts, setSlotDrafts] = useState<SlotDraft[]>(DEFAULT_SLOTS);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: examRows }, { data: paperRows }, { data: slotRows }] = await Promise.all([
      supabase.from('exams').select('*, paper:papers!exams_paper_id_fkey(title)').order('exam_date', { ascending: true }),
      supabase
        .from('papers')
        .select('*')
        .in('status', ['sealed_dual', 'printed'])
        .order('created_at', { ascending: false }),
      supabase.from('exam_slots').select('*').order('slot_no', { ascending: true }),
    ]);
    setExams((examRows as ExamWithPaper[] | null) ?? []);
    setEligiblePapers((paperRows as Paper[] | null) ?? []);
    setSlots((slotRows as ExamSlot[] | null) ?? []);
  }, []);

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

  const updateSlot = (i: number, key: keyof SlotDraft, value: string) =>
    setSlotDrafts((prev) => prev.map((s, idx) => (idx === i ? { ...s, [key]: value } : s)));
  const addSlot = () =>
    setSlotDrafts((prev) => (prev.length >= 3 ? prev : [...prev, { start: '18:00', end: '21:00' }]));
  const removeSlot = (i: number) =>
    setSlotDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));

  const resetForm = () => {
    setName('');
    setDate('');
    setPaperId(null);
    setSlotDrafts(DEFAULT_SLOTS);
  };

  const create = async () => {
    if (!profile) return;
    if (name.trim().length < 3) return showAlert('Missing name', 'Give the exam a name, e.g. "NEET UG 2026".');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return showAlert('Invalid date', 'Use YYYY-MM-DD.');

    // Validate slots.
    for (const [i, s] of slotDrafts.entries()) {
      if (!/^\d{2}:\d{2}$/.test(s.start) || !/^\d{2}:\d{2}$/.test(s.end)) {
        return showAlert('Invalid slot', `Slot ${i + 1}: use HH:MM (24h) for start and end.`);
      }
      if (minutesBetween(date.trim(), s.start, s.end) <= 0) {
        return showAlert('Invalid slot', `Slot ${i + 1}: end time must be after start time.`);
      }
    }

    const longest = Math.max(...slotDrafts.map((s) => minutesBetween(date.trim(), s.start, s.end)));

    setBusy(true);
    const { data: exam, error } = await supabase
      .from('exams')
      .insert({
        name: name.trim(),
        exam_date: date.trim(),
        duration_min: longest,
        paper_id: paperId,
        created_by: profile.id,
      })
      .select('id')
      .single();
    if (error || !exam) {
      setBusy(false);
      return showAlert('Failed', error?.message ?? 'Could not create exam');
    }

    const examId = (exam as { id: string }).id;
    const slotRows = slotDrafts.map((s, i) => ({
      exam_id: examId,
      label: `Slot ${i + 1} (${s.start}–${s.end})`,
      slot_no: i + 1,
      start_at: new Date(`${date.trim()}T${s.start}:00`).toISOString(),
      end_at: new Date(`${date.trim()}T${s.end}:00`).toISOString(),
      duration_min: minutesBetween(date.trim(), s.start, s.end),
    }));
    const { error: sErr } = await supabase.from('exam_slots').insert(slotRows);
    setBusy(false);
    if (sErr) return showAlert('Slots failed', sErr.message);

    setCreating(false);
    resetForm();
    void load();
  };

  const slotsFor = (examId: string) => slots.filter((s) => s.exam_id === examId);

  return (
    <Screen>
      <Button
        title="Schedule Exam"
        icon="add-circle-outline"
        onPress={() => setCreating(true)}
        style={{ marginBottom: spacing.md }}
      />

      <FlatList
        data={exams}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.text} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No exams scheduled"
            subtitle="Schedule an exam with its daily slots and attach a dual-sealed paper."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.header}>
              <Text style={styles.title}>{item.name}</Text>
              <Badge status={item.status} />
            </View>
            <Text style={styles.meta}>📅 {item.exam_date} · ⏱ {item.duration_min} min</Text>
            <Text style={styles.meta}>📄 {item.paper?.title ?? 'No paper attached yet'}</Text>
            {slotsFor(item.id).length > 0 ? (
              <View style={styles.slotChips}>
                {slotsFor(item.id).map((s) => (
                  <View key={s.id} style={styles.slotChip}>
                    <Ionicons name="time-outline" size={12} color={colors.accent} />
                    <Text style={styles.slotChipText}>{s.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
        )}
      />

      <Modal transparent visible={creating} animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Schedule Exam</Text>

              <Input label="Exam name" placeholder='e.g. "NEET UG 2026"' value={name} onChangeText={setName} />
              <Input
                label="Exam date (YYYY-MM-DD)"
                placeholder="2026-05-03"
                value={date}
                onChangeText={setDate}
                autoCapitalize="none"
              />

              <View style={styles.slotsHeader}>
                <Text style={styles.fieldLabel}>Slots ({slotDrafts.length}) — 2–3 per day</Text>
                {slotDrafts.length < 3 ? (
                  <Pressable onPress={addSlot} style={styles.addSlot}>
                    <Ionicons name="add" size={16} color={colors.primary} />
                    <Text style={styles.addSlotText}>Add slot</Text>
                  </Pressable>
                ) : null}
              </View>

              {slotDrafts.map((s, i) => (
                <View key={i} style={styles.slotRow}>
                  <View style={styles.slotInputs}>
                    <View style={styles.slotInput}>
                      <Input label={`Slot ${i + 1} start`} placeholder="09:00" value={s.start} onChangeText={(t) => updateSlot(i, 'start', t)} />
                    </View>
                    <View style={styles.slotInput}>
                      <Input label="End" placeholder="12:00" value={s.end} onChangeText={(t) => updateSlot(i, 'end', t)} />
                    </View>
                  </View>
                  {slotDrafts.length > 1 ? (
                    <Pressable onPress={() => removeSlot(i)} hitSlop={8} style={styles.removeSlot}>
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </Pressable>
                  ) : null}
                </View>
              ))}

              <Text style={styles.fieldLabel}>Attach paper (optional — dual-sealed/printed only)</Text>
              {eligiblePapers.length === 0 ? (
                <Text style={styles.noPapers}>No eligible papers yet.</Text>
              ) : (
                eligiblePapers.slice(0, 5).map((paper) => {
                  const active = paperId === paper.id;
                  return (
                    <Pressable
                      key={paper.id}
                      onPress={() => setPaperId(active ? null : paper.id)}
                      style={[styles.paperOption, active && styles.paperOptionActive]}
                    >
                      <Text style={[styles.paperOptionText, active && { color: colors.primary }]}>{paper.title}</Text>
                    </Pressable>
                  );
                })
              )}

              <Button title="Create Exam" onPress={() => void create()} loading={busy} style={{ marginTop: spacing.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ marginTop: spacing.sm }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    title: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
    meta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
    slotChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    slotChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    slotChipText: { color: colors.textDim, fontSize: 11, fontWeight: '600' },
    fieldLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
    slotsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    addSlot: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
    addSlotText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
    slotRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    slotInputs: { flexDirection: 'row', gap: spacing.sm, flex: 1 },
    slotInput: { flex: 1 },
    removeSlot: { paddingBottom: spacing.sm },
    noPapers: { color: colors.textDim, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.sm },
    paperOption: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.surfaceAlt,
    },
    paperOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    paperOptionText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
    modalBackdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: spacing.xl },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      maxHeight: '85%',
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.lg },
  });
