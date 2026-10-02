import { Redirect, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { PreviewModeBanner } from '@/components/PreviewModeBanner';
import { UpdateController } from '@/components/UpdateController';
import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme';

function RootNavigator() {
  const { isLoading, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (Platform.OS === 'web') document.title = 'PDR Comercial';
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    if (user && inAuthGroup) router.replace(user.role === 'audiovisual' ? '/(tabs)/news' : '/(tabs)/home');
  }, [isLoading, router, segments, user]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <BrandLogo />
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const newsOnlyAllowed = segments[0] === 'news' || segments[0] === 'gallery' || (segments[0] === '(tabs)' && (segments[1] === 'news' || segments[1] === 'profile'));
  if (user?.role === 'audiovisual' && !newsOnlyAllowed) return <Redirect href="/(tabs)/news" />;

  return (
    <>
      <StatusBar style="dark" />
      <UpdateController />
      <View style={styles.app}>
        <Stack screenOptions={{ animation: 'fade', contentStyle: { backgroundColor: colors.background }, headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="goals" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="team" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="gallery" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="news/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <PreviewModeBanner />
      </View>
    </>
  );
}

export default function RootLayout() {
  return <AuthProvider><RootNavigator /></AuthProvider>;
}

const styles = StyleSheet.create({
  app: { flex: 1 },
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: 20, justifyContent: 'center' },
});
