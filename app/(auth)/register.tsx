import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { AppButton } from '@/components/Buttons';
import { FormField } from '@/components/FormField';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { isLoading, signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !rut.trim() || !password || !confirmation) {
      setError('Completa todos los campos para continuar.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!accepted) {
      setError('Debes aceptar los términos y la política de privacidad.');
      return;
    }

    setError('');
    try {
      await signUp({ email, name, password, rut });
      router.replace('/(tabs)/home');
    } catch (registrationError) {
      setError(registrationError instanceof Error ? registrationError.message : 'No fue posible crear la cuenta.');
    }
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
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Accede a tu panel comercial</Text>

          <View style={styles.form}>
            <FormField autoComplete="name" icon="person-outline" label="Nombre completo" onChangeText={setName} placeholder="Nombre y apellido" value={name} />
            <FormField autoCapitalize="none" autoComplete="email" icon="mail-outline" keyboardType="email-address" label="Correo corporativo" onChangeText={setEmail} placeholder="nombre@parquedelrecuerdo.cl" value={email} />
            <FormField autoCapitalize="characters" icon="card-outline" label="RUT" onChangeText={setRut} placeholder="12.345.678-9" value={rut} />
            <FormField icon="lock-closed-outline" label="Contraseña" onChangeText={setPassword} password placeholder="Mínimo 6 caracteres" value={password} />
            <FormField icon="shield-checkmark-outline" label="Confirmar contraseña" onChangeText={setConfirmation} password placeholder="Repite tu contraseña" value={confirmation} />

            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} aria-checked={accepted} onPress={() => setAccepted((value) => !value)} style={styles.terms}>
              <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
                {accepted ? <Ionicons color={colors.surface} name="checkmark" size={14} /> : null}
              </View>
              <Text style={styles.termsText}>Acepto términos y privacidad</Text>
            </Pressable>

            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <AppButton label="Crear cuenta" loading={isLoading} onPress={handleRegister} />
          </View>

          <Pressable onPress={() => router.replace('/(auth)/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>¿Ya tengo cuenta? <Text style={styles.loginStrong}>Iniciar sesión</Text></Text>
          </Pressable>
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
  card: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.xl, marginHorizontal: spacing.xl, marginTop: spacing.sm, padding: spacing.xxl },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 33, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 14, marginTop: 5 },
  form: { gap: 15, marginTop: spacing.xxl },
  terms: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  checkbox: { alignItems: 'center', borderColor: colors.border, borderRadius: 6, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  termsText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12 },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 12, lineHeight: 17 },
  loginLink: { alignItems: 'center', marginTop: spacing.xxl, paddingVertical: spacing.sm },
  loginText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13 },
  loginStrong: { color: colors.primary, fontWeight: '800' },
});
