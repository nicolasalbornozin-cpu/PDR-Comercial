import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DetailHeader } from '@/components/DetailHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { newsImages } from '@/data/assets';
import { galleryImages } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function GalleryScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <DetailHeader title="Galería" />
          <Text style={styles.title}>Paseo Senior 2026</Text>
          <Text style={styles.subtitle}>Momentos para celebrar y recordar juntos.</Text>
        </View>
        <View style={styles.grid}>
          {galleryImages.map((imageKey, index) => (
            <Pressable accessibilityLabel={`Abrir fotografía ${index + 1}`} key={`${imageKey}-${index}`} onPress={() => setSelected(index)} style={({ pressed }) => [styles.imageButton, pressed && styles.pressed]}>
              <Image source={newsImages[imageKey]} style={styles.image} />
              <View style={styles.imageNumber}><Text style={styles.imageNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
            </Pressable>
          ))}
        </View>
      </View>

      <Modal animationType="fade" onRequestClose={() => setSelected(null)} transparent visible={selected !== null}>
        <SafeAreaView style={styles.modal}>
          <Pressable accessibilityLabel="Cerrar fotografía" onPress={() => setSelected(null)} style={styles.close}>
            <Ionicons color={colors.surface} name="close" size={26} />
          </Pressable>
          {selected !== null ? <Image resizeMode="contain" source={newsImages[galleryImages[selected]]} style={styles.fullImage} /> : null}
          <Text style={styles.counter}>{selected !== null ? `${selected + 1} / ${galleryImages.length}` : ''}</Text>
        </SafeAreaView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: 2 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 31, fontWeight: '600', marginTop: spacing.xl },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  imageButton: { ...shadows.card, aspectRatio: 0.86, borderRadius: radii.lg, overflow: 'hidden', position: 'relative', width: '47.8%' },
  image: { height: '100%', width: '100%' },
  imageNumber: { backgroundColor: 'rgba(9,61,42,0.72)', borderRadius: radii.pill, bottom: 10, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute', right: 10 },
  imageNumberText: { color: colors.surface, fontFamily: typography.sans, fontSize: 9, fontWeight: '800' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  modal: { alignItems: 'center', backgroundColor: 'rgba(5,23,16,0.96)', flex: 1, justifyContent: 'center' },
  close: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radii.pill, height: 45, justifyContent: 'center', position: 'absolute', right: spacing.xl, top: spacing.xl, width: 45, zIndex: 2 },
  fullImage: { height: '78%', width: '100%' },
  counter: { bottom: 40, color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800', position: 'absolute' },
});
