import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './Buttons';
import { FormField } from './FormField';
import { registrationService, RegistrationEntry } from '@/services/registrationService';
import { colors, radii, spacing, typography } from '@/theme';
import { roleLabels } from '@/types';
import { formatRut, normalizeRut } from '@/utils/rut';

const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function RegistrationControls() {
  const [entries, setEntries] = useState<RegistrationEntry[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [audioName, setAudioName] = useState('');
  const [audioRut, setAudioRut] = useState('');

  useEffect(() => {
    let mounted = true;
    registrationService.list().then((data) => { if (mounted) setEntries(data); })
      .catch((failure) => { if (mounted) setError(failure instanceof Error ? failure.message : 'No fue posible cargar el registro.'); });
    return () => { mounted = false; };
  }, []);
  const matches = useMemo(() => {
    const text = searchable(search);
    if (text.length < 2) return [];
    const rut = normalizeRut(search);
    return entries.filter((entry) => searchable(entry.name).includes(text) || (rut.length > 1 && entry.rut.includes(rut))).slice(0, 20);
  }, [entries, search]);

  async function update(operation: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await operation();
      setMessage(success);
      setEntries(await registrationService.list());
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No fue posible actualizar el registro.'); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Primer acceso · Crear cuenta</Text>
      <Text style={styles.body}>Las personas vigentes de la dotación pueden registrarse una vez. Puedes bloquear su registro antes de crear la cuenta; las cuentas existentes se gestionan abajo.</Text>
      <FormField icon="search-outline" label="Buscar en dotación" onChangeText={setSearch} placeholder="Nombre, apellido o RUT" value={search} />
      {matches.map((entry) => (
        <View key={entry.rut} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.name}>{entry.name}</Text>
            <Text style={styles.body}>{formatRut(entry.rut)} · {roleLabels[entry.role]}</Text>
            <Text style={styles.body}>{entry.registered ? 'Ya tiene cuenta' : !entry.eligible ? 'No vigente en dotación' : entry.enabled ? 'Puede crear cuenta' : 'Registro bloqueado'}</Text>
          </View>
          {!entry.registered && entry.eligible ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${entry.enabled ? 'Bloquear' : 'Habilitar'} registro de ${entry.name}`} disabled={busy} onPress={() => update(() => registrationService.setEnabled(entry, !entry.enabled), entry.enabled ? 'Registro bloqueado.' : 'Registro habilitado.')} style={styles.toggle}>
              <Text style={styles.toggleText}>{entry.enabled ? 'Bloquear' : 'Habilitar'}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      {search.trim().length >= 2 && !matches.length ? <Text style={styles.body}>No hay coincidencias.</Text> : null}
      <Text style={styles.title}>Habilitar Audiovisual</Text>
      <Text style={styles.body}>Solo tendrá acceso a Noticias. La persona elegirá su contraseña en «Crear cuenta».</Text>
      <FormField editable={!busy} icon="person-outline" label="Nombre Audiovisual" onChangeText={setAudioName} placeholder="Nombre completo" value={audioName} />
      <FormField editable={!busy} icon="card-outline" label="RUT Audiovisual" maxLength={12} onChangeText={(value) => setAudioRut(formatRut(value))} placeholder="12.345.678-9" value={audioRut} />
      <AppButton disabled={!audioName.trim() || !audioRut || busy} label="Habilitar registro Audiovisual" loading={busy} onPress={() => update(() => registrationService.enableAudiovisual(audioName, audioRut), 'Registro Audiovisual habilitado. La persona ya puede crear su cuenta.')} variant="secondary" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.md },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 23, marginTop: spacing.sm },
  body: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18 },
  row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  flex: { flex: 1 },
  name: { color: colors.text, fontFamily: typography.sans, fontSize: 14, fontWeight: '700' },
  toggle: { backgroundColor: colors.softGreen, borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toggleText: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, fontFamily: typography.sans, fontSize: 12 },
  success: { color: colors.success, fontFamily: typography.sans, fontSize: 12 },
});
