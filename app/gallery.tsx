import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NewsArticleComposer } from '@/components/NewsArticleComposer';
import { NewsDeleteButton } from '@/components/NewsDeleteButton';

import { DetailHeader } from '@/components/DetailHeader';
import { NewsPhoto } from '@/components/NewsPhoto';
import { NewsPhotoViewer } from '@/components/NewsPhotoViewer';
import { ScreenContainer } from '@/components/ScreenContainer';
import { newsImages } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { canEditNews } from '@/utils/permissions';
import { useNewsContent } from '@/hooks/useNewsContent';
import { newsService } from '@/services/newsService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { GalleryPhoto } from '@/types';
import { seniorTrips, tripPhotos } from '@/utils/newsTrips';

export default function GalleryScreen() {
  const params = useLocalSearchParams<{ trip?: string }>();
  const router = useRouter();
  const { authenticatedUser, isPreviewing } = useAuth();
  const { content, loading, refresh } = useNewsContent();
  const [selected, setSelected] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deletingId, setDeletingId] = useState<string>();
  const [tripId, setTripId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const isAdmin = canEditNews(authenticatedUser?.role) && !isPreviewing;
  const trips = seniorTrips(content.articles);
  const trip = trips.find(item => item.id === (tripId ?? params.trip)) ?? trips[0];
  const photos = tripPhotos(content.articles, content.gallery, trip);

  const addPhoto = async () => {
    if (!trip || uploading) return;
    setUploading(true);
    try {
      if (await newsService.addGalleryPhotos(trip.title, trip.id, (completed, total) => setUploadProgress(`Procesando ${completed} de ${total} fotos…`))) await refresh();
    } catch (cause) {
      await refresh();
      Alert.alert('No se pudo publicar la foto', cause instanceof Error ? cause.message : 'Intenta nuevamente.');
    } finally {
      setUploading(false);
      setUploadProgress('');
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

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <DetailHeader title="Galería" />
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.title}>{trip?.title ?? 'Galería Paseo Senior'}</Text>
              <Text style={styles.subtitle}>{trip?.summary ?? 'Crea un paseo para empezar a compartir sus fotografías.'}</Text>
            </View>
            {isAdmin && trip ? (
              <Pressable accessibilityLabel="Subir fotos a este paseo" disabled={uploading} onPress={addPhoto} style={[styles.addButton, uploading && styles.disabled]}>
                {uploading ? <ActivityIndicator color={colors.surface} size="small" /> : <Ionicons color={colors.surface} name="add" size={22} />}
              </Pressable>
            ) : null}
          </View>
          <View style={styles.tripHeading}><Text style={styles.tripLabel}>Otros paseos</Text>{isAdmin ? <Pressable accessibilityLabel="Crear otro paseo" disabled={uploading} onPress={() => setCreating(true)} style={styles.newTrip}><Ionicons name="add-circle-outline" size={19} color={colors.primary}/><Text style={styles.tripLabel}>Crear paseo</Text></Pressable> : null}</View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tripList}>
            {trips.map((item, index) => <View key={item.id} style={[styles.tripChip, item.id === trip?.id && styles.selectedTrip]}>
              <Pressable disabled={uploading} onPress={() => { setTripId(item.id); setSelected(null); }} style={styles.tripPick}><Text style={[styles.tripText, item.id === trip?.id && styles.selectedText]}>{item.title}{index === 0 ? ' · Último paseo' : ''}</Text></Pressable>
              {isAdmin ? <NewsDeleteButton label={item.title} onDelete={async () => { await newsService.deleteArticle(item.id); setSelected(null); await refresh(); }}/>:null}
            </View>)}
          </ScrollView>
          {isAdmin && trip ? <Pressable onPress={() => router.push({ pathname: '/news/[id]', params: { id: trip.id, edit: '1' } })} style={styles.newTrip}><Ionicons name="pencil-outline" color={colors.primary} size={18}/><Text style={styles.tripLabel}>Editar título, descripción y portada</Text></Pressable> : null}
        </View>
        {loading ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
        {uploading && uploadProgress ? <Text accessibilityLiveRegion="polite" style={styles.empty}>{uploadProgress}</Text> : null}
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

      {selected !== null && photos.length ? <NewsPhotoViewer initialIndex={selected} onClose={() => setSelected(null)} photos={photos} /> : null}
      {creating ? <NewsArticleComposer category="Paseos" onClose={() => setCreating(false)} onPublished={async id => { await refresh(); setTripId(id); setSelected(null); }}/> : null}
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
  tripHeading: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  tripLabel: { color: colors.primary, fontFamily: typography.sans, fontWeight: '700', fontSize: 12 },
  newTrip: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  tripList: { paddingVertical: 10, gap: 10 },
  tripChip: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 6, backgroundColor: colors.softGreen, borderRadius: radii.md },
  selectedTrip: { backgroundColor: colors.primary },
  tripPick: { padding: 9 }, tripText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12 }, selectedText: { color: colors.surface },
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
