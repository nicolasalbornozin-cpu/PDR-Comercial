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

  if (compact) {
    return (
      <View style={styles.compactCard}>
        <View style={[styles.compactIcon, { backgroundColor: iconBackground }]}>
          <Ionicons color={accent} name={icon} size={20} />
        </View>
        <View style={styles.compactBody}>
          <View style={styles.compactHeading}>
            <Text numberOfLines={1} style={styles.compactTitle}>{title}</Text>
            <Text numberOfLines={1} style={[styles.compactValue, { color: accent }]}>{value}</Text>
          </View>
          <ProgressBar color={accent} height={7} progress={progress} />
          {badge ? <Text numberOfLines={1} style={styles.compactCaption}>{badge}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={[styles.icon, { backgroundColor: iconBackground }]}>
        <Ionicons color={accent} name={icon} size={28} />
      </View>
      <View style={styles.body}>
        <View style={styles.top}>
          <View style={styles.heading}>
            <Text numberOfLines={1} style={styles.title}>{title}</Text>
            {badge ? <Text numberOfLines={1} style={styles.badge}>{badge}</Text> : null}
          </View>
          <Text numberOfLines={1} style={[styles.value, { color: accent }]}>{value}</Text>
        </View>
        <ProgressBar color={tone === 'gold' ? colors.success : accent} height={9} progress={progress} />
        <Text numberOfLines={1} style={styles.insight}>{insight}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.lg, minHeight: 108, padding: spacing.lg },
  body: { flex: 1, gap: 9, minWidth: 0 },
  top: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  heading: { flex: 1, minWidth: 0 },
  icon: { alignItems: 'center', borderRadius: radii.pill, height: 62, justifyContent: 'center', width: 62 },
  title: { color: colors.primary, fontFamily: typography.sans, fontSize: 16, fontWeight: '800' },
  badge: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 2 },
  value: { fontFamily: typography.sans, fontSize: 13, fontWeight: '900', maxWidth: '48%', textAlign: 'right' },
  insight: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, fontWeight: '600' },
  compactCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, flexDirection: 'row', gap: 9, minHeight: 82, paddingHorizontal: 12, paddingVertical: 11 },
  compactIcon: { alignItems: 'center', borderRadius: radii.pill, height: 43, justifyContent: 'center', width: 43 },
  compactBody: { flex: 1, gap: 7, minWidth: 0 },
  compactHeading: { alignItems: 'center', flexDirection: 'row', gap: 5, justifyContent: 'space-between' },
  compactTitle: { color: colors.text, flex: 1, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  compactValue: { fontFamily: typography.sans, fontSize: 12, fontWeight: '900' },
  compactCaption: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8 },
});
