import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/Buttons';
import { FormField } from '@/components/FormField';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { authMode, isLoading, signIn } = useAuth();
  const [email, setEmail] = useState(currentUser.email);
  const [password, setPassword] = useState('demo1234');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setError('');
    try {
      await signIn(email, password);
      router.replace('/(tabs)/home');
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No fue posible iniciar sesión.');
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
          <Text style={styles.title}>Bienvenido</Text>
          <Text style={styles.subtitle}>Ingresa a tu cuenta</Text>
          <View style={styles.form}>
            <FormField autoCapitalize="none" autoComplete="email" icon="person-outline" keyboardType="email-address" label="Correo o usuario" onChangeText={setEmail} placeholder="nombre@parquedelrecuerdo.cl" value={email} />
            <FormField icon="lock-closed-outline" label="Contraseña" onChangeText={setPassword} password placeholder="••••••••" value={password} />
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <View style={styles.helperRow}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} aria-checked={remember} onPress={() => setRemember((value) => !value)} style={styles.remember}>
                <View style={[styles.checkbox, remember && styles.checkboxActive]}>
                  {remember ? <Ionicons color={colors.surface} name="checkmark" size={14} /> : null}
                </View>
                <Text style={styles.helperText}>Recordarme</Text>
              </Pressable>
              <Pressable onPress={() => Alert.alert('Recuperar acceso', 'Contacta a tu coordinador o al equipo de soporte para restablecer tu contraseña.')}>
                <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
              </Pressable>
            </View>
            <AppButton label="Iniciar sesión" loading={isLoading} onPress={handleLogin} />
            <AppButton label="Crear cuenta" onPress={() => router.push('/(auth)/register')} variant="secondary" />
          </View>
          <View style={styles.demoTag}>
            <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={16} />
            <Text style={styles.demoText}>{authMode === 'demo' ? 'Modo demostración activo' : 'Conectado de forma segura'}</Text>
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
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 12 },
  helperRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  remember: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1.5, height: 21, justifyContent: 'center', width: 21 },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  helperText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12 },
  link: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  demoTag: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 6, marginTop: 17, paddingHorizontal: 12, paddingVertical: 7 },
  demoText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 7, paddingBottom: 30, paddingTop: 27 },
  footerText: { color: colors.textMuted, fontFamily: typography.serif, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
