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
import { demoAdminUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/authService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { isStrongRegistrationPassword } from '@/utils/registration';
import { formatRut, isValidRut } from '@/utils/rut';

export default function LoginScreen() {
  const router = useRouter();
  const { authMode, isLoading, requestPasswordReset, signIn } = useAuth();
  const [rut, setRut] = useState(authMode === 'demo' ? demoAdminUser.rut : '');
  const [password, setPassword] = useState(authMode === 'demo' ? 'demo1234' : '');
  const [mode, setMode] = useState<'login' | 'recover' | 'request'>('login');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const matching = newPassword.length > 0 && newPassword === confirmation;
  const readyToRecover = matching && isStrongRegistrationPassword(newPassword) && /^\d{6,10}$/.test(recoveryCode.trim());
  const title = mode === 'recover' ? 'Restablecer contraseña' : mode === 'request' ? 'Solicitar recuperación' : 'Bienvenido';

  function changeMode(next: typeof mode) {
    setPassword('');
    setNewPassword('');
    setConfirmation('');
    setRecoveryCode('');
    setError('');
    setMessage('');
    setMode(next);
  }

  function handleRutChange(value: string) {
    setRut(formatRut(value));
    setError('');
  }

  async function handleLogin() {
    if (!isValidRut(rut)) {
      setError('Ingresa un RUT válido.');
      return;
    }
    if (password === '') {
      changeMode('recover');
      return;
    }
    setError('');
    try {
      await signIn(rut, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'No fue posible iniciar sesión.');
    }
  }

  async function handleResetRequest() {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await requestPasswordReset(rut);
      setMessage('Si el RUT tiene una cuenta activa, la solicitud quedó registrada.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No fue posible registrar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRecover() {
    if (busy || !readyToRecover) return;
    setBusy(true);
    setError('');
    try {
      await authService.recoverPassword(rut, recoveryCode, newPassword, confirmation);
      changeMode('login');
      setMessage('Contraseña actualizada. Inicia sesión con tu RUT y tu nueva contraseña.');
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'No fue posible restablecer la contraseña.');
    } finally {
      setBusy(false);
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
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {mode === 'recover'
              ? 'Escribe el código que te entregó el administrador y elige tu nueva contraseña.'
              : mode === 'request' ? 'Envía una solicitud al administrador usando tu RUT.' : 'Ingresa con tu RUT sin puntos ni guion'}
          </Text>
          <View style={styles.form}>
            <FormField
              autoCapitalize="characters"
              autoComplete="off"
              editable={!busy}
              icon="card-outline"
              keyboardType="default"
              label="RUT"
              maxLength={12}
              onChangeText={handleRutChange}
              placeholder="12.345.678-9"
              value={rut}
            />
            {mode === 'login' ? (
              <FormField icon="lock-closed-outline" label="Contraseña" onChangeText={setPassword} password placeholder="••••••••" value={password} />
            ) : null}
            {mode === 'recover' ? (
              <>
                <FormField autoComplete="one-time-code" editable={!busy} icon="key-outline" keyboardType="number-pad" label="Código de recuperación" maxLength={10} onChangeText={(value) => { setRecoveryCode(value); setError(''); }} value={recoveryCode} />
                <FormField autoCapitalize="none" autoComplete="new-password" confirmed={matching} editable={!busy} icon="lock-closed-outline" label="Nueva contraseña" maxLength={72} onChangeText={(value) => { setNewPassword(value); setError(''); }} password value={newPassword} />
                <Text style={styles.subtitle}>Usa 8 o más caracteres, con mayúscula, minúscula y número.</Text>
                <FormField autoCapitalize="none" autoComplete="new-password" confirmed={matching} editable={!busy} icon="lock-closed-outline" label="Confirmar nueva contraseña" maxLength={72} onChangeText={(value) => { setConfirmation(value); setError(''); }} password value={confirmation} />
                {confirmation ? <Text accessibilityLiveRegion="polite" style={matching ? styles.match : styles.error}>{matching ? 'Las contraseñas coinciden.' : 'Las contraseñas no coinciden.'}</Text> : null}
              </>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}

            {mode === 'recover' ? (
              <>
                <AppButton disabled={!readyToRecover} label="Guardar nueva contraseña" loading={busy} onPress={handleRecover} />
                <AppButton disabled={busy} label="Solicitar ayuda al administrador" onPress={() => changeMode('request')} variant="ghost" />
                <AppButton disabled={busy} label="Volver a iniciar sesión" onPress={() => changeMode('login')} variant="secondary" />
              </>
            ) : mode === 'request' ? (
              <>
                <AppButton label="Enviar solicitud" loading={busy} onPress={handleResetRequest} />
                <AppButton disabled={busy} label="Volver a recuperar contraseña" onPress={() => changeMode('recover')} variant="secondary" />
              </>
            ) : (
              <>
                <AppButton label="Iniciar sesión" loading={isLoading} onPress={handleLogin} />
                <AppButton label="Primera vez · Crear contraseña" onPress={() => router.push('/(auth)/register')} variant="secondary" />
                <Pressable accessibilityRole="button" onPress={() => changeMode('recover')} style={styles.forgotButton}>
                  <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
              </>
            )}
          </View>
          <View style={styles.demoTag}>
            <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={16} />
            <Text style={styles.demoText}>{authMode === 'demo' ? 'Modo demostración activo' : 'Acceso para dotación habilitada'}</Text>
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
  match: { color: colors.success, fontFamily: typography.sans, fontSize: 12, lineHeight: 17 },
  success: { backgroundColor: colors.softGreen, borderRadius: radii.sm, color: colors.success, fontFamily: typography.sans, fontSize: 12, lineHeight: 17, padding: spacing.md },
  forgotButton: { alignItems: 'center', paddingVertical: spacing.sm },
  link: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  demoTag: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 6, marginTop: 17, paddingHorizontal: 12, paddingVertical: 7 },
  demoText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  footer: { alignItems: 'center', gap: 7, paddingBottom: 30, paddingTop: 27 },
  footerText: { color: colors.textMuted, fontFamily: typography.serif, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
