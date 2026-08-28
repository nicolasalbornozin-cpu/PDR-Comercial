import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { roleLabels } from '@/types';

export function PreviewModeBanner() {
  const router = useRouter();
  const segments = useSegments();
  const { isPreviewing, stopPreview, user } = useAuth();

  if (!isPreviewing || !user) return null;

  function returnToAdmin() {
    stopPreview();
    router.replace('/(tabs)/profile');
  }

  const aboveTabBar = segments[0] === '(tabs)';

  return (
    <View style={[styles.overlay, aboveTabBar ? styles.aboveTabs : styles.aboveEdge]}>
      <Pressable
        accessibilityHint="Finaliza la simulación y vuelve al perfil real del administrador"
        accessibilityLabel="Volver al modo administrador"
        accessibilityRole="button"
        onPress={returnToAdmin}
        style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
      >
        <View style={styles.previewIcon}>
          <Ionicons color={colors.goldOnDark} name="eye-outline" size={18} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={styles.eyebrow}>VISTA PREVIA · {roleLabels[user.role].toUpperCase()}</Text>
          <Text numberOfLines={1} style={styles.name}>{user.name}</Text>
        </View>
        <View style={styles.returnAction}>
          <Text style={styles.returnText}>Volver a administrador</Text>
          <Ionicons color={colors.primary} name="return-up-back" size={17} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', left: spacing.md, pointerEvents: 'box-none', position: 'absolute', right: spacing.md, zIndex: 1000 },
  aboveTabs: { bottom: 84 },
  aboveEdge: { bottom: spacing.lg },
  banner: {
    ...shadows.floating,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.gold,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: 680,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  previewIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radii.pill, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.goldOnDark, fontFamily: typography.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  name: { color: colors.surface, fontFamily: typography.sans, fontSize: 11, fontWeight: '800', marginTop: 2 },
  returnAction: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  returnText: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '900' },
});
