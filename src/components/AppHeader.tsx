import { displayPersonName } from '@/utils/personName';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { IconButton } from '@/components/Buttons';
import { UserAvatar } from '@/components/UserAvatar';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { hasPilotRestrictions } from '@/utils/pilotNavigation';

export function AppHeader() {
  const router = useRouter();
  const { user } = useAuth();
  const notificationsLocked = hasPilotRestrictions(user?.role);
  return (
    <View style={styles.container}>
      <BrandLogo compact />
      <View style={styles.actions}>
        <IconButton badge={!notificationsLocked} disabled={notificationsLocked} icon={notificationsLocked ? 'lock-closed-outline' : 'notifications-outline'} label={notificationsLocked ? 'Notificaciones, bloqueadas durante el piloto' : 'Abrir notificaciones'} onPress={() => router.push('/notifications')} />
        <Pressable accessibilityLabel="Abrir perfil" onPress={() => router.push('/(tabs)/profile')}>
          <UserAvatar name={displayPersonName(user ?? currentUser)} size={42} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
});
