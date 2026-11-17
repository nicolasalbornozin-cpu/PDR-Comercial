import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { ScreenContainer } from '@/components/ScreenContainer';
import { colors, radii, spacing, typography } from '@/theme';

const androidInstaller = 'https://expo.dev/artifacts/eas/GAuNwjpZzEFmOtAhODz6wAGeye9VCTlniiUEOl_MaZo.apk';

export default function DownloadScreen() {
  return (
    <ScreenContainer contentContainerStyle={styles.page}>
      <View style={styles.card}>
        <BrandLogo />
        <Text accessibilityRole="header" style={styles.title}>PDR Comercial para Android</Text>
        <Text style={styles.copy}>Descarga la aplicación en tu celular. Abre el archivo descargado e inicia sesión con tu RUT y contraseña una vez instalada.</Text>
        <Link href={androidInstaller} style={styles.download}>Descargar para Android</Link>
        <Link href="/(auth)/login" style={styles.login}>Entrar desde el navegador</Link>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 500, alignSelf: 'center', padding: spacing.xl, gap: spacing.lg, borderRadius: radii.xl, backgroundColor: colors.surface },
  title: { fontFamily: typography.serif, fontSize: 32, color: colors.primary },
  copy: { fontFamily: typography.sans, fontSize: 16, color: colors.textMuted, lineHeight: 24 },
  download: { backgroundColor: colors.primary, textAlign: 'center', color: colors.surface, padding: spacing.md, borderRadius: radii.pill, fontWeight: '700' },
  login: { color: colors.primary, textAlign: 'center', padding: spacing.sm, fontWeight: '600' },
});
