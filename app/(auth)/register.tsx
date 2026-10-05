import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/Buttons';
import { FormField } from '@/components/FormField';
import { ScreenContainer } from '@/components/ScreenContainer';
import { authService } from '@/services/authService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { formatRut, isValidRut } from '@/utils/rut';
import { isStrongRegistrationPassword, registrationValidation } from '@/utils/registration';

export default function RegisterScreen() {
  const router = useRouter();
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const validRut = isValidRut(rut);
  const matching = password.length > 0 && password === confirmation;
  const strong = isStrongRegistrationPassword(password);

  async function createAccount() {
    if (busy) return;
    const validation = registrationValidation(rut, password, confirmation);
    if (validation) { setError(validation); return; }
    setBusy(true);
    setError('');
    try {
      await authService.register(rut, password, confirmation);
      setPassword(''); setConfirmation('');
      setCreated(true);
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'No fue posible crear la cuenta.');
    } finally { setBusy(false); }
  }
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
          <Text style={styles.title}>{created ? '¡Tu cuenta ha sido creada!' : 'Crear cuenta'}</Text>
          {created ? (
            <>
              <View accessibilityRole="alert" style={styles.created}>
                <Ionicons color={colors.success} name="checkmark-circle" size={48} />
                <Text style={styles.body}>Ya puedes ingresar con tu RUT y la contraseña que elegiste.</Text>
              </View>
              <AppButton label="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} />
            </>
          ) : (
            <>
              <Text style={styles.body}>Regístrate una sola vez con tu RUT. Tu nombre y perfil se asignan desde la dotación habilitada.</Text>
              <FormField autoCapitalize="characters" autoComplete="off" editable={!busy} icon="card-outline" label="RUT" maxLength={12} onChangeText={(value) => { setRut(formatRut(value)); setError(''); }} placeholder="12.345.678-9" value={rut} />
              {rut ? <Text accessibilityLiveRegion="polite" style={[styles.check, validRut ? styles.checkOk : styles.checkPending]}>{validRut ? '✓ RUT válido' : '○ Revisa el RUT ingresado'}</Text> : null}
              <FormField autoCapitalize="none" autoComplete="new-password" editable={!busy} icon="lock-closed-outline" label="Contraseña" maxLength={72} onChangeText={(value) => { setPassword(value); setError(''); }} password placeholder="Crea tu contraseña" value={password} />
              <Text accessibilityLiveRegion="polite" style={[styles.check, strong ? styles.checkOk : styles.checkPending]}>{strong ? '✓' : '○'} 10+ caracteres, mayúscula, minúscula, número y símbolo</Text>
              <FormField autoCapitalize="none" autoComplete="new-password" editable={!busy} icon="lock-closed-outline" label="Confirmar contraseña" maxLength={72} onChangeText={(value) => { setConfirmation(value); setError(''); }} password placeholder="Repite tu contraseña" value={confirmation} />
              {confirmation ? <Text accessibilityLiveRegion="polite" style={[styles.check, matching ? styles.checkOk : styles.error]}>{matching ? '✓ Las contraseñas coinciden' : 'Las contraseñas no coinciden'}</Text> : null}
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <AppButton disabled={busy} label="Crear cuenta" loading={busy} onPress={createAccount} />
              <AppButton disabled={busy} label="Ya tengo cuenta · Iniciar sesión" onPress={() => router.replace('/(auth)/login')} variant="secondary" />
            </>
          )}
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
  check: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, marginTop: -10 },
  checkOk: { color: colors.success },
  checkPending: { color: colors.danger },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 13, lineHeight: 19 },
  created: { alignItems: 'center', gap: spacing.lg },
});
