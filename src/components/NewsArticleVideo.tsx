import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { newsService } from '@/services/newsService';
import { colors, radii, spacing, typography } from '@/theme';

import { NewsVideoSurface } from './NewsVideoSurface';

function useVideoSource(path: string, attempt = 0) {
  const [result, setResult] = useState<{ path: string; attempt: number; source?: string; error?: boolean }>();

  useEffect(() => {
    let active = true;
    newsService.resolveArticleVideo(path).then(
      source => { if (active) setResult({ path, attempt, source }); },
      () => { if (active) setResult({ path, attempt, error: true }); },
    );
    return () => { active = false; };
  }, [attempt, path]);

  return result?.path === path && result.attempt === attempt ? result : undefined;
}

export function NewsVideoPreview({ path }: { path: string }) {
  const media = useVideoSource(path);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!media?.source || failed) return null;

  return (
    <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, !ready && styles.loadingPreview]}>
      <NewsVideoSurface source={media.source} preview onReady={() => setReady(true)} onError={() => setFailed(true)} />
    </View>
  );
}

export function NewsArticleVideo({ path, onClose }: { path: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const media = useVideoSource(path, attempt);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar video" onPress={onClose} style={styles.close}>
          <Ionicons name="close" size={28} color={colors.surface} />
        </Pressable>
        <View style={styles.player}>
          {failed || media?.error ? (
            <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setAttempt(value => value + 1); }} style={styles.retry}>
              <Text style={styles.text} accessibilityLiveRegion="polite">No se pudo reproducir el video. Volver a intentar</Text>
            </Pressable>
          ) : media?.source ? (
            <NewsVideoSurface source={media.source} onError={() => setFailed(true)} />
          ) : (
            <ActivityIndicator color={colors.surface} accessibilityLabel="Cargando video" />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingPreview: { opacity: 0 },
  modal: { flex: 1, backgroundColor: '#07130f', justifyContent: 'center', padding: spacing.lg },
  close: { alignSelf: 'flex-end', borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,0.16)', padding: spacing.sm, marginBottom: spacing.sm },
  player: { width: '100%', maxWidth: 1100, aspectRatio: 16 / 9, alignSelf: 'center', backgroundColor: '#000', justifyContent: 'center' },
  retry: { padding: spacing.lg, alignSelf: 'center' },
  text: { color: colors.surface, fontFamily: typography.sans, textAlign: 'center' },
});
