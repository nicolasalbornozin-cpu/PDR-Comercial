import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '@/components/UserAvatar';
import { colors, radii, spacing, typography } from '@/theme';
import { RankingEntry } from '@/types';
import { formatUF } from '@/utils/format';

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function RankingRow({ entry }: { entry: RankingEntry }) {
  return (
    <View style={[styles.row, entry.isCurrentUser && styles.current]}>
      <View style={styles.positionBox}>
        <Text style={medals[entry.position] ? styles.medal : styles.position}>{medals[entry.position] ?? entry.position}</Text>
      </View>
      <UserAvatar highlighted={entry.isCurrentUser} name={entry.name} size={46} />
      <View style={styles.content}>
        <Text numberOfLines={1} style={styles.name}>{entry.name}{entry.isCurrentUser ? ' · Tú' : ''}</Text>
        <Text numberOfLines={1} style={styles.subtitle}>{entry.subtitle}</Text>
      </View>
      <Text style={styles.value}>{formatUF(entry.value)} <Text style={styles.unit}>UF</Text></Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 74, paddingHorizontal: spacing.md, paddingVertical: 10 },
  current: { backgroundColor: colors.softGreen, borderBottomColor: colors.softGreen, borderRadius: radii.md, marginVertical: 3 },
  positionBox: { alignItems: 'center', width: 32 },
  medal: { fontSize: 21 },
  position: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, fontWeight: '800' },
  content: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: typography.sans, fontSize: 13, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: 3 },
  value: { color: colors.primary, fontFamily: typography.sans, fontSize: 15, fontWeight: '700' },
  unit: { color: colors.textMuted, fontSize: 10 },
});
