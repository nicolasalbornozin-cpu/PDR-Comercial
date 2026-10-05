import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader } from '@/components/AppHeader';
import { NewsArticleComposer } from '@/components/NewsArticleComposer';
import { NewsDeleteButton } from '@/components/NewsDeleteButton';
import { NewsCard } from '@/components/NewsCard';
import { NewsPhoto, NewsPhotoBackground } from '@/components/NewsPhoto';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { newsImages } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { useNewsContent } from '@/hooks/useNewsContent';
import { newsService } from '@/services/newsService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { NewsArticle } from '@/types';
import { canEditNews } from '@/utils/permissions';
import { seniorTrips, tripPhotos } from '@/utils/newsTrips';

export default function NewsScreen() {
  const router = useRouter();
  const { authenticatedUser, isPreviewing } = useAuth();
  const { content, error, loading, refresh } = useNewsContent();
  const [composer, setComposer] = useState(false);
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState({ key: '', index: 0 });
  const pager = useRef<ScrollView>(null);
  const canEdit = canEditNews(authenticatedUser?.role) && !isPreviewing;
  const trips = seniorTrips(content.articles);
  const latestTrip = trips[0];
  const events = content.articles.find(article => article.category === 'Eventos recientes');
  const featured = content.articles.find(article => article.featured);
  const slides = [...new Map([latestTrip ?? featured, events].filter((article): article is NewsArticle => Boolean(article)).map(article => [article.id, article])).values()];
  const slideKey = slides.map(article => article.id).join(',');
  const slide = page.key === slideKey ? page.index : 0;
  const novelties = content.articles.filter(article => ['Carreras', 'Novedades'].includes(article.category));
  const others = content.articles.filter(article => !trips.some(trip => trip.id === article.id) && !['Carreras', 'Novedades'].includes(article.category));
  const photos = tripPhotos(content.articles, content.gallery, latestTrip);
  const open = (article: NewsArticle) => {
    if (trips.some(trip => trip.id === article.id)) router.push({ pathname: '/gallery', params: { trip: article.id } });
    else router.push({ pathname: '/news/[id]', params: { id: article.id } });
  };
  const go = (index: number) => {
    const next = Math.max(0, Math.min(index, slides.length - 1));
    pager.current?.scrollTo({ x: next * width, animated: true });
    setPage({ key: slideKey, index: next });
  };
  const removeButton = (article: NewsArticle) => <NewsDeleteButton label={article.title} onDelete={async () => { await newsService.deleteArticle(article.id); await refresh(); }}/>;

  return <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
    <View style={styles.frame}>
      <ImageBackground source={newsImages.park} style={styles.hero}>
        <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.4)']} style={StyleSheet.absoluteFill}/>
        <View style={styles.header}><AppHeader/><Text style={styles.title}>Noticias</Text><View style={styles.goldLine}/></View>
      </ImageBackground>
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={colors.gold}/> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {slides.length ? <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.carousel}>
          <ScrollView key={slideKey} ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={event => { if (width) setPage({ key: slideKey, index: Math.round(event.nativeEvent.contentOffset.x / width) }); }}>
            {slides.map(article => <View key={article.id} style={{ width: width || 300 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Ver más: ${article.title}`} onPress={() => open(article)}>
                <NewsPhotoBackground url={article.imageUrl} fallback={newsImages[article.image as keyof typeof newsImages] ?? newsImages.park} style={styles.cover}>
                  <LinearGradient colors={['rgba(9,61,42,0.02)', 'rgba(9,61,42,0.92)']} style={StyleSheet.absoluteFill}/>
                  <View style={styles.badge}><Text style={styles.badgeText}>{trips.some(trip => trip.id === article.id) ? 'PASEO SENIOR' : article.category === 'Eventos recientes' ? 'ÚLTIMOS EVENTOS' : 'DESTACADA'}</Text></View>
                  <View style={styles.coverCopy}><Text style={styles.coverTitle}>{article.title}</Text><Text style={styles.coverSummary}>{article.summary}</Text><View style={styles.more}><Text style={styles.white}>Ver más</Text><Ionicons name="chevron-forward" color={colors.goldOnDark} size={17}/></View></View>
                </NewsPhotoBackground>
              </Pressable>
              {canEdit ? <View style={styles.coverTools}>
                <Pressable accessibilityLabel={`Editar ${article.title}`} onPress={() => router.push({ pathname: '/news/[id]', params: { id: article.id, edit: '1' } })} style={styles.edit}><Ionicons name="pencil" size={18} color={colors.primary}/></Pressable>
                {removeButton(article)}
              </View> : null}
            </View>)}
          </ScrollView>
          {slides.length > 1 ? <View style={styles.pager}>
            <Pressable accessibilityLabel="Portada anterior" onPress={() => go(slide - 1)} disabled={slide === 0}><Ionicons name="chevron-back" color={slide === 0 ? colors.border : colors.primary} size={25}/></Pressable>
            <View style={styles.dots}>{slides.map((article, index) => <Pressable key={article.id} accessibilityLabel={`Ir a ${article.title}`} onPress={() => go(index)} style={[styles.dot, slide === index && styles.activeDot]}/>)}</View>
            <Pressable accessibilityLabel="Portada siguiente" onPress={() => go(slide + 1)} disabled={slide >= slides.length - 1}><Ionicons name="chevron-forward" color={slide >= slides.length - 1 ? colors.border : colors.primary} size={25}/></Pressable>
          </View> : null}
        </View> : null}
        <View style={styles.section}>
          <View style={styles.heading}><SectionHeader title="Novedades Santa Clara"/>{canEdit ? <Pressable accessibilityLabel="Crear apartado o publicación" onPress={() => setComposer(true)} style={styles.add}><Ionicons name="add" color={colors.surface} size={23}/></Pressable> : null}</View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.novelties}>
            {novelties.map(article => <View key={article.id} style={styles.novelty}>
              <Pressable onPress={() => open(article)}><NewsPhotoBackground url={article.imageUrl} fallback={newsImages.park} style={styles.noveltyImage}>
                <LinearGradient colors={['transparent', 'rgba(9,61,42,0.9)']} style={StyleSheet.absoluteFill}/>
                <View style={styles.noveltyCopy}><Text style={styles.noveltyTitle}>{article.title}</Text><Text numberOfLines={2} style={styles.coverSummary}>{article.summary}</Text></View>
              </NewsPhotoBackground></Pressable>
              {canEdit ? <View style={styles.noveltyTools}>{removeButton(article)}</View> : null}
            </View>)}
            {!novelties.length ? <Text style={styles.empty}>Aún no hay novedades publicadas.</Text> : null}
          </ScrollView>
        </View>
        <View style={styles.section}>
          <View style={styles.heading}><SectionHeader title="Publicaciones"/>{canEdit ? <Pressable accessibilityLabel="Crear noticia o evento" onPress={() => setComposer(true)} style={styles.create}><Ionicons name="add-circle-outline" color={colors.primary} size={20}/><Text style={styles.createText}>Crear</Text></Pressable> : null}</View>
          {others.map(article => <View key={article.id} style={styles.articleRow}><View style={styles.flex}><NewsCard article={article} onPress={() => open(article)}/></View>{canEdit ? removeButton(article) : null}</View>)}
          {!others.length ? <Text style={styles.empty}>Aún no hay publicaciones.</Text> : null}
        </View>
        {latestTrip ? <View style={styles.section}>
          <SectionHeader title={`Galería ${latestTrip.title}`} actionLabel="Ver todas" onAction={() => open(latestTrip)}/>
          <Pressable accessibilityLabel="Abrir galería del último paseo" onPress={() => open(latestTrip)} style={styles.gallery}>
            {photos.slice(0, 3).map(photo => <View key={photo.id} style={styles.galleryTile}><NewsPhoto url={photo.imageUrl} fallback={newsImages.seniorEvent} resizeMode="contain" style={styles.galleryImage}/></View>)}
            {!photos.length ? <Text style={styles.empty}>Aún no hay fotos de este paseo.</Text> : null}
          </Pressable>
        </View> : canEdit ? <Pressable onPress={() => router.push('/gallery')} style={styles.create}><Ionicons name="images-outline" size={20} color={colors.primary}/><Text style={styles.createText}>Crear un paseo y su galería</Text></Pressable> : null}
      </View>
    </View>
    {composer ? <NewsArticleComposer onClose={() => setComposer(false)} onPublished={async () => { await refresh(); }}/> : null}
  </ScreenContainer>;
}
const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 40 },
  frame: { maxWidth: 620, width: '100%' }, hero: { height: 250 }, header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 36, marginTop: 30 }, goldLine: { width: 47, height: 3, backgroundColor: colors.gold, marginTop: 10 },
  content: { marginTop: -35, paddingHorizontal: spacing.xl, gap: spacing.xxl }, carousel: { width: '100%' },
  cover: { height: 320, justifyContent: 'flex-end', borderRadius: radii.xl, overflow: 'hidden' },
  coverCopy: { padding: spacing.xl, gap: 8 }, coverTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 28 }, coverSummary: { color: 'rgba(255,255,255,0.85)', fontFamily: typography.sans, fontSize: 13, lineHeight: 19 },
  badge: { position: 'absolute', top: 18, left: 18, backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 }, badgeText: { color: colors.goldOnDark, fontSize: 10, fontWeight: '800' },
  more: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }, white: { color: colors.surface, fontFamily: typography.sans, fontWeight: '700' },
  coverTools: { position: 'absolute', top: 15, right: 15, gap: 8 }, edit: { padding: 10, borderRadius: radii.pill, backgroundColor: colors.surface },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10 }, dots: { flexDirection: 'row', gap: 8 }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.border }, activeDot: { backgroundColor: colors.gold, width: 23 },
  section: { gap: spacing.md }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  add: { backgroundColor: colors.primary, padding: 9, borderRadius: radii.pill }, create: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 9, backgroundColor: colors.softGreen, borderRadius: radii.pill }, createText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  novelties: { gap: spacing.md, paddingBottom: 5 }, novelty: { ...shadows.card, width: 245, borderRadius: radii.lg, overflow: 'hidden' }, noveltyImage: { height: 190, justifyContent: 'flex-end' }, noveltyCopy: { padding: spacing.lg, gap: 5 }, noveltyTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 21 }, noveltyTools: { position: 'absolute', right: 8, top: 8 },
  articleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' }, flex: { flex: 1 }, gallery: { flexDirection: 'row', gap: 8, height: 122 }, galleryTile: { flex: 1, minWidth: 0, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.softGreen }, galleryImage: { height: 122, width: '100%' },
  empty: { color: colors.textMuted, fontFamily: typography.sans, padding: 12, lineHeight: 20 }, error: { color: colors.danger, padding: 12 },
});
