import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, CeremonyModal, EmptyState, Screen } from '../../components/UI';
import { usePrintPreview } from '../../context/PrintPreviewContext';
import { useTheme } from '../../context/ThemeContext';
import { showAlert } from '../../lib/alert';
import { cosignPaper, printCopies } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { supabase } from '../../lib/supabase';
import { spacing, ThemeColors } from '../../lib/theme';
import { Paper } from '../../lib/types';

export default function AdminPapersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<{ navigate: (screen: string) => void }>();
  const { setLastPrint } = usePrintPreview();

  const [papers, setPapers] = useState<Paper[]>([]);
  const [copyCounts, setCopyCounts] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);

  const [cosignTarget, setCosignTarget] = useState<Paper | null>(null);
  const [printTarget, setPrintTarget] = useState<Paper | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [{ data: paperRows, error: pErr }, { data: copyRows }] = await Promise.all([
      supabase
        .from('papers')
        .select('*, setter:profiles(full_name), exam:exams!papers_exam_id_fkey(name)')
        .order('created_at', { ascending: false }),
      supabase.from('paper_copies').select('paper_id'),
    ]);
    // Surface a real error instead of silently showing an empty list.
    if (pErr) {
      console.error('papers query failed:', pErr);
      showAlert('Could not load papers', pErr.message);
    }
    setPapers((paperRows as Paper[] | null) ?? []);

    const counts: Record<string, number> = {};
    for (const row of (copyRows as { paper_id: string }[] | null) ?? []) {
      counts[row.paper_id] = (counts[row.paper_id] ?? 0) + 1;
    }
    setCopyCounts(counts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Live: see papers arrive for co-signature the moment a setter seals them.
  useEffect(() => {
    const channel = supabase
      .channel('papers-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'papers' },
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

  const handleCosign = async (values: Record<string, string>) => {
    const passphrase = values.passphrase ?? '';
    if (passphrase.length < 8) {
      showAlert('Weak passphrase', 'Use at least 8 characters. You will need it at the print ceremony.');
      return;
    }
    if (!cosignTarget) return;
    setWorking(true);
    try {
      await cosignPaper(cosignTarget.id, passphrase);
      setCosignTarget(null);
      showAlert(
        'Co-signed 🛡️',
        "Dual control is now active: this paper cannot be decrypted without BOTH your passphrase and the setter's. The setter sees the status change live."
      );
      void load();
    } catch (e) {
      showAlert('Co-sign failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setWorking(false);
    }
  };

  const handlePrint = async (values: Record<string, string>) => {
    if (!printTarget) return;
    const setterPass = values.setterPassphrase ?? '';
    const adminPass = values.adminPassphrase ?? '';
    const copies = parseInt(values.copies ?? '', 10);
    const location = (values.location ?? '').trim() || 'Central Government Press';

    if (!setterPass || !adminPass) {
      showAlert('Two-person rule', 'Both the Setter and Admin passphrases are required.');
      return;
    }
    if (!copies || copies < 1 || copies > 500) {
      showAlert('Invalid copies', 'Enter a copy count between 1 and 500.');
      return;
    }

    setWorking(true);
    try {
      const result = await printCopies(printTarget.id, setterPass, adminPass, copies, location);
      setPrintTarget(null);
      // Hand the decrypted paper + per-copy QR payloads to the Print Preview tab.
      setLastPrint(result);
      void load();
      showAlert(
        'Print ceremony complete 🖨️',
        `${result.copies} copies minted at "${location}". Each carries a signed QR + invisible fingerprint. Opening the print preview…`,
        [{ text: 'View & Print', onPress: () => navigation.navigate('PrintPreview') }]
      );
    } catch (e) {
      showAlert('Ceremony failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Screen>
      <FlatList
        data={papers}
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
            icon="documents-outline"
            title="No papers in the system"
            subtitle="Papers sealed by setters arrive here for co-signature in real time."
          />
        }
        renderItem={({ item }) => (
          <Card>
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Badge status={item.status} />
            </View>
            <Text style={styles.meta}>
              {item.exam?.name ? `${item.exam.name} · ` : ''}
              {item.subject} · {item.question_count} questions · by{' '}
              {item.setter?.full_name ?? 'Unknown'} · {timeAgo(item.created_at)}
            </Text>
            {copyCounts[item.id] ? (
              <Text style={styles.copies}>{copyCounts[item.id]} copies in custody</Text>
            ) : null}

            {item.status === 'sealed' && (
              <Button
                title="Co-sign (Key Share 2/2)"
                icon="shield-checkmark-outline"
                onPress={() => setCosignTarget(item)}
                style={{ marginTop: spacing.md }}
              />
            )}
            {item.status === 'sealed_dual' && (
              <Button
                title="Print Ceremony (two-person rule)"
                variant="success"
                icon="print-outline"
                onPress={() => setPrintTarget(item)}
                style={{ marginTop: spacing.md }}
              />
            )}
            {item.status === 'draft' && (
              <Text style={styles.hint}>Setter has not sealed this draft yet.</Text>
            )}
          </Card>
        )}
      />

      <CeremonyModal
        visible={!!cosignTarget}
        title="Co-Sign Ceremony — Key Share 2/2"
        subtitle={`Co-signing "${cosignTarget?.title ?? ''}". Your passphrase wraps the second half of the key and destroys the escrow copy. After this, decryption requires both you and the setter.`}
        fields={[
          {
            key: 'passphrase',
            label: 'Admin passphrase (min 8 chars)',
            placeholder: 'Secret passphrase',
            secure: true,
          },
        ]}
        submitLabel="Co-Sign Paper"
        busy={working}
        onSubmit={(values) => void handleCosign(values)}
        onClose={() => setCosignTarget(null)}
      />

      <CeremonyModal
        visible={!!printTarget}
        title="Print Ceremony — Two-Person Rule"
        subtitle={`Decrypting "${printTarget?.title ?? ''}" requires BOTH passphrases, entered together. Each printed copy receives a signed QR code and an invisible AI fingerprint.`}
        fields={[
          { key: 'setterPassphrase', label: 'Paper Setter passphrase', secure: true },
          { key: 'adminPassphrase', label: 'Admin passphrase', secure: true },
          { key: 'copies', label: 'Number of copies (1–500)', numeric: true, defaultValue: '10' },
          {
            key: 'location',
            label: 'Printing press location',
            defaultValue: 'Central Government Press, Delhi',
          },
        ]}
        submitLabel="Decrypt & Print Copies"
        busy={working}
        onSubmit={(values) => void handlePrint(values)}
        onClose={() => setPrintTarget(null)}
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
      gap: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      flex: 1,
    },
    meta: {
      color: colors.textDim,
      fontSize: 12,
      marginTop: spacing.sm,
    },
    copies: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 4,
    },
    hint: {
      color: colors.textDim,
      fontSize: 12,
      fontStyle: 'italic',
      marginTop: spacing.sm,
    },
  });
