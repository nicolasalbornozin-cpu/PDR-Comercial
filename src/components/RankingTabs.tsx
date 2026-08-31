import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';
import { RankingMode } from '@/types';

const options: { label: string; value: RankingMode }[] = [
  { label: 'Vendedores', value: 'sellers' },
  { label: 'Equipos', value: 'teams' },
  { label: 'Jefaturas', value: 'management' },
];

interface RankingTabsProps {
  value: RankingMode;
  onChange: (value: RankingMode) => void;
}

export function RankingTabs({ value, onChange }: RankingTabsProps) {
  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} key={option.value} onPress={() => onChange(option.value)} style={[styles.tab, active && styles.tabActive]}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.pill, borderWidth: 1, flexDirection: 'row', padding: 4 },
  tab: { alignItems: 'center', borderRadius: radii.pill, flex: 1, justifyContent: 'center', minHeight: 43, paddingHorizontal: spacing.sm },
  tabActive: { backgroundColor: colors.primary },
  label: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, fontWeight: '600' },
  labelActive: { color: colors.surface },
});
