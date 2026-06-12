import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { gradients, labelFor, radius, spacing, ThemeColors, toneFor } from '../lib/theme';
import { Exam, Role, ROLE_LABEL } from '../lib/types';

/** Shared hook: memoized themed styles for any component in this file. */
function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => ({ colors, styles: makeStyles(colors) }), [colors]);
}

/* ------------------------------- layout ---------------------------------- */

export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors, styles } = useStyles();
  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, styles.screenContent]}>{children}</View>;
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  const { styles } = useStyles();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sectionBar}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors, styles } = useStyles();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={icon} size={34} color={colors.textDim} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/* ------------------------------- controls -------------------------------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'success' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, styles } = useStyles();
  const gradient =
    variant === 'primary'
      ? gradients.primary
      : variant === 'danger'
        ? gradients.danger
        : variant === 'success'
          ? gradients.success
          : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        { opacity: disabled || loading ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.textDim : colors.onAccent} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? (
            <Ionicons
              name={icon}
              size={17}
              color={variant === 'ghost' ? colors.textDim : colors.onAccent}
            />
          ) : null}
          <Text style={[styles.buttonText, variant === 'ghost' && { color: colors.textDim }]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
}

export function Input({ label, style, onFocus, onBlur, ...rest }: InputProps) {
  const { colors, styles } = useStyles();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.inputLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        style={[styles.input, focused && styles.inputFocused, style]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

export function Chips({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, active && styles.chipActive]}
          >
            {active ? (
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Horizontal exam selector — exams are the categories every question and
 * paper lives under. `allowAll` adds an "All Exams" pill for filtering.
 */
