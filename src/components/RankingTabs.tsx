import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/theme';
import { RankingPeriod } from '@/types';

const options: { label: string; value: RankingPeriod }[] = [
  { label: 'Anual', value: 'annual' },
  { label: 'Mensual', value: 'monthly' },
];

interface RankingTabsProps {
  value: RankingPeriod;
  onChange: (value: RankingPeriod) => void;
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
  container: { backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', padding: 4 },
  tab: { alignItems: 'center', borderRadius: radii.pill, flex: 1, justifyContent: 'center', minHeight: 43, paddingHorizontal: spacing.sm },
  tabActive: { backgroundColor: colors.primary },
  label: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  labelActive: { color: colors.surface },
});
