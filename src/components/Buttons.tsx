import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
  style?: ViewStyle;
}

export function AppButton({ label, onPress, variant = 'primary', loading, disabled, icon, style }: AppButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.surface : colors.primary} />
      ) : (
        <>
          {icon ? <Ionicons color={isPrimary ? colors.surface : colors.primary} name={icon} size={18} /> : null}
          <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  light?: boolean;
  badge?: boolean;
  children?: ReactNode;
}

export function IconButton({ icon, label, onPress, light = false, badge = false }: IconButtonProps) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons color={light ? colors.surface : colors.primary} name={icon} size={23} />
      {badge ? <Text style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, height: 54, justifyContent: 'center', paddingHorizontal: spacing.xl },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 },
  ghost: { backgroundColor: colors.softGreen },
  label: { fontFamily: typography.sans, fontSize: 15, fontWeight: '700' },
  primaryLabel: { color: colors.surface },
  secondaryLabel: { color: colors.primary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.55 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', position: 'relative', width: 44 },
  badge: { backgroundColor: colors.gold, borderColor: colors.surface, borderRadius: 5, borderWidth: 1.5, height: 9, position: 'absolute', right: 8, top: 7, width: 9 },
});
