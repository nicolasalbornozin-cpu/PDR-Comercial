import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, typography } from '@/theme';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tone?: 'green' | 'gold' | 'red';
}

export function MetricCard({ label, value, detail, icon, tone = 'green' }: MetricCardProps) {
  const accent = tone === 'red' ? colors.danger : tone === 'gold' ? colors.gold : colors.secondary;
  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: `${accent}16` }]}>
        <Ionicons color={accent} name={icon} size={18} />
      </View>
      <Text numberOfLines={1} style={styles.label}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.value, { color: accent }]}>{value}</Text>
      {detail ? <Text numberOfLines={1} style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, minHeight: 126, padding: 10 },
  icon: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', marginBottom: 9, width: 34 },
  label: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 6.8, fontWeight: '900', letterSpacing: 0.1 },
  value: { color: colors.text, fontFamily: typography.sans, fontSize: 20, fontWeight: '800', marginTop: 3 },
  detail: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 2 },
});
