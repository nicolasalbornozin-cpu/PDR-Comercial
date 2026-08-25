import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '@/hooks/useAuth';
import { colors } from '@/theme';

export default function IndexScreen() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <BrandLogo />
        <ActivityIndicator color={colors.gold} size="small" />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)/home' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  loading: { alignItems: 'center', backgroundColor: colors.background, flex: 1, gap: 22, justifyContent: 'center' },
});
