import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, ImageSourcePropType, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/AppHeader';
import { NewsCard } from '@/components/NewsCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { newsImages } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { useNewsContent } from '@/hooks/useNewsContent';
import { newsService } from '@/services/newsService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { GalleryPhoto, NewsArticle } from '@/types';

function articleImage(article: NewsArticle): ImageSourcePropType {
  return article.imageUrl ? { uri: article.imageUrl } : newsImages[article.image as keyof typeof newsImages] ?? newsImages.park;
}

function galleryImage(photo: GalleryPhoto): ImageSourcePropType {
  return photo.imageUrl ? { uri: photo.imageUrl } : newsImages[photo.image as keyof typeof newsImages] ?? newsImages.seniorEvent;
}

export default function NewsScreen() {
  const router = useRouter();
  const { authenticatedUser, isPreviewing } = useAuth();
  const { content, error, loading, refresh } = useNewsContent();
  const [careerOpen, setCareerOpen] = useState(false);
  const [careerTitle, setCareerTitle] = useState('');
  const [careerSummary, setCareerSummary] = useState('');
  const [careerBody, setCareerBody] = useState('');
  const [careerImageUrl, setCareerImageUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const isAdmin = authenticatedUser?.role === 'admin' && !isPreviewing;
  const featured = content.articles.find((article) => article.featured) ?? content.articles[0];
  const currentMonth = newsService.currentMonthStart().slice(0, 7);
  const careers = useMemo(
    () => content.articles.filter((article) => article.category === 'Carreras' && (!article.eventMonth || article.eventMonth.slice(0, 7) === currentMonth)),
    [content.articles, currentMonth],
  );
  const news = content.articles.filter((article) => article.id !== featured?.id && article.category !== 'Carreras');
  const seniorGallery = content.gallery.filter((photo) => !photo.newsArticleId);

  const selectCareerPhoto = async () => {
    try {
      const url = await newsService.pickArticleImage();
      if (url) setCareerImageUrl(url);
    } catch (cause) {
      Alert.alert('No se pudo subir la foto', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    }
  };

  const saveCareer = async () => {
    setSaving(true);
    try {
      await newsService.createCareer({ title: careerTitle, summary: careerSummary, body: careerBody, imageUrl: careerImageUrl });
      setCareerOpen(false);
      setCareerTitle('');
      setCareerSummary('');
      setCareerBody('');
      setCareerImageUrl(undefined);
      await refresh();
    } catch (cause) {
      Alert.alert('No se pudo publicar', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

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
          {loading ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {featured ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/news/[id]', params: { id: featured.id } })} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
              <ImageBackground source={articleImage(featured)} style={styles.featuredImage}>
                <LinearGradient colors={['rgba(9,61,42,0.02)', 'rgba(9,61,42,0.88)']} style={StyleSheet.absoluteFill} />
                <View style={styles.badge}><Ionicons color={colors.goldOnDark} name="star-outline" size={15} /><Text style={styles.badgeText}>Destacada</Text></View>
                {isAdmin ? <View style={styles.editBadge}><Ionicons color={colors.primary} name="pencil" size={15} /><Text style={styles.editBadgeText}>Editar imagen y texto</Text></View> : null}
                <View style={styles.featuredContent}>
                  <Text style={styles.featuredTitle}>{featured.title}</Text>
                  <Text style={styles.featuredSummary}>{featured.summary}</Text>
                  <View style={styles.moreButton}><Text style={styles.moreText}>Ver más</Text><Ionicons color={colors.goldOnDark} name="chevron-forward" size={15} /></View>
                </View>
              </ImageBackground>
            </Pressable>
          ) : null}

          <View style={styles.section}>
            <View style={styles.careerHeading}>
              <SectionHeader title="Nuevas carreras del mes" />
              {isAdmin ? (
                <Pressable accessibilityLabel="Agregar nueva carrera" onPress={() => setCareerOpen(true)} style={styles.addButton}>
                  <Ionicons color={colors.surface} name="add" size={20} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView contentContainerStyle={styles.careerCarousel} horizontal showsHorizontalScrollIndicator={false}>
              {careers.map((article) => (
                <Pressable key={article.id} onPress={() => router.push({ pathname: '/news/[id]', params: { id: article.id } })} style={({ pressed }) => [styles.careerCard, pressed && styles.pressed]}>
                  <ImageBackground source={articleImage(article)} style={styles.careerImage}>
                    <LinearGradient colors={['rgba(9,61,42,0.05)', 'rgba(9,61,42,0.9)']} style={StyleSheet.absoluteFill} />
                    <View style={styles.careerCopy}>
                      <Text numberOfLines={2} style={styles.careerTitle}>{article.title}</Text>
                      <Text numberOfLines={2} style={styles.careerSummary}>{article.summary}</Text>
                    </View>
                  </ImageBackground>
                </Pressable>
              ))}
              {!careers.length ? <Text style={styles.empty}>Aún no hay carreras publicadas para este mes.</Text> : null}
            </ScrollView>
          </View>

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
              {seniorGallery.slice(0, 3).map((photo, index) => (
                <View key={photo.id} style={index === 2 ? styles.lastImageWrap : styles.galleryItem}>
                  <Image source={galleryImage(photo)} style={styles.galleryImage} />
                  {index === 2 && seniorGallery.length > 3 ? <View style={styles.galleryOverlay}><Text style={styles.galleryCount}>+{seniorGallery.length - 3}</Text></View> : null}
                </View>
              ))}
              {!seniorGallery.length ? <Text style={styles.empty}>Aún no hay fotos publicadas.</Text> : null}
            </Pressable>
          </View>
        </View>
      </View>

      <Modal animationType="slide" onRequestClose={() => setCareerOpen(false)} transparent visible={careerOpen}>
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Publicar nueva carrera</Text>
              <Pressable accessibilityLabel="Cerrar" onPress={() => setCareerOpen(false)}><Ionicons color={colors.textMuted} name="close" size={24} /></Pressable>
            </View>
            <TextInput onChangeText={setCareerTitle} placeholder="Nombre de la carrera" placeholderTextColor={colors.textMuted} style={styles.input} value={careerTitle} />
            <TextInput multiline onChangeText={setCareerSummary} placeholder="Resumen breve" placeholderTextColor={colors.textMuted} style={[styles.input, styles.shortText]} value={careerSummary} />
            <TextInput multiline onChangeText={setCareerBody} placeholder="Detalle, fechas, metas y requisitos" placeholderTextColor={colors.textMuted} style={[styles.input, styles.longText]} value={careerBody} />
            {careerImageUrl ? <Image source={{ uri: careerImageUrl }} style={styles.previewImage} /> : null}
            <Pressable onPress={selectCareerPhoto} style={styles.photoButton}><Ionicons color={colors.primary} name="image-outline" size={19} /><Text style={styles.photoButtonText}>{careerImageUrl ? 'Cambiar foto' : 'Subir foto'}</Text></Pressable>
            <Pressable disabled={saving} onPress={saveCareer} style={[styles.publishButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color={colors.surface} /> : <><Ionicons color={colors.surface} name="cloud-upload-outline" size={19} /><Text style={styles.publishText}>Publicar para todos</Text></>}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
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
  loader: { paddingVertical: spacing.xl },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, padding: spacing.md },
  heroCard: { ...shadows.floating, borderRadius: radii.xl, overflow: 'hidden' },
  featuredImage: { height: 316, justifyContent: 'flex-end' },
  featuredContent: { gap: 7, padding: spacing.xxl },
  badge: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, flexDirection: 'row', gap: 6, paddingHorizontal: 13, paddingVertical: 8, position: 'absolute', right: spacing.md, top: spacing.md },
  badgeText: { color: colors.surface, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  editBadge: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radii.pill, flexDirection: 'row', gap: 6, left: spacing.md, paddingHorizontal: 12, paddingVertical: 8, position: 'absolute', top: spacing.md },
  editBadgeText: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '800' },
  featuredTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 27, fontWeight: '600' },
  featuredSummary: { color: 'rgba(255,255,255,0.79)', fontFamily: typography.sans, fontSize: 13, lineHeight: 19 },
  moreButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radii.pill, flexDirection: 'row', gap: 7, marginTop: 6, paddingHorizontal: 14, paddingVertical: 9 },
  moreText: { color: colors.surface, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  section: { gap: spacing.md },
  careerHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  addButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  careerCarousel: { gap: spacing.md, paddingBottom: 5 },
  careerCard: { ...shadows.card, borderRadius: radii.lg, overflow: 'hidden', width: 245 },
  careerImage: { height: 168, justifyContent: 'flex-end' },
  careerCopy: { gap: 3, padding: spacing.lg },
  careerTitle: { color: colors.surface, fontFamily: typography.serif, fontSize: 20, fontWeight: '600' },
  careerSummary: { color: 'rgba(255,255,255,0.75)', fontFamily: typography.sans, fontSize: 10, lineHeight: 15 },
  newsList: { gap: spacing.md },
  gallery: { flexDirection: 'row', gap: 7, minHeight: 132 },
  galleryItem: { flex: 1 },
  galleryImage: { borderRadius: radii.md, height: '100%', width: '100%' },
  lastImageWrap: { flex: 1, position: 'relative' },
  galleryOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', backgroundColor: 'rgba(9,61,42,0.55)', borderRadius: radii.md, justifyContent: 'center' },
  galleryCount: { color: colors.surface, fontFamily: typography.serif, fontSize: 24, fontWeight: '700' },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, padding: spacing.lg },
  pressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
  modalBackdrop: { backgroundColor: 'rgba(7,30,21,0.58)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: spacing.md, maxHeight: '92%', padding: spacing.xl },
  modalHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modalTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 24, fontWeight: '600' },
  input: { backgroundColor: colors.paleGreen, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, fontFamily: typography.sans, fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: 12 },
  shortText: { minHeight: 68, textAlignVertical: 'top' },
  longText: { minHeight: 110, textAlignVertical: 'top' },
  previewImage: { borderRadius: radii.md, height: 120, width: '100%' },
  photoButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', padding: 12 },
  photoButtonText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  publishButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 48 },
  publishText: { color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.58 },
});
