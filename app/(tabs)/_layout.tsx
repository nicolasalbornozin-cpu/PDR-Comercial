import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ focused, active, inactive }: { focused: boolean; active: IconName; inactive: IconName }) {
  return (
    <View style={styles.iconContainer}>
      <Ionicons color={focused ? colors.primary : '#9AA49D'} name={focused ? active : inactive} size={23} />
      {focused ? <View style={styles.activeMark} /> : null}
    </View>
  );
}

export default function TabLayout() {
  const { user } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#98A29B',
        tabBarLabelStyle: { fontFamily: typography.sans, fontSize: 10, fontWeight: '700', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: '#EDF0ED',
          height: 74,
          paddingBottom: 9,
          paddingTop: 7,
        },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Inicio', tabBarIcon: ({ focused }) => <TabIcon active="home" focused={focused} inactive="home-outline" /> }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarIcon: ({ focused }) => <TabIcon active="trophy" focused={focused} inactive="trophy-outline" /> }} />
      <Tabs.Screen name="news" options={{ title: 'Noticias', tabBarIcon: ({ focused }) => <TabIcon active="newspaper" focused={focused} inactive="newspaper-outline" /> }} />
      <Tabs.Screen name="admin" options={{ href: user?.role === 'admin' ? '/(tabs)/admin' : null, title: 'Administrar', tabBarIcon: ({ focused }) => <TabIcon active="settings" focused={focused} inactive="settings-outline" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon active="person-circle" focused={focused} inactive="person-circle-outline" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: { alignItems: 'center', height: 31, justifyContent: 'center', position: 'relative', width: 42 },
  activeMark: { backgroundColor: colors.gold, borderRadius: 2, bottom: -5, height: 3, position: 'absolute', width: 15 },
});
