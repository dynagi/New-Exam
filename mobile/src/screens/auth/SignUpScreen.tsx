import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
import { Aurora } from '../../components/Aurora';
import GradientText from '../../components/GradientText';
import { Button, Input, RolePicker, ThemeToggle } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { gradients, radius, spacing, ThemeColors } from '../../lib/theme';
import { Role } from '../../lib/types';
import type { AuthStackParamList } from '../../navigation/RootNavigator';

export default function SignUpScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [role, setRole] = useState<Role>('teacher');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    if (!fullName.trim()) return setError('Enter your full name.');
    if (!email.trim()) return setError('Enter your email.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');

    setBusy(true);
    try {
      await signUp(role, fullName, email, password);
      // Session is live; RootNavigator switches to the role's app.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed.');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <GradientText colors={gradients.brand} style={styles.title}>Create account</GradientText>
          <Text style={styles.subtitle}>Choose the role this account will hold.</Text>

          <RolePicker value={role} onChange={setRole} />

          <View style={styles.demoBanner}>
            <Ionicons name="information-circle" size={18} color={colors.info} />
            <Text style={styles.demoText}>
              Demo mode: roles are self-selected. In production, accounts are provisioned
              invite-only by the examination board.
            </Text>
          </View>

          <Input label="Full name" placeholder="Dr. A. Sharma" value={fullName} onChangeText={setFullName} />
          <Input
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Password (min 8 chars)"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Create Account" icon="person-add-outline" onPress={() => void handleSignUp()} loading={busy} />

          <Pressable onPress={() => navigation.goBack()} style={styles.linkWrap}>
            <Text style={styles.link}>
              Already registered? <Text style={{ color: colors.primary }}>Sign in</Text>
            </Text>
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
      paddingTop: spacing.lg,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
    subtitle: {
      color: colors.textDim,
      fontSize: 13,
      marginTop: 4,
      marginBottom: spacing.lg,
    },
    demoBanner: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: `${colors.info}14`,
      borderColor: `${colors.info}44`,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    demoText: {
      color: colors.textDim,
      fontSize: 12,
      flex: 1,
      lineHeight: 17,
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
    link: {
      color: colors.textDim,
      fontSize: 14,
    },
  });
