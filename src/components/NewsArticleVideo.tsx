import { Ionicons } from '@expo/vector-icons';
import { createElement, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { newsService } from '@/services/newsService';
import { colors, radii, spacing, typography } from '@/theme';

export function NewsArticleVideo({ path }: { path: string }) {
  const [source, setSource] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function play() {
    setBusy(true);
    setError('');
    try {
      const url = await newsService.resolveArticleVideo(path);
      if (Platform.OS === 'web') setSource(url);
      else await Linking.openURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el video.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {Platform.OS === 'web' && source ? createElement('video', {
        src: source,
        controls: true,
        playsInline: true,
        preload: 'metadata',
        'aria-label': 'Video de la actividad',
        style: { display: 'block', width: '100%', borderRadius: 12, background: '#0b1712', aspectRatio: '16 / 9' },
        onError: () => {
          setSource(undefined);
          setError('No se pudo reproducir el video. Vuelve a intentarlo.');
        },
      }) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Ver video" disabled={busy} onPress={play} style={styles.button}>
          {busy ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="play-circle-outline" size={22} color={colors.primary} />}
          <Text style={styles.label}>{busy ? 'Abriendo video…' : 'Ver video'}</Text>
        </Pressable>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  button: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: colors.softGreen },
  label: { color: colors.primary, fontFamily: typography.sans, fontWeight: '700' },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 13 },
});
