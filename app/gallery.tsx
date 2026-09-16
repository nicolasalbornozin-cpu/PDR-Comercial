import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/DetailHeader';
import { NewsPhoto } from '@/components/NewsPhoto';
import { ScreenContainer } from '@/components/ScreenContainer';
import { newsImages } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { useNewsContent } from '@/hooks/useNewsContent';
import { newsService } from '@/services/newsService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { GalleryPhoto } from '@/types';

export default function GalleryScreen() {
  const { authenticatedUser, isPreviewing } = useAuth();
  const { content, loading, refresh } = useNewsContent();
  const [selected, setSelected] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string>();
  const carouselRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const isAdmin = authenticatedUser?.role === 'admin' && !isPreviewing;
  const photos = content.gallery.filter((photo) => !photo.newsArticleId);

  const addPhoto = async () => {
    setUploading(true);
    try {
      if (await newsService.addGalleryPhotos('Paseo Senior 2026')) await refresh();
    } catch (cause) {
      await refresh();
      Alert.alert('No se pudo publicar la foto', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = (photo: GalleryPhoto) => {
    Alert.alert('Eliminar fotografía', 'La fotografía dejará de aparecer para todos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setDeletingId(photo.id);
          newsService.deleteGalleryPhoto(photo).then(refresh).catch((cause) => {
            Alert.alert('No se pudo eliminar', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
          }).finally(() => setDeletingId(undefined));
        },
      },
    ]);
  };

  const movePhoto = (step: number) => {
    if (selected === null) return;
    const next = Math.max(0, Math.min(photos.length - 1, selected + step));
    setSelected(next);
    carouselRef.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <DetailHeader title="Galería" />
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>Paseo Senior 2026</Text>
              <Text style={styles.subtitle}>Momentos para celebrar y recordar juntos.</Text>
            </View>
            {isAdmin ? (
              <Pressable disabled={uploading} onPress={addPhoto} style={[styles.addButton, uploading && styles.disabled]}>
                {uploading ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons color={colors.surface} name="add" size={22} />}
              </Pressable>
            ) : null}
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
        <View style={styles.grid}>
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.photoTile}>
              <Pressable accessibilityLabel={`Abrir fotografía ${index + 1}`} onPress={() => setSelected(index)} style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}>
                <NewsPhoto fallback={newsImages.seniorEvent} resizeMode="contain" style={styles.image} url={photo.imageUrl} />
                <View style={styles.imageNumber}><Text style={styles.imageNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
              </Pressable>
              {isAdmin ? (
                <Pressable accessibilityLabel={`Eliminar fotografía ${index + 1}`} disabled={deletingId === photo.id} onPress={() => deletePhoto(photo)} style={styles.deleteButton}>
                  {deletingId === photo.id ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons color={colors.surface} name="trash-outline" size={17} />}
                </Pressable>
              ) : null}
            </View>
          ))}
          {!photos.length && !loading ? <Text style={styles.empty}>Aún no hay fotos publicadas. Usa + para agregar la primera.</Text> : null}
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setSelected(null)} transparent visible={selected !== null}>
        <SafeAreaView style={styles.modal}>
          <Pressable accessibilityLabel="Cerrar fotografía" onPress={() => setSelected(null)} style={styles.close}>
            <Ionicons color={colors.surface} name="close" size={26} />
          </Pressable>
          <ScrollView
            horizontal
            onLayout={() => { if (selected !== null) carouselRef.current?.scrollTo({ x: selected * width, animated: false }); }}
            onMomentumScrollEnd={(event) => setSelected(Math.round(event.nativeEvent.contentOffset.x / width))}
            pagingEnabled
            ref={carouselRef}
            showsHorizontalScrollIndicator={false}
            style={styles.photoPager}
          >
            {photos.map((photo) => (
              <View key={photo.id} style={[styles.photoPage, { width }]}>
                <NewsPhoto fallback={newsImages.seniorEvent} resizeMode="contain" style={styles.fullImage} url={photo.imageUrl} />
              </View>
            ))}
          </ScrollView>
          {selected !== null && selected > 0 ? <Pressable accessibilityLabel="Fotografía anterior" onPress={() => movePhoto(-1)} style={[styles.arrow, styles.previous]}><Ionicons color={colors.surface} name="chevron-back" size={24} /></Pressable> : null}
          {selected !== null && selected < photos.length - 1 ? <Pressable accessibilityLabel="Fotografía siguiente" onPress={() => movePhoto(1)} style={[styles.arrow, styles.next]}><Ionicons color={colors.surface} name="chevron-forward" size={24} /></Pressable> : null}
          <Text style={styles.counter}>{selected !== null ? `${selected + 1} / ${photos.length}` : ''}</Text>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: 2 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  titleCopy: { flex: 1 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 31, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 4 },
  addButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 46, justifyContent: 'center', width: 46 },
  loader: { paddingTop: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  photoTile: { aspectRatio: 0.86, position: 'relative', width: '46%' },
  imageButton: { ...shadows.card, borderRadius: radii.lg, height: '100%', overflow: 'hidden', position: 'relative', width: '100%' },
  image: { backgroundColor: colors.softGreen, height: '100%', width: '100%' },
  imageNumber: { backgroundColor: 'rgba(9,61,42,0.72)', borderRadius: radii.pill, bottom: 10, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 10 },
  imageNumberText: { color: colors.surface, fontFamily: typography.sans, fontSize: 9, fontWeight: '800' },
  deleteButton: { alignItems: 'center', backgroundColor: 'rgba(171,54,48,0.92)', borderRadius: radii.pill, height: 36, justifyContent: 'center', position: 'absolute', right: 9, top: 9, width: 36, zIndex: 2 },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, paddingVertical: spacing.xxl, textAlign: 'center', width: '100%' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.58 },
  modal: { alignItems: 'center', backgroundColor: 'rgba(5,23,16,0.96)', flex: 1, justifyContent: 'center' },
  close: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radii.pill, height: 45, justifyContent: 'center', position: 'absolute', right: spacing.xl, top: spacing.xl, width: 45, zIndex: 2 },
  photoPager: { flex: 1, width: '100%' },
  photoPage: { alignItems: 'center', justifyContent: 'center' },
  fullImage: { height: '78%', width: '100%' },
  arrow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radii.pill, height: 42, justifyContent: 'center', position: 'absolute', top: '48%', width: 42 },
  previous: { left: spacing.md },
  next: { right: spacing.md },
  counter: { bottom: 40, color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800', position: 'absolute' },
});
