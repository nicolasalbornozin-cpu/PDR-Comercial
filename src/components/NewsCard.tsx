import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, shadows, spacing, typography } from '@/theme';
import { NewsArticle } from '@/types';

interface NewsCardProps {
  article: NewsArticle;
  onPress: () => void;
}

const iconByCategory: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  Carreras: 'trending-up-outline',
  Reconocimientos: 'trophy-outline',
  'Información comercial': 'calendar-outline',
};

const compactDateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function NewsCard({ article, onPress }: NewsCardProps) {
  const date = compactDateFormatter.format(new Date(`${article.date}T12:00:00`));
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.icon}><Ionicons color={article.category === 'Reconocimientos' ? colors.goldText : colors.primary} name={iconByCategory[article.category] ?? 'newspaper-outline'} size={25} /></View>
      <View style={styles.content}>
        <Text numberOfLines={2} style={styles.title}>{article.title}</Text>
        <Text numberOfLines={2} style={styles.summary}>{article.summary}</Text>
      </View>
      <View style={styles.trailing}><Text style={styles.date}>{date}</Text><Ionicons color={colors.goldText} name="chevron-forward" size={17} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderColor: '#EEF1EE', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 104, padding: spacing.md },
  pressed: { opacity: 0.74 },
  icon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 52, justifyContent: 'center', width: 52 },
  content: { flex: 1 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 16, fontWeight: '600' },
  summary: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, lineHeight: 16, marginTop: 3 },
  trailing: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  date: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '600' },
});
