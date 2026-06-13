import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, ExamPicker, Input, Screen, SectionTitle, Stepper } from '../../components/UI';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../lib/alert';
import { allocateCopies, provisionCenter, scanCopy } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { radius, spacing, ThemeColors } from '../../lib/theme';
import { ExamCenter, ExamSlot } from '../../lib/types';
import { useScheduledExams } from '../../lib/useExams';

type CopyLite = {
  id: string;
  copy_number: number;
  center_id: string | null;
  scanned_at: string | null;
  qr_payload: string;
  paper_id: string;
};

export default function CentersScreen() {
  const { exams } = useScheduledExams();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [examId, setExamId] = useState<string | null>(null);
  const [centers, setCenters] = useState<ExamCenter[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [copies, setCopies] = useState<CopyLite[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Create-center modal
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cCode, setCCode] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cSlotId, setCSlotId] = useState<string | null>(null);
  const [cCapacity, setCCapacity] = useState(30);
  const [busy, setBusy] = useState(false);

  // Allocate + scan modals
  const [allocTarget, setAllocTarget] = useState<ExamCenter | null>(null);
  const [allocCount, setAllocCount] = useState('10');
  const [scanTarget, setScanTarget] = useState<ExamCenter | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!examId) {
      setCenters([]);
      setCopies([]);
      setSlots([]);
      return;
    }
    const [{ data: centerRows }, { data: slotRows }, { data: paperRows }] = await Promise.all([
      supabase.from('exam_centers').select('*').eq('exam_id', examId).order('starts_at', { ascending: true }),
      supabase.from('exam_slots').select('*').eq('exam_id', examId).order('slot_no', { ascending: true }),
      supabase.from('papers').select('id').eq('exam_id', examId),
    ]);
    setCenters((centerRows as ExamCenter[] | null) ?? []);
    setSlots((slotRows as ExamSlot[] | null) ?? []);

    const paperIds = (paperRows as { id: string }[] | null)?.map((p) => p.id) ?? [];
    if (paperIds.length === 0) {
      setCopies([]);
      return;
    }
    const { data: copyRows } = await supabase
      .from('paper_copies')
      .select('id, copy_number, center_id, scanned_at, qr_payload, paper_id')
      .in('paper_id', paperIds)
      .order('copy_number', { ascending: true });
    setCopies((copyRows as CopyLite[] | null) ?? []);
  }, [examId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    const channel = supabase
      .channel('centers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_centers' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'paper_copies' }, () => void load())
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

  const unallocated = copies.filter((c) => !c.center_id).length;
  const forCenter = (id: string) => copies.filter((c) => c.center_id === id);

  const openCreate = () => {
    setCName('');
    setCCode('');
    setCPassword('');
    setCSlotId(slots[0]?.id ?? null);
    setCCapacity(30);
    setCreating(true);
  };

  const createCenter = async () => {
    if (!examId) return;
    if (cName.trim().length < 2) return showAlert('Missing name', 'Enter a center name.');
    if (cCode.trim().length < 1) return showAlert('Missing code', 'Enter a short center code.');
    if (cPassword.length < 6) return showAlert('Weak password', 'Center password must be 6+ characters.');
    if (slots.length > 0 && !cSlotId) return showAlert('Pick a slot', 'Choose which slot this center runs.');

    setBusy(true);
    try {
      const res = await provisionCenter({
        examId,
        slotId: cSlotId,
        name: cName.trim(),
        code: cCode.trim(),
        password: cPassword,
        capacity: cCapacity,
      });
      setCreating(false);
      showAlert(
        'Center created ✅',
        `Login code: ${res.login.code}\nPassword: ${cPassword}\n\nShare these with the center. The invigilator signs in via "Exam center login" and scans QRs. Save the password now — it isn't shown again.`
      );
      void load();
    } catch (e) {
      showAlert('Could not create center', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  const doAllocate = async () => {
    if (!allocTarget) return;
    const count = parseInt(allocCount, 10);
    if (!count || count < 1) return showAlert('Invalid count', 'Enter how many copies to allocate.');
    setWorking(true);
    try {
      const res = await allocateCopies(allocTarget.id, count);
      setAllocTarget(null);
      showAlert('Allocated', `${res.allocated} copies allocated to ${allocTarget.name}.`);
      void load();
    } catch (e) {
      showAlert('Allocation failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setWorking(false);
    }
  };

  const doScan = async (copy: CopyLite) => {
    setWorking(true);
    try {
      const res = await scanCopy(copy.qr_payload);
      showAlert('Scanned ✓', `Copy #${res.copy_number} scanned in. Removed from pending.`);
      void load();
    } catch (e) {
      showAlert('Scan failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setWorking(false);
    }
  };

  if (exams.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title="No exams scheduled"
          subtitle="Schedule an exam with slots first (Exams tab), then add centers under it."
        />
      </Screen>
    );
  }

  const scanList = scanTarget ? forCenter(scanTarget.id).filter((c) => !c.scanned_at) : [];

  return (
    <Screen scroll refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <SectionTitle title="Exam" />
      <ExamPicker exams={exams} value={examId} onChange={setExamId} />

      {!examId ? (
        <Card>
          <Text style={styles.dim}>Pick an exam to manage its centers.</Text>
        </Card>
      ) : (
        <>
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>
              {unallocated} unallocated cop{unallocated === 1 ? 'y' : 'ies'} available
            </Text>
            <Button title="Add Center" icon="add-outline" variant="ghost" onPress={openCreate} />
          </View>

          {centers.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="No centers yet"
              subtitle="Add a center (this creates its invigilator login), allocate copies, then scan in. Unscanned copies raise an alert ~20 min before the slot."
            />
          ) : (
            centers.map((center) => {
              const list = forCenter(center.id);
              const scanned = list.filter((c) => c.scanned_at).length;
              const pending = list.length - scanned;
              const pct = list.length ? Math.round((scanned / list.length) * 100) : 0;
              return (
                <Card key={center.id}>
                  <View style={styles.centerHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.centerName}>
                        {center.name} <Text style={styles.code}>({center.code})</Text>
                      </Text>
                      <Text style={styles.dim}>
                        Starts {fmtDateTime(center.starts_at)}
                        {center.capacity ? ` · ${center.capacity} seats` : ''}
                      </Text>
                    </View>
                    {center.reconciled_at ? (
                      <View style={[styles.tag, { backgroundColor: `${colors.warning}22` }]}>
                        <Text style={[styles.tagText, { color: colors.warning }]}>CHECKED</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.progressLabel}>
                    {scanned}/{list.length} scanned · {pending} pending
                  </Text>

                  <View style={styles.centerActions}>
                    <Button
                      title="Allocate copies"
                      variant="ghost"
                      icon="cube-outline"
                      onPress={() => {
                        setAllocTarget(center);
                        setAllocCount('10');
                      }}
                      style={styles.flexBtn}
                    />
                    <Button
                      title={`Scan-in (${pending})`}
                      icon="qr-code-outline"
                      onPress={() => setScanTarget(center)}
                      disabled={pending === 0}
                      style={styles.flexBtn}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </>
      )}

      {/* Create center */}
      <Modal transparent visible={creating} animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add Exam Center</Text>
              <Text style={styles.dim}>
                Creates the center and its invigilator login (code + password). The invigilator uses
                these on the “Exam center login” screen to scan papers in.
              </Text>

              <View style={{ height: spacing.md }} />
              <Input label="Center name" placeholder="e.g. Govt. Sr. Sec. School, Sector 12" value={cName} onChangeText={setCName} />
              <Input label="Center code (login id)" placeholder="e.g. DL-014" value={cCode} onChangeText={setCCode} autoCapitalize="characters" />
              <Input label="Center password" placeholder="min 6 chars" value={cPassword} onChangeText={setCPassword} secureTextEntry />

              <Stepper
                label="Seats / capacity"
                value={cCapacity}
                onChange={setCCapacity}
                min={0}
                max={5000}
                step={5}
                suffix="seats"
              />
              <Text style={styles.capacityHint}>
                How many candidates this center seats. Guides how many copies to allocate.
              </Text>

              <Text style={styles.fieldLabel}>Slot</Text>
              {slots.length === 0 ? (
                <Text style={styles.noSlots}>No slots on this exam — add slots when scheduling it.</Text>
              ) : (
                slots.map((slot) => {
                  const active = cSlotId === slot.id;
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => setCSlotId(slot.id)}
                      style={[styles.slotOption, active && styles.slotOptionActive]}
                    >
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={active ? colors.primary : colors.textDim}
                      />
                      <Text style={[styles.slotOptionText, active && { color: colors.primary }]}>
                        {slot.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}

              <Button title="Create Center" onPress={() => void createCenter()} loading={busy} style={{ marginTop: spacing.md }} />
              <Button title="Cancel" variant="ghost" onPress={() => setCreating(false)} style={{ marginTop: spacing.sm }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Allocate copies */}
      <Modal transparent visible={!!allocTarget} animationType="fade" onRequestClose={() => setAllocTarget(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Allocate to {allocTarget?.name}</Text>
            <Text style={styles.dim}>{unallocated} unallocated copies available to draw from.</Text>
            <Input label="Number of copies" keyboardType="number-pad" value={allocCount} onChangeText={setAllocCount} />
            <Button title="Allocate" onPress={() => void doAllocate()} loading={working} style={{ marginTop: spacing.sm }} />
            <Button title="Cancel" variant="ghost" onPress={() => setAllocTarget(null)} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </Modal>

      {/* Scan-in (admin override) */}
      <Modal transparent visible={!!scanTarget} animationType="fade" onRequestClose={() => setScanTarget(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Scan-in · {scanTarget?.name}</Text>
            <Text style={styles.dim}>
              Admin override scan. Normally the center's invigilator does this from the Center login.
            </Text>
            <View style={styles.scanList}>
              {scanList.length === 0 ? (
                <Text style={styles.dim}>All allocated copies scanned. ✓</Text>
              ) : (
                scanList.slice(0, 30).map((copy) => (
                  <Pressable key={copy.id} onPress={() => void doScan(copy)} disabled={working} style={styles.scanRow}>
                    <Ionicons name="qr-code-outline" size={18} color={colors.primary} />
                    <Text style={styles.scanRowText}>Copy #{copy.copy_number}</Text>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.textDim} />
                  </Pressable>
                ))
              )}
            </View>
            <Button title="Done" variant="ghost" onPress={() => setScanTarget(null)} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    dim: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    summary: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1 },
    centerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    centerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    code: { color: colors.textDim, fontWeight: '600' },
    tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    progressTrack: {
      height: 8,
      borderRadius: 999,
      backgroundColor: colors.surfaceAlt,
      marginTop: spacing.md,
      overflow: 'hidden',
    },
    progressFill: { height: 8, borderRadius: 999, backgroundColor: colors.success },
    progressLabel: { color: colors.textDim, fontSize: 12, marginTop: 6 },
    centerActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    flexBtn: { flex: 1 },
    fieldLabel: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: spacing.sm, marginBottom: spacing.sm },
    capacityHint: { color: colors.textFaint, fontSize: 12, marginTop: -spacing.sm, marginBottom: spacing.sm, lineHeight: 17 },
    noSlots: { color: colors.warning, fontSize: 12, marginBottom: spacing.sm },
    slotOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: colors.surfaceAlt,
    },
    slotOptionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    slotOptionText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
    backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: spacing.xl },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      maxHeight: '85%',
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
    scanList: { marginTop: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
    scanRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: spacing.md,
      backgroundColor: colors.surfaceAlt,
    },
    scanRowText: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  });
