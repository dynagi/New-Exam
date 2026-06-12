/**
 * Theme system — light + dark palettes share the same key set so any
 * component can read `colors` from `useTheme()` and restyle on toggle.
 *
 * Screens build their StyleSheet with a `makeStyles(colors)` factory and
 * memoize it on `colors`, so flipping the mode re-themes the whole app.
 */

export interface ThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;
  text: string;
  textDim: string;
  textFaint: string;
  primary: string;
  primaryDark: string;
  primarySoft: string; // translucent primary for selected backgrounds
  accent: string;
  violet: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  gold: string;
  /** Text/icon color that sits on top of a gradient or solid primary fill. */
  onAccent: string;
  /** Backdrop for modals. */
  backdrop: string;
}

export const darkColors: ThemeColors = {
  bg: '#060B16',
  bgElevated: '#0A1322',
  surface: '#0E1729',
  surfaceAlt: '#15213A',
  border: '#1F2D4A',
  borderLight: '#2C3E63',
  text: '#EDF2FC',
  textDim: '#8DA2C6',
  textFaint: '#5C6E91',
  primary: '#5B8DF8',
  primaryDark: '#3B6FE0',
  primarySoft: 'rgba(91, 141, 248, 0.14)',
  accent: '#22D3EE',
  violet: '#8B5CF6',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#38BDF8',
  gold: '#FBBF24',
  onAccent: '#FFFFFF',
  backdrop: 'rgba(2, 6, 14, 0.88)',
};

export const lightColors: ThemeColors = {
  bg: '#F4F6FB',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FA',
  border: '#DCE3F0',
  borderLight: '#C6D2E6',
  text: '#0F1B33',
  textDim: '#5A6B8C',
  textFaint: '#8A99B6',
  primary: '#2F6BF6',
  primaryDark: '#1E54D8',
  primarySoft: 'rgba(47, 107, 246, 0.10)',
  accent: '#0EA5C4',
  violet: '#7C3AED',
  success: '#0E9F6E',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#0284C7',
  gold: '#D97706',
  onAccent: '#FFFFFF',
  backdrop: 'rgba(15, 27, 51, 0.45)',
};

export type ThemeMode = 'light' | 'dark';

export function paletteFor(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}

/** Gradient pairs used by buttons, chips and brand marks (work on both modes). */
export const gradients = {
  primary: ['#4F7DF7', '#8B5CF6'] as const,
  success: ['#0EA56F', '#34D399'] as const,
  danger: ['#EF4444', '#F87171'] as const,
  brand: ['#22D3EE', '#5B8DF8', '#8B5CF6'] as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
};

/** Semantic color key for any status / severity string used across the app. */
type ToneKey = keyof Pick<
  ThemeColors,
  'info' | 'success' | 'textDim' | 'warning' | 'accent' | 'primary' | 'gold' | 'danger'
>;

const statusTone: Record<string, ToneKey> = {
  // questions
  submitted: 'info',
  approved: 'success',
  used: 'textDim',
  // papers
  draft: 'textDim',
  sealed: 'warning',
  sealed_dual: 'accent',
  printed: 'primary',
  distributed: 'gold',
  completed: 'success',
  // copies / custody
  in_transit: 'warning',
  at_center: 'info',
  delivered: 'success',
  missing: 'danger',
  leaked: 'danger',
  // exams
  scheduled: 'accent',
  // alert severities
  info: 'info',
  warning: 'warning',
  critical: 'danger',
};

export const statusLabel: Record<string, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  used: 'Used in paper',
  draft: 'Draft',
  sealed: 'Sealed (1/2)',
  sealed_dual: 'Dual-Sealed',
  printed: 'Printed',
  distributed: 'Distributed',
  completed: 'Completed',
  in_transit: 'In Transit',
  at_center: 'At Center',
  delivered: 'Delivered',
  missing: 'MISSING',
  leaked: 'LEAKED',
  scheduled: 'Scheduled',
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
  // question types
  mcq: 'MCQ',
  theoretical: 'Theory',
};

export function toneFor(colors: ThemeColors, status: string): string {
  const key = statusTone[status];
  return key ? colors[key] : colors.textDim;
}

export function labelFor(status: string): string {
  return statusLabel[status] ?? status;
}
