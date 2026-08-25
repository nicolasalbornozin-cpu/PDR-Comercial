import { Platform } from 'react-native';

export const colors = {
  primary: '#0E563A',
  primaryDark: '#093D2A',
  secondary: '#277250',
  softGreen: '#EAF3ED',
  paleGreen: '#F3F7F3',
  gold: '#C6A24C',
  goldText: '#85651C',
  goldOnDark: '#E0C56F',
  goldSoft: '#F4ECD5',
  background: '#F8F7F3',
  surface: '#FFFFFF',
  text: '#173229',
  textMuted: '#5F6D65',
  border: '#E5E9E5',
  danger: '#B6463D',
  warning: '#D49B3F',
  success: '#2B7A53',
  black: '#10251E',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia' }) ?? 'serif',
  sans: Platform.select({ ios: 'System', android: 'sans-serif', web: 'system-ui' }) ?? 'sans-serif',
} as const;

export const shadows = {
  card: {
    shadowColor: '#173229',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 3,
  },
  floating: {
    shadowColor: '#173229',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;
