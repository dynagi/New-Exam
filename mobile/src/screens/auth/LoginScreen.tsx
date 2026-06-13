import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Reveal } from '../../components/anim';
import { Aurora } from '../../components/Aurora';
import GradientText from '../../components/GradientText';
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

  // Gentle floating loop for the logo badge.
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      await signIn(role, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Aurora />
      <SafeAreaView style={styles.flex}>
        <View style={styles.topBar}>
          <ThemeToggle />
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Reveal scale>
              <View style={styles.logoWrap}>
                <Animated.View style={{ transform: [{ translateY: floatY }] }}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBadge}>
                    <Ionicons name="shield-checkmark" size={36} color="#fff" />
                  </LinearGradient>
                </Animated.View>
                <GradientText colors={gradients.brand} style={styles.title}>
                  SecureAIExam
                </GradientText>
                <Text style={styles.subtitle}>Zero single point of failure. From question to exam hall.</Text>
              </View>
            </Reveal>

            <Reveal delay={120}>
              <View style={styles.cardShadow}>
                <BlurView intensity={Platform.OS === 'web' ? 18 : 36} tint={colors.blurTint} style={styles.card}>
                  {!IS_CONFIGURED && (
                    <View style={styles.warnBanner}>
                      <Ionicons name="alert-circle" size={18} color={colors.warning} />
                      <Text style={styles.warnText}>Not configured yet — set your Supabase keys in src/lib/config.ts</Text>
                    </View>
                  )}

                  <Text style={styles.fieldHeading}>Sign in as</Text>
                  <RolePicker value={role} onChange={setRole} />

                  <Input label="Email" placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
                  <Input label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />

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
                </BlurView>
              </View>
            </Reveal>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    content: { padding: spacing.xl, paddingTop: spacing.lg, flexGrow: 1, justifyContent: 'center' },
    logoWrap: { alignItems: 'center', marginBottom: spacing.xl },
    logoBadge: {
      width: 80,
      height: 80,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      shadowColor: colors.violet,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.5,
      shadowRadius: 22,
      elevation: 10,
    },
    title: { fontSize: 30, fontWeight: '900', letterSpacing: 0.3 },
    subtitle: { color: colors.textDim, fontSize: 13, marginTop: 6, textAlign: 'center' },
    cardShadow: {
      borderRadius: radius.xl,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: colors.blurTint === 'dark' ? 0.45 : 0.16,
      shadowRadius: 30,
      elevation: 10,
    },
    card: {
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      padding: spacing.xl,
      overflow: 'hidden',
    },
    fieldHeading: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
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
    warnText: { color: colors.warning, fontSize: 12, flex: 1 },
    error: { color: colors.danger, fontSize: 13, marginBottom: spacing.md },
    linkWrap: { marginTop: spacing.lg, alignItems: 'center' },
    centerLink: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    link: { color: colors.textDim, fontSize: 14 },
  });
