import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input, RolePicker, ThemeToggle } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { IS_CONFIGURED } from '../../lib/config';
import { gradients, radius, spacing, ThemeColors } from '../../lib/theme';
import { Role } from '../../lib/types';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [role, setRole] = useState<Role>('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(role, email, password);
      // Success: AuthContext session change swaps in the role's navigator.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrap}>
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Ionicons name="shield-checkmark" size={34} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>SecureAIExam</Text>
            <Text style={styles.subtitle}>
              Zero single point of failure. From question to exam hall.
            </Text>
          </View>

          {!IS_CONFIGURED && (
            <View style={styles.warnBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
              <Text style={styles.warnText}>
                Not configured yet — set your Supabase keys in src/lib/config.ts
              </Text>
            </View>
          )}

          <Text style={styles.fieldHeading}>Sign in as</Text>
          <RolePicker value={role} onChange={setRole} />

          <Input
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Sign In" icon="log-in-outline" onPress={() => void handleLogin()} loading={busy} />

          <Pressable onPress={() => navigation.navigate('SignUp')} style={styles.linkWrap}>
            <Text style={styles.link}>
              New here? <Text style={{ color: colors.primary }}>Create an account</Text>
            </Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('CenterLogin')} style={styles.centerLink}>
            <Ionicons name="qr-code-outline" size={16} color={colors.accent} />
            <Text style={[styles.link, { color: colors.accent }]}>Exam center / invigilator login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    content: {
      padding: spacing.xl,
      paddingTop: spacing.xl,
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    logoBadge: {
      width: 72,
      height: 72,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 8,
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    subtitle: {
      color: colors.textDim,
      fontSize: 13,
      marginTop: 4,
      textAlign: 'center',
    },
    fieldHeading: {
      color: colors.textDim,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    warnBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: `${colors.warning}1A`,
      borderColor: `${colors.warning}55`,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    warnText: {
      color: colors.warning,
      fontSize: 12,
      flex: 1,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
      marginBottom: spacing.md,
    },
    linkWrap: {
      marginTop: spacing.lg,
      alignItems: 'center',
    },
    centerLink: {
      marginTop: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    link: {
      color: colors.textDim,
      fontSize: 14,
    },
  });
