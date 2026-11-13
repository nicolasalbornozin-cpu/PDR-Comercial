import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, typography } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { bottomNavigationMetrics } from '@/utils/bottomNavigation';
import { isPilotMode } from '@/utils/pilotNavigation';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabButton = NonNullable<import('expo-router/build/react-navigation/bottom-tabs').BottomTabNavigationOptions['tabBarButton']>;

function TabIcon({ focused, active, inactive }: { focused: boolean; active: IconName; inactive: IconName }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Ionicons accessible={false} allowFontScaling={false} color={focused ? colors.primaryDark : colors.textMuted} name={focused ? active : inactive} size={23} />
    </View>
  );
}

function lockedTab(title: string) {
  const label = `${title}, bloqueado durante el piloto`;
  const tabBarButton: TabButton = ({ children, style }) => (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ disabled: true }} disabled style={style}>
      {children}
    </Pressable>
  );
  return {
    title,
    tabBarAccessibilityLabel: label,
    tabBarIcon: () => <TabIcon active="lock-closed" focused={false} inactive="lock-closed-outline" />,
    tabBarButton,
  };
}

export default function TabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const navigation = bottomNavigationMetrics(width, insets, fontScale);
  const newsOnly = user?.role === 'audiovisual';
  return (
    <Tabs
      initialRouteName={newsOnly ? 'news' : isPilotMode ? 'ranking' : 'home'}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: styles.iconSlot,
        tabBarItemStyle: styles.item,
        tabBarLabel: ({ children, focused }) => <Text adjustsFontSizeToFit minimumFontScale={0.85} numberOfLines={1} style={[styles.label, focused && styles.labelActive]}>{children === 'Administrar' && width < 360 ? 'Admin' : children}</Text>,
        tabBarStyle: [styles.bar, {
          width: navigation.width,
          height: navigation.height,
          marginBottom: navigation.bottomGap,
          marginTop: navigation.topGap,
        }],
      }}
    >
      <Tabs.Screen name="home" options={isPilotMode && !newsOnly ? lockedTab('Inicio') : { href: newsOnly ? null : '/(tabs)/home', title: 'Inicio', tabBarAccessibilityLabel: 'Inicio', tabBarIcon: ({ focused }) => <TabIcon active="home" focused={focused} inactive="home-outline" /> }} />
      <Tabs.Screen name="ranking" options={{ href: user?.role === 'audiovisual' ? null : '/(tabs)/ranking', title: 'Ranking', tabBarAccessibilityLabel: 'Ranking', tabBarIcon: ({ focused }) => <TabIcon active="trophy" focused={focused} inactive="trophy-outline" /> }} />
      <Tabs.Screen name="news" options={{ title: 'Noticias', tabBarAccessibilityLabel: 'Noticias', tabBarIcon: ({ focused }) => <TabIcon active="newspaper" focused={focused} inactive="newspaper-outline" /> }} />
      <Tabs.Screen name="admin" options={isPilotMode && user?.role === 'admin' ? lockedTab('Administrar') : { href: user?.role === 'admin' ? '/(tabs)/admin' : null, title: 'Administrar', tabBarAccessibilityLabel: 'Administrar', tabBarIcon: ({ focused }) => <TabIcon active="settings" focused={focused} inactive="settings-outline" /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon active="person" focused={focused} inactive="person-outline" /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    borderWidth: 1,
    borderRadius: 30,
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 5,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.11,
    shadowRadius: 18,
    elevation: 8,
  },
  item: { minHeight: 64 },
  iconSlot: { height: 42, width: 42 },
  iconContainer: { alignItems: 'center', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  iconContainerActive: { backgroundColor: colors.gold },
  label: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, fontWeight: '600', lineHeight: 14, marginTop: 2 },
  labelActive: { color: colors.primary, fontWeight: '800' },
});
