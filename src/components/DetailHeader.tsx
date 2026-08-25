import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, typography } from '@/theme';

interface DetailHeaderProps {
  title: string;
  light?: boolean;
}

export function DetailHeader({ title, light = false }: DetailHeaderProps) {
  const router = useRouter();
  const color = light ? colors.surface : colors.text;
  return (
    <View style={styles.container}>
      <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={[styles.back, light && styles.backLight]}>
        <Ionicons color={color} name="arrow-back" size={22} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color }]}>{title}</Text>
      <View style={styles.placeholder} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', height: 52, justifyContent: 'space-between' },
  back: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, height: 42, justifyContent: 'center', width: 42 },
  backLight: { backgroundColor: 'rgba(14,86,58,0.42)' },
  title: { flex: 1, fontFamily: typography.sans, fontSize: 15, fontWeight: '800', marginHorizontal: 12, textAlign: 'center' },
  placeholder: { width: 42 },
});