export function ExamPicker({
  exams,
  value,
  onChange,
  allowAll = false,
}: {
  exams: Exam[];
  value: string | null;
  onChange: (examId: string | null) => void;
  allowAll?: boolean;
}) {
  const { colors, styles } = useStyles();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.examRow}
    >
      {allowAll ? (
        <Pressable
          onPress={() => onChange(null)}
          style={[styles.examPill, value === null && styles.examPillActive]}
        >
          {value === null ? (
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Ionicons
            name="albums-outline"
            size={15}
            color={value === null ? colors.onAccent : colors.textDim}
          />
          <Text style={[styles.examName, value === null && styles.examTextActive]}>All Exams</Text>
        </Pressable>
      ) : null}
      {exams.map((exam) => {
        const active = exam.id === value;
        return (
          <Pressable
            key={exam.id}
            onPress={() => onChange(exam.id)}
            style={[styles.examPill, active && styles.examPillActive]}
          >
            {active ? (
              <LinearGradient
                colors={gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Ionicons
              name="calendar-outline"
              size={15}
              color={active ? colors.onAccent : colors.accent}
            />
            <View>
              <Text style={[styles.examName, active && styles.examTextActive]} numberOfLines={1}>
                {exam.name}
              </Text>
              <Text style={[styles.examDate, active && styles.examTextActive]}>
                {exam.exam_date}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Badge({ status }: { status: string }) {
  const { colors, styles } = useStyles();
  const tone = toneFor(colors, status);
  return (
    <View style={[styles.badge, { backgroundColor: `${tone}1F`, borderColor: `${tone}55` }]}>
      <View style={[styles.badgeDot, { backgroundColor: tone }]} />
      <Text style={[styles.badgeText, { color: tone }]}>{labelFor(status).toUpperCase()}</Text>
    </View>
  );
}

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  const { colors, styles } = useStyles();
  const accent = tone ?? colors.primary;
  return (
    <View style={styles.stat}>
      <View style={[styles.statAccent, { backgroundColor: accent }]} />
      <Text style={[styles.statValue, { color: tone ?? colors.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function RolePicker({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const { colors, styles } = useStyles();
  const roles: { role: Role; icon: keyof typeof Ionicons.glyphMap }[] = [
    { role: 'teacher', icon: 'school-outline' },
    { role: 'paper_setter', icon: 'create-outline' },
    { role: 'admin', icon: 'shield-checkmark-outline' },
  ];
  return (
    <View style={styles.roleRow}>
      {roles.map(({ role, icon }) => {
        const active = role === value;
        return (
          <Pressable
            key={role}
            onPress={() => onChange(role)}
            style={[styles.roleTab, active && styles.roleTabActive]}
          >
            <Ionicons name={icon} size={22} color={active ? colors.primary : colors.textDim} />
            <Text style={[styles.roleTabText, active && { color: colors.primary }]}>
              {ROLE_LABEL[role]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Sun/moon pill that flips the app between light and dark. */
export function ThemeToggle() {
  const { colors, isDark, toggle } = useTheme();
  return (
    <Pressable
      onPress={toggle}
      hitSlop={10}
      style={{
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <Ionicons
        name={isDark ? 'sunny-outline' : 'moon-outline'}
        size={20}
        color={colors.textDim}
      />
    </Pressable>
  );
}

export function SignOutButton() {
  const { colors } = useTheme();
  const { signOut } = useAuth();
  return (
    <Pressable onPress={() => void signOut()} hitSlop={10} style={{ paddingHorizontal: spacing.md }}>
      <Ionicons name="log-out-outline" size={22} color={colors.textDim} />
    </Pressable>
  );
}

/** Header cluster: theme toggle + sign out, used as `headerRight`. */
export function HeaderActions() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ThemeToggle />
      <SignOutButton />
    </View>
  );
}

/* --------------------------- ceremony modal ------------------------------ */

export interface ModalField {
  key: string;
  label: string;
  placeholder?: string;
  secure?: boolean;
  numeric?: boolean;
  defaultValue?: string;
}

/**
 * Generic modal for the cryptographic ceremonies (seal, co-sign, print) and
 * other small forms. Field values are returned as a key -> string record.
 */
export function CeremonyModal({
  visible,
  title,
  subtitle,
  fields,
  submitLabel,
  busy,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  fields: ModalField[];
  submitLabel: string;
  busy?: boolean;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { styles } = useStyles();
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      for (const field of fields) initial[field.key] = field.defaultValue ?? '';
      setValues(initial);
    }
    // Re-initialize only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View style={styles.modalCard}>
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.modalTopBar}
          />
          <Text style={styles.modalTitle}>{title}</Text>
          {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
          {fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              placeholder={field.placeholder}
              secureTextEntry={field.secure}
              keyboardType={field.numeric ? 'number-pad' : 'default'}
              autoCapitalize="none"
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
            />
          ))}
          <Button title={submitLabel} loading={busy} onPress={() => onSubmit(values)} />
          <Button title="Cancel" variant="ghost" onPress={onClose} style={{ marginTop: spacing.sm }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* --------------------------------- styles -------------------------------- */

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    screenContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl * 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginBottom: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 3,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    sectionTitleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    sectionBar: {
      width: 4,
      height: 16,
      borderRadius: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    empty: {
      alignItems: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    emptyIconWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    emptyTitle: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    emptySubtitle: {
      color: colors.textDim,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    button: {
      borderRadius: radius.md,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    buttonInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    buttonGhost: {
      borderWidth: 1,
      borderColor: colors.borderLight,
      backgroundColor: 'transparent',
    },
    buttonText: {
      color: colors.onAccent,
      fontWeight: '800',
      fontSize: 15,
      letterSpacing: 0.3,
    },
    inputLabel: {
      color: colors.textDim,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      color: colors.text,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 15,
    },
    inputFocused: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    chipActive: {
      borderColor: 'transparent',
    },
    chipText: {
      color: colors.textDim,
      fontWeight: '700',
      fontSize: 13,
    },
    chipTextActive: {
      color: colors.onAccent,
    },
    examRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: 2,
    },
    examPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
      maxWidth: 240,
    },
    examPillActive: {
      borderColor: 'transparent',
    },
    examName: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 13,
    },
    examDate: {
      color: colors.textDim,
      fontSize: 11,
      marginTop: 1,
    },
    examTextActive: {
      color: colors.onAccent,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignSelf: 'flex-start',
    },
    badgeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    stat: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.md,
      paddingTop: spacing.md + 4,
      alignItems: 'center',
      overflow: 'hidden',
    },
    statAccent: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      opacity: 0.9,
    },
    statValue: {
      fontSize: 24,
      fontWeight: '900',
    },
    statLabel: {
      color: colors.textDim,
      fontSize: 11,
      marginTop: 2,
      textAlign: 'center',
      fontWeight: '600',
    },
    roleRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    roleTab: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    roleTabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    roleTabText: {
      color: colors.textDim,
      fontSize: 12,
      fontWeight: '700',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.backdrop,
      justifyContent: 'center',
      padding: spacing.xl,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: spacing.xl,
      overflow: 'hidden',
    },
    modalTopBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      marginBottom: 4,
    },
    modalSubtitle: {
      color: colors.textDim,
      fontSize: 13,
      lineHeight: 19,
      marginBottom: spacing.lg,
    },
  });
