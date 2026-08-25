import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { newsImages } from '@/data/assets';
import { colors, radii, spacing, typography } from '@/theme';
import { NewsArticle } from '@/types';
import { formatDate } from '@/utils/format';

interface NewsCardProps {
  article: NewsArticle;
  onPress: () => void;
}

export function NewsCard({ article, onPress }: NewsCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image source={newsImages[article.image]} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.category}>{article.category.toUpperCase()}</Text>
        <Text numberOfLines={2} style={styles.title}>{article.title}</Text>
        <Text numberOfLines={2} style={styles.summary}>{article.summary}</Text>
        <Text style={styles.date}>{formatDate(article.date)}</Text>
      </View>
      <Ionicons color={colors.primary} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  pressed: { opacity: 0.74 },
  image: { borderRadius: radii.md, height: 96, width: 92 },
  content: { flex: 1 },
  category: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.text, fontFamily: typography.serif, fontSize: 16, fontWeight: '600', marginTop: 4 },
  summary: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, lineHeight: 16, marginTop: 3 },
  date: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, fontWeight: '600', marginTop: 6 },
});
