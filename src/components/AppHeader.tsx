import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { IconButton } from '@/components/Buttons';
import { UserAvatar } from '@/components/UserAvatar';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';

export function AppHeader() {
  const router = useRouter();
  const { user } = useAuth();
  return (
    <View style={styles.container}>
      <BrandLogo compact />
      <View style={styles.actions}>
        <IconButton badge icon="notifications-outline" label="Abrir notificaciones" onPress={() => router.push('/notifications')} />
        <Pressable accessibilityLabel="Abrir perfil" onPress={() => router.push('/(tabs)/profile')}>
          <UserAvatar name={user?.name ?? currentUser.name} size={42} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
});
