import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, ImageBackground, ImageSourcePropType, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/DetailHeader';
import { NewsCard } from '@/components/NewsCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { newsImages } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { useNewsContent } from '@/hooks/useNewsContent';
import { newsService } from '@/services/newsService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { NewsArticle } from '@/types';
import { formatDate } from '@/utils/format';

function articleImage(article: NewsArticle): ImageSourcePropType {
  return article.imageUrl ? { uri: article.imageUrl } : newsImages[article.image as keyof typeof newsImages] ?? newsImages.park;
}

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { authenticatedUser, isPreviewing } = useAuth();
  const { content, loading, refresh } = useNewsContent();
  const article = content.articles.find((item) => item.id === id) ?? content.articles[0];
  const related = article ? content.articles.find((item) => item.id !== article.id && item.category === article.category) ?? content.articles.find((item) => item.id !== article.id) : undefined;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isAdmin = authenticatedUser?.role === 'admin' && !isPreviewing;
  const articleGallery = article ? content.gallery.filter((photo) => photo.newsArticleId === article.id) : [];

  const openEditor = () => {
    if (!article) return;
    setTitle(article.title);
    setSummary(article.summary);
    setBody(article.body);
    setImageUrl(article.imageUrl);
    setEditing(true);
  };

  const pickImage = async () => {
    try {
      const url = await newsService.pickArticleImage();
      if (url) setImageUrl(url);
    } catch (cause) {
      Alert.alert('No se pudo subir la foto', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    }
  };

  const save = async () => {
    if (!article) return;
    setSaving(true);
    try {
      await newsService.updateArticle(article.id, { title, summary, body, imageUrl });
      await refresh();
      setEditing(false);
    } catch (cause) {
      Alert.alert('No se pudo guardar', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const addArticlePhoto = async () => {
    if (!article) return;
    setUploadingPhoto(true);
    try {
      if (await newsService.addGalleryPhoto(article.title, article.id)) await refresh();
    } catch (cause) {
      Alert.alert('No se pudo publicar la foto', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!article) {
    return <View style={styles.loadingPage}>{loading ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.body}>No se encontró la noticia.</Text>}</View>;
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={articleImage(article)} style={styles.hero}>
          <LinearGradient colors={['rgba(9,61,42,0.66)', 'rgba(9,61,42,0.04)', 'rgba(9,61,42,0.85)']} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <DetailHeader light title="Detalle de noticia" />
            <View style={styles.heroCopy}>
              <View style={styles.categoryBadge}><Text style={styles.categoryText}>{article.category.toUpperCase()}</Text></View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{article.title}</Text>
                {isAdmin ? <Pressable accessibilityLabel="Editar título" onPress={openEditor} style={styles.pencil}><Ionicons color={colors.primary} name="pencil" size={18} /></Pressable> : null}
              </View>
              <Text style={styles.date}>{formatDate(article.date)}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.articleCard}>
            <Text style={styles.summary}>{article.summary}</Text>
            <View style={styles.goldLine} />
            <Text style={styles.body}>{article.body}</Text>
            <View style={styles.galleryHeading}>
              <Text style={styles.galleryTitle}>Fotografías</Text>
              {isAdmin ? (
                <Pressable disabled={uploadingPhoto} onPress={addArticlePhoto} style={[styles.galleryAdd, uploadingPhoto && styles.disabled]}>
                  {uploadingPhoto ? <ActivityIndicator color={colors.primary} size="small" /> : <><Ionicons color={colors.primary} name="add-circle-outline" size={18} /><Text style={styles.galleryAddText}>Subir foto</Text></>}
                </Pressable>
              ) : null}
            </View>
            {articleGallery.length ? <View style={styles.articleGallery}>{articleGallery.map((photo) => <Image key={photo.id} source={photo.imageUrl ? { uri: photo.imageUrl } : newsImages.park} style={styles.articlePhoto} />)}</View> : <Text style={styles.photoEmpty}>Aún no hay fotografías adicionales.</Text>}
            {isAdmin ? (
              <Pressable accessibilityRole="button" onPress={openEditor} style={styles.bottomEdit}>
                <Ionicons color={colors.primary} name="pencil-outline" size={18} />
                <Text style={styles.bottomEditText}>Editar texto y fotografías</Text>
              </Pressable>
            ) : null}
          </View>

          {related ? (
            <View style={styles.relatedSection}>
              <Text style={styles.relatedTitle}>También te puede interesar</Text>
              <NewsCard article={related} onPress={() => router.replace({ pathname: '/news/[id]', params: { id: related.id } })} />
            </View>
          ) : null}
        </View>
      </View>

      <Modal animationType="slide" onRequestClose={() => setEditing(false)} transparent visible={editing}>
        <SafeAreaView style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Editar publicación</Text>
              <Pressable accessibilityLabel="Cerrar" onPress={() => setEditing(false)}><Ionicons color={colors.textMuted} name="close" size={24} /></Pressable>
            </View>
            <TextInput onChangeText={setTitle} placeholder="Título" placeholderTextColor={colors.textMuted} style={styles.input} value={title} />
            <TextInput multiline onChangeText={setSummary} placeholder="Resumen" placeholderTextColor={colors.textMuted} style={[styles.input, styles.summaryInput]} value={summary} />
            <TextInput multiline onChangeText={setBody} placeholder="Texto completo" placeholderTextColor={colors.textMuted} style={[styles.input, styles.bodyInput]} value={body} />
            <Image source={imageUrl ? { uri: imageUrl } : articleImage(article)} style={styles.imagePreview} />
            <Pressable onPress={pickImage} style={styles.photoButton}><Ionicons color={colors.primary} name="image-outline" size={19} /><Text style={styles.photoText}>Cambiar fotografía</Text></Pressable>
            <Pressable disabled={saving} onPress={save} style={[styles.saveButton, saving && styles.disabled]}>
              {saving ? <ActivityIndicator color={colors.surface} /> : <><Ionicons color={colors.surface} name="checkmark" size={20} /><Text style={styles.saveText}>Guardar para todos</Text></>}
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingPage: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 420 },
  heroInner: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: 2 },
  heroCopy: { gap: 8, paddingBottom: 44 },
  categoryBadge: { alignSelf: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 6 },
  categoryText: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  title: { color: colors.surface, flex: 1, fontFamily: typography.serif, fontSize: 32, fontWeight: '600', lineHeight: 38 },
  pencil: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: radii.pill, height: 40, justifyContent: 'center', width: 40 },
  date: { color: 'rgba(255,255,255,0.72)', fontFamily: typography.sans, fontSize: 11 },
  content: { gap: spacing.xxl, marginTop: -24, paddingHorizontal: spacing.xl },
  articleCard: { ...shadows.floating, backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.lg, padding: spacing.xxl },
  summary: { color: colors.primary, fontFamily: typography.serif, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  goldLine: { backgroundColor: colors.gold, height: 2, width: 42 },
  body: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, lineHeight: 23 },
  galleryHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  galleryTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 19, fontWeight: '600' },
  galleryAdd: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  galleryAddText: { color: colors.primary, fontFamily: typography.sans, fontSize: 10, fontWeight: '800' },
  articleGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  articlePhoto: { aspectRatio: 1.15, borderRadius: radii.md, width: '48%' },
  photoEmpty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  bottomEdit: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  bottomEditText: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  relatedSection: { gap: spacing.md },
  relatedTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  modalBackdrop: { backgroundColor: 'rgba(7,30,21,0.58)', flex: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: spacing.md, maxHeight: '94%', padding: spacing.xl },
  modalHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modalTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 24, fontWeight: '600' },
  input: { backgroundColor: colors.paleGreen, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, fontFamily: typography.sans, fontSize: 13, paddingHorizontal: spacing.md, paddingVertical: 12 },
  summaryInput: { minHeight: 72, textAlignVertical: 'top' },
  bodyInput: { minHeight: 125, textAlignVertical: 'top' },
  imagePreview: { borderRadius: radii.md, height: 130, width: '100%' },
  photoButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', padding: 12 },
  photoText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  saveButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', minHeight: 48 },
  saveText: { color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.58 },
});
