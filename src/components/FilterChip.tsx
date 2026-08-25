import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, typography } from '@/theme';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.active]}>
      <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  active: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  label: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  activeLabel: { color: colors.primary },
});
