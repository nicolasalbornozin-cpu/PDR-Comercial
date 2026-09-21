import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { newsImages } from '@/data/assets';
import { colors, radii, spacing, typography } from '@/theme';
import { GalleryPhoto } from '@/types';

import { NewsPhoto } from './NewsPhoto';

export function NewsPhotoViewer({ photos, initialIndex, onClose }: { photos: GalleryPhoto[]; initialIndex: number; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pageHeight = Math.max(1, height - insets.top - insets.bottom);
  const start = Math.max(0, Math.min(initialIndex, photos.length - 1));
  const [selected, setSelected] = useState(start);
  const pager = useRef<FlatList<GalleryPhoto>>(null);
  const move = (step: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, selected + step));
    setSelected(next);
    pager.current?.scrollToIndex({ index: next, animated: true });
  };
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <SafeAreaView style={styles.modal}>
        <FlatList
          data={photos}
          extraData={selected}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          horizontal
          initialNumToRender={1}
          initialScrollIndex={start}
          keyExtractor={(photo) => photo.id}
          maxToRenderPerBatch={2}
          onMomentumScrollEnd={(event) => setSelected(Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))))}
          pagingEnabled
          ref={pager}
          renderItem={({ item, index }) => (
            <View style={[styles.page, { width, height: pageHeight }]}>
              {Math.abs(index - selected) <= 1 ? <NewsPhoto fallback={newsImages.seniorEvent} resizeMode="contain" style={[styles.photo, { height: pageHeight * 0.78 }]} url={item.imageUrl} /> : null}
            </View>
          )}
          showsHorizontalScrollIndicator={false}
          style={styles.pager}
          windowSize={3}
        />
        <Pressable accessibilityLabel="Cerrar fotografía" onPress={onClose} style={styles.close}><Ionicons color={colors.surface} name="close" size={27} /></Pressable>
        {selected > 0 ? <Pressable accessibilityLabel="Fotografía anterior" onPress={() => move(-1)} style={[styles.arrow, styles.previous]}><Ionicons color={colors.surface} name="chevron-back" size={25} /></Pressable> : null}
        {selected < photos.length - 1 ? <Pressable accessibilityLabel="Fotografía siguiente" onPress={() => move(1)} style={[styles.arrow, styles.next]}><Ionicons color={colors.surface} name="chevron-forward" size={25} /></Pressable> : null}
        <Text style={styles.counter}>{selected + 1} / {photos.length}</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: { backgroundColor: 'rgba(5,23,16,0.97)', flex: 1 },
  pager: { flex: 1 },
  page: { alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%' },
  close: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.pill, height: 45, justifyContent: 'center', position: 'absolute', right: spacing.xl, top: spacing.xl, width: 45 },
  arrow: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.pill, height: 42, justifyContent: 'center', position: 'absolute', top: '48%', width: 42 },
  previous: { left: spacing.md },
  next: { right: spacing.md },
  counter: { alignSelf: 'center', bottom: 40, color: colors.surface, fontFamily: typography.sans, fontSize: 12, fontWeight: '800', position: 'absolute' },
});
