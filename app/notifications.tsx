import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/DetailHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { activities } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function NotificationsScreen() {
  const [readIds, setReadIds] = useState<string[]>([]);
  const allRead = readIds.length === activities.length;

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <DetailHeader title="Notificaciones" />
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>Notificaciones</Text>
              <Text style={styles.subtitle}>{allRead ? 'Estás al día' : `${activities.length - readIds.length} novedades sin leer`}</Text>
            </View>
            <Pressable onPress={() => setReadIds(activities.map((activity) => activity.id))} style={styles.readAll}>
              <Text style={styles.readAllText}>Marcar leídas</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.list}>
          {activities.map((activity) => {
            const isRead = readIds.includes(activity.id);
            return (
              <Pressable key={activity.id} onPress={() => setReadIds((current) => current.includes(activity.id) ? current : [...current, activity.id])} style={[styles.card, !isRead && styles.unread]}>
                <View style={styles.icon}><Ionicons color={colors.secondary} name={activity.icon as IconName} size={21} /></View>
                <View style={styles.content}>
                  <Text style={styles.cardTitle}>{activity.title}</Text>
                  <Text style={styles.description}>{activity.description}</Text>
                  <Text style={styles.date}>{activity.relativeDate}</Text>
                </View>
                {!isRead ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: 2 },
  titleRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 31, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, marginTop: 4 },
  readAll: { paddingBottom: 2, paddingLeft: 12, paddingTop: 12 },
  readAllText: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  list: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  card: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderColor: 'transparent', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 96, padding: spacing.lg },
  unread: { backgroundColor: colors.softGreen, borderColor: '#D6E7DB' },
  icon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 15, height: 46, justifyContent: 'center', width: 46 },
  content: { flex: 1 },
  cardTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 13, fontWeight: '800' },
  description: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, marginTop: 4 },
  date: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '800', marginTop: 7 },
  dot: { backgroundColor: colors.gold, borderRadius: 5, height: 9, width: 9 },
});
