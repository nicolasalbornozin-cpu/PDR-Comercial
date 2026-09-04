import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { colors, radii, shadows, spacing, typography } from '@/theme';

interface GoalCardProps {
  title: string;
  value: string;
  progress: number;
  insight: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  badge?: string;
  compact?: boolean;
  tone?: 'green' | 'gold' | 'red';
}

export function GoalCard({ title, value, progress, insight, icon, badge, compact = false, tone = 'gold' }: GoalCardProps) {
  const accent = tone === 'red' ? colors.danger : tone === 'green' ? colors.success : colors.gold;
  const iconBackground = tone === 'red' ? '#FBECE9' : colors.primary;
  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <View style={[styles.icon, compact && styles.compactIcon, { backgroundColor: iconBackground }]}>
            <Ionicons color={accent} name={icon} size={compact ? 17 : 22} />
          </View>
          <View style={styles.heading}>
            <Text numberOfLines={2} style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
            {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          </View>
        </View>
        <Text numberOfLines={2} style={[styles.value, compact && styles.compactValue, { color: accent }]}>{value}</Text>
      </View>
      <ProgressBar color={accent} height={compact ? 7 : 9} progress={progress} />
      <Text style={styles.insight}>{insight}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.md, padding: spacing.xl },
  compactCard: { flex: 1, gap: 10, padding: spacing.lg },
  top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  titleRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10, minWidth: 0 },
  heading: { flex: 1, minWidth: 0 },
  icon: { alignItems: 'center', borderRadius: radii.pill, height: 50, justifyContent: 'center', width: 50 },
  compactIcon: { borderRadius: 12, height: 36, width: 36 },
  title: { color: colors.text, fontFamily: typography.serif, fontSize: 17, fontWeight: '600' },
  compactTitle: { fontSize: 16 },
  badge: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, marginTop: 2 },
  value: { color: colors.primary, fontFamily: typography.sans, fontSize: 13.5, fontWeight: '800', maxWidth: '44%', textAlign: 'right' },
  compactValue: { fontSize: 14 },
  insight: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, fontWeight: '600' },
});
