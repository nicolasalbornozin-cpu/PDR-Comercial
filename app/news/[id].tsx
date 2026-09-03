import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/DetailHeader';
import { NewsCard } from '@/components/NewsCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { newsImages } from '@/data/assets';
import { newsArticles } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { formatDate } from '@/utils/format';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const article = newsArticles.find((item) => item.id === id) ?? newsArticles[0];
  const related = newsArticles.find((item) => item.id !== article.id && item.category === article.category) ?? newsArticles.find((item) => item.id !== article.id)!;

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={newsImages[article.image]} style={styles.hero}>
          <LinearGradient colors={['rgba(9,61,42,0.66)', 'rgba(9,61,42,0.04)', 'rgba(9,61,42,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <DetailHeader light title="Detalle de noticia" />
            <View style={styles.heroCopy}>
              <View style={styles.categoryBadge}><Text style={styles.categoryText}>{article.category.toUpperCase()}</Text></View>
              <Text style={styles.title}>{article.title}</Text>
              <Text style={styles.date}>{formatDate(article.date)}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.articleCard}>
            <Text style={styles.summary}>{article.summary}</Text>
            <View style={styles.goldLine} />
            <Text style={styles.body}>{article.body}</Text>
            <Text style={styles.body}>En Parque del Recuerdo creemos que cada avance merece ser reconocido. Sigue revisando la aplicación para conocer nuevas actividades, resultados y oportunidades para crecer junto a tu equipo.</Text>
          </View>

          <View style={styles.relatedSection}>
            <Text style={styles.relatedTitle}>También te puede interesar</Text>
            <NewsCard article={related} onPress={() => router.replace({ pathname: '/news/[id]', params: { id: related.id } })} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 420 },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 2 },
  heroCopy: { gap: 8, paddingBottom: 44 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6 },
  categoryText: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  title: { color: colors.surface, fontFamily: typography.serif, fontSize: 32, fontWeight: '600', lineHeight: 38 },
  date: { color: 'rgba(255,255,255,0.72)', fontFamily: typography.sans, fontSize: 11 },
  content: { gap: spacing.xxl, marginTop: -24, paddingHorizontal: spacing.xl },
  articleCard: { ...shadows.floating, backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.lg, padding: spacing.xxl },
  summary: { color: colors.primary, fontFamily: typography.serif, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  goldLine: { backgroundColor: colors.gold, height: 2, width: 42 },
  body: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, lineHeight: 23 },
  relatedSection: { gap: spacing.md },
  relatedTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
});
