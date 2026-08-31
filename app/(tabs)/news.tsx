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
        <ImageBackground source={newsImages.park} style={styles.hero}>
          <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.72)', 'rgba(248,247,243,0.12)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.header}>
            <AppHeader />
            <Text style={styles.title}>Noticias</Text>
            <View style={styles.goldUnderline} />
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/news/[id]', params: { id: featured.id } })} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
            <ImageBackground source={newsImages[featured.image]} style={styles.featuredImage}>
              <LinearGradient colors={['rgba(9,61,42,0.02)', 'rgba(9,61,42,0.88)']} style={StyleSheet.absoluteFill} />
              <View style={styles.badge}><Ionicons color={colors.goldOnDark} name="star-outline" size={15} /><Text style={styles.badgeText}>Destacada</Text></View>
              <View style={styles.featuredContent}>
                <Text style={styles.featuredTitle}>{featured.title}</Text>
                <Text style={styles.featuredSummary}>{featured.summary}</Text>
                <View style={styles.moreButton}><Text style={styles.moreText}>Ver más</Text><Ionicons color={colors.goldOnDark} name="chevron-forward" size={15} /></View>
              </View>
            </ImageBackground>
          </Pressable>

          <View style={styles.section}>
            <View style={styles.newsList}>
              {news.map((article) => (
                <NewsCard article={article} key={article.id} onPress={() => router.push({ pathname: '/news/[id]', params: { id: article.id } })} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader actionLabel="Ver todas" onAction={() => router.push('/gallery')} title="Galería Paseo Senior 2026" />
            <Pressable accessibilityLabel="Abrir galería" onPress={() => router.push('/gallery')} style={({ pressed }) => [styles.gallery, pressed && styles.pressed]}>
              <Image source={newsImages[galleryImages[0]]} style={styles.galleryImage} />
              <Image source={newsImages[galleryImages[1]]} style={styles.galleryImage} />
              <View style={styles.lastImageWrap}>
                <Image source={newsImages[galleryImages[2]]} style={styles.galleryImage} />
                <View style={styles.galleryOverlay}><Text style={styles.galleryCount}>+3</Text></View>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 32 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 262, overflow: 'hidden' },
  header: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 36, fontWeight: '600', marginTop: 31 },
  goldUnderline: { backgroundColor: colors.gold, borderRadius: 3, height: 3, marginTop: 9, width: 47 },
  content: { gap: spacing.xxl, marginTop: -47, paddingHorizontal: spacing.xl },
  heroCard: { ...shadows.floating, borderRadius: radii.xl, overflow: 'hidden' },
  featuredImage: { height: 316, justifyContent: 'flex-end' },
  featuredContent: { gap: 7, padding: spacing.xxl },
  badge: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 13, paddingVertical: 8, position: 'absolute', right: spacing.md, top: spacing.md },
  badgeText: { color: colors.surface, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  featuredTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 27, fontWeight: '600' },
  featuredSummary: { color: 'rgba(255,255,255,0.79)', fontFamily: typography.sans, fontSize: 13, lineHeight: 19 },
  moreButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radii.pill, flexDirection: 'row', gap: 7, marginTop: 6, paddingHorizontal: 14, paddingVertical: 9 },
  moreText: { color: colors.surface, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  section: { gap: spacing.md },
  newsList: { gap: spacing.md },
  gallery: { flexDirection: 'row', gap: 7, height: 132 },
  galleryImage: { borderRadius: radii.md, flex: 1, height: '100%', width: '100%' },
  lastImageWrap: { flex: 1, position: 'relative' },
  galleryOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: 'rgba(9,61,42,0.55)', borderRadius: radii.md, justifyContent: 'center' },
  galleryCount: { color: colors.surface, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
});
