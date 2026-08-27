import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/Buttons';
import { FormField } from '@/components/FormField';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { formatRut, normalizeRut } from '@/utils/rut';

export default function LoginScreen() {
  const router = useRouter();
  const { authMode, isLoading, requestPasswordReset, signIn } = useAuth();
  const [rut, setRut] = useState(authMode === 'demo' ? currentUser.rut : '');
  const [password, setPassword] = useState(authMode === 'demo' ? 'demo1234' : '');
  const [resetMode, setResetMode] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function handleRutChange(value: string) {
    setRut(formatRut(value));
  }

  async function handleLogin() {
    if (!normalizeRut(rut) || !password) {
      setError('Ingresa tu RUT y contraseña.');
      return;
    }
    setError('');
    try {
      await signIn(rut, password);
      router.replace('/(tabs)/home');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No fue posible iniciar sesión.');
    }
  }

  async function handleResetRequest() {
    setError('');
    setMessage('');
    try {
      await requestPasswordReset(rut);
      setMessage('Solicitud registrada. El administrador podrá restablecer tu acceso.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No fue posible registrar la solicitud.');
    }
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(248,247,243,0.12)', colors.background]} locations={[0.48, 1]} style={StyleSheet.absoluteFill} />
          <BrandLogo style={styles.logo} />
        </ImageBackground>

        <View style={styles.card}>
          <Text style={styles.title}>{resetMode ? 'Recuperar acceso' : 'Bienvenido'}</Text>
          <Text style={styles.subtitle}>
            {resetMode ? 'Avísale al administrador usando tu RUT' : 'Ingresa con tu RUT sin puntos ni guion'}
          </Text>
          <View style={styles.form}>
            <FormField
              autoCapitalize="characters"
              autoComplete="off"
              icon="card-outline"
              keyboardType="default"
              label="RUT"
              maxLength={12}
              onChangeText={handleRutChange}
              placeholder="12.345.678-9"
              value={rut}
            />
            {!resetMode ? (
              <FormField icon="lock-closed-outline" label="Contraseña" onChangeText={setPassword} password placeholder="••••••••" value={password} />
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}

            {resetMode ? (
              <>
                <AppButton label="Enviar solicitud" onPress={handleResetRequest} />
                <AppButton label="Volver al inicio" onPress={() => { setResetMode(false); setError(''); setMessage(''); }} variant="secondary" />
              </>
            ) : (
              <>
                <AppButton label="Iniciar sesión" loading={isLoading} onPress={handleLogin} />
                <Pressable onPress={() => { setResetMode(true); setError(''); setMessage(''); }} style={styles.forgotButton}>
                  <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </>
            )}
          </View>
          <View style={styles.demoTag}>
            <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={16} />
            <Text style={styles.demoText}>{authMode === 'demo' ? 'Modo demostración activo' : 'Acceso administrado y seguro'}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Ionicons color={colors.gold} name="leaf-outline" size={25} />
          <Text style={styles.footerText}>Tu avance, tus metas y tu equipo{`\n`}en un solo lugar.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background },
  mobileFrame: { flex: 1, maxWidth: 520, width: '100%' },
  hero: { height: 272, overflow: 'hidden' },
  logo: { alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: radii.md, marginTop: 23, paddingHorizontal: 18, paddingVertical: 11 },
  card: { ...shadows.floating, backgroundColor: colors.surface, borderRadius: radii.xl, marginHorizontal: spacing.xl, marginTop: -64, padding: spacing.xxl },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, marginTop: 4 },
  form: { gap: 15, marginTop: 24 },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 12, lineHeight: 17 },
  success: { backgroundColor: colors.softGreen, borderRadius: radii.sm, color: colors.success, fontFamily: typography.sans, fontSize: 12, lineHeight: 17, padding: spacing.md },
  forgotButton: { alignItems: 'center', paddingVertical: spacing.sm },
  link: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  demoTag: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 6, marginTop: 17, paddingHorizontal: 12, paddingVertical: 7 },
  demoText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 7, paddingBottom: 30, paddingTop: 27 },
  footerText: { color: colors.textMuted, fontFamily: typography.serif, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
