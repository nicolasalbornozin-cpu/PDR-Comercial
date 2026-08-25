import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { NewsCard } from '@/components/NewsCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { newsImages } from '@/data/assets';
import { galleryImages, newsArticles } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function NewsScreen() {
  const router = useRouter();
  const featured = newsArticles.find((article) => article.featured) ?? newsArticles[0];
  const news = newsArticles.filter((article) => !article.featured);

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <AppHeader />
          <Text style={styles.title}>Noticias</Text>
          <Text style={styles.subtitle}>Todo lo que está pasando en nuestra comunidad</Text>
        </View>

        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/news/[id]', params: { id: featured.id } })} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
            <ImageBackground source={newsImages[featured.image]} style={styles.featuredImage}>
              <LinearGradient colors={['rgba(9,61,42,0.02)', 'rgba(9,61,42,0.88)']} style={StyleSheet.absoluteFill} />
              <View style={styles.featuredContent}>
                <View style={styles.badge}><Ionicons color={colors.primary} name="sparkles" size={12} /><Text style={styles.badgeText}>DESTACADA</Text></View>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text style={styles.featuredSummary}>{featured.summary}</Text>
                <View style={styles.moreButton}><Text style={styles.moreText}>Ver más</Text><Ionicons color={colors.surface} name="arrow-forward" size={17} /></View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={styles.section}>
            <SectionHeader title="Últimas noticias" />
            <View style={styles.newsList}>
              {news.map((article) => (
                <NewsCard article={article} key={article.id} onPress={() => router.push({ pathname: '/news/[id]', params: { id: article.id } })} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader actionLabel="Ver todas" onAction={() => router.push('/gallery')} title="Galería Paseo Senior 2026" />
            <Pressable accessibilityLabel="Abrir galería" onPress={() => router.push('/gallery')} style={({ pressed }) => [styles.gallery, pressed && styles.pressed]}>
              <Image source={newsImages[galleryImages[0]]} style={styles.galleryLarge} />
              <View style={styles.galleryColumn}>
                <Image source={newsImages[galleryImages[1]]} style={styles.gallerySmall} />
                <View style={styles.lastImageWrap}>
                  <Image source={newsImages[galleryImages[2]]} style={styles.gallerySmall} />
                  <View style={styles.galleryOverlay}><Text style={styles.galleryCount}>+3</Text></View>
                </View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 32 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600', marginTop: spacing.xxl },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, lineHeight: 18, marginTop: 3 },
  content: { gap: spacing.xxl, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  heroCard: { ...shadows.floating, borderRadius: radii.xl, overflow: 'hidden' },
  featuredImage: { height: 340, justifyContent: 'flex-end' },
  featuredContent: { gap: 9, padding: spacing.xxl },
  badge: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  featuredTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 29, fontWeight: '600' },
  featuredSummary: { color: 'rgba(255,255,255,0.79)', fontFamily: typography.sans, fontSize: 13, lineHeight: 19 },
  moreButton: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 4 },
  moreText: { color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  section: { gap: spacing.md },
  newsList: { gap: spacing.md },
  gallery: { flexDirection: 'row', gap: spacing.sm, height: 232 },
  galleryLarge: { borderRadius: radii.lg, flex: 1.35, height: '100%' },
  galleryColumn: { flex: 1, gap: spacing.sm },
  gallerySmall: { borderRadius: radii.md, flex: 1, height: '100%', width: '100%' },
  lastImageWrap: { flex: 1, position: 'relative' },
  galleryOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: 'rgba(9,61,42,0.55)', borderRadius: radii.md, justifyContent: 'center' },
  galleryCount: { color: colors.surface, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
});
