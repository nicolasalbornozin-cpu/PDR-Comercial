import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadows, typography } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const items: { icon: IconName; label: string; route: '/(tabs)/home' | '/goals' | '/(tabs)/news' | '/(tabs)/profile' }[] = [
  { icon: 'home-outline', label: 'Inicio', route: '/(tabs)/home' },
  { icon: 'locate-outline', label: 'Mis metas', route: '/goals' },
  { icon: 'newspaper-outline', label: 'Noticias', route: '/(tabs)/news' },
  { icon: 'person-outline', label: 'Perfil', route: '/(tabs)/profile' },
];

export function SellerBottomNav() {
  const router = useRouter();
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = item.route === '/goals';
        return (
          <Pressable accessibilityRole="button" key={item.route} onPress={() => router.replace(item.route)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Ionicons color={active ? colors.primary : '#858D88'} name={item.icon} size={24} />
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            {active ? <View style={styles.activeMark} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { ...shadows.card, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, flexDirection: 'row', height: 78, left: 0, paddingBottom: 8, paddingTop: 7, position: 'absolute', right: 0 },
  item: { alignItems: 'center', flex: 1, gap: 3, justifyContent: 'center' },
  label: { color: '#858D88', fontFamily: typography.sans, fontSize: 10 },
  labelActive: { color: colors.primary, fontWeight: '800' },
  activeMark: { backgroundColor: colors.gold, borderRadius: 2, bottom: 0, height: 3, position: 'absolute', width: 18 },
  pressed: { opacity: 0.68 },
});
