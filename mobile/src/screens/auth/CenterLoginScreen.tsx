import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Aurora } from '../../components/Aurora';
import GradientText from '../../components/GradientText';
import { Button, Input, ThemeToggle } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { gradients, spacing, ThemeColors } from '../../lib/theme';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

export default function CenterLoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signInCenter } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!code.trim() || !password) {
      setError('Enter your center code and password.');
      return;
    }
    setBusy(true);
    try {
      await signInCenter(code, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Aurora />
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBadge}>
              <Ionicons name="qr-code" size={32} color="#fff" />
            </LinearGradient>
            <GradientText colors={gradients.brand} style={styles.title}>Center Login</GradientText>
            <Text style={styles.subtitle}>
              Invigilator scan-in. Use the center code and password issued by the Admin.
            </Text>
          </View>

          <Input
            label="Center code"
            placeholder="e.g. DL-014"
            autoCapitalize="characters"
            value={code}
            onChangeText={setCode}
          />
          <Input label="Center password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Sign In to Scan" icon="log-in-outline" onPress={() => void submit()} loading={busy} />

          <Pressable onPress={() => navigation.goBack()} style={styles.linkWrap}>
            <Text style={styles.link}>
              Staff member? <Text style={{ color: colors.primary }}>Use the main login</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    content: { padding: spacing.xl, paddingTop: spacing.xl },
    logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: '800' },
    subtitle: { color: colors.textDim, fontSize: 13, marginTop: 4, textAlign: 'center', lineHeight: 19 },
    error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
    linkWrap: { marginTop: spacing.lg, alignItems: 'center' },
    link: { color: colors.textDim, fontSize: 14 },
  });
