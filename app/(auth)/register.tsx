import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/Buttons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Volver" onPress={() => router.back()} style={styles.back}>
            <Ionicons color={colors.primary} name="arrow-back" size={22} />
          </Pressable>
          <BrandLogo compact />
          <View style={styles.placeholder} />
        </View>
        <View style={styles.card}>
          <View style={styles.icon}><Ionicons color={colors.gold} name="shield-checkmark-outline" size={34} /></View>
          <Text style={styles.title}>Cuentas administradas</Text>
          <Text style={styles.body}>Por seguridad, las cuentas no se crean desde el teléfono. El administrador registra cada RUT y asigna el perfil de vendedor, coordinador o jefe de ventas.</Text>
          <AppButton label="Volver a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 30 },
  mobileFrame: { maxWidth: 520, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  back: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, height: 42, justifyContent: 'center', width: 42 },
  placeholder: { width: 42 },
  card: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.xl, marginHorizontal: spacing.xl, marginTop: spacing.xxxl, padding: spacing.xxl },
  icon: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.pill, height: 68, justifyContent: 'center', width: 68 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 30, fontWeight: '600', textAlign: 'center' },
  body: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, lineHeight: 22, textAlign: 'center' },
});
