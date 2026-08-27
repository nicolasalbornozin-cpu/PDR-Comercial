import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/Buttons';
import { FormField } from '@/components/FormField';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAuth } from '@/hooks/useAuth';
import { adminService } from '@/services/adminService';
import { CsvParseResult, parseSnapshotCsv } from '@/services/csvImportService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { AdminUser, PasswordResetRequest, roleLabels, SnapshotKind, snapshotKindLabels, UserRole } from '@/types';
import { formatRut } from '@/utils/rut';

type AdminSection = 'uploads' | 'users' | 'resets';

const roles: UserRole[] = ['seller', 'coordinator', 'sales_manager', 'admin'];
const snapshotKinds: SnapshotKind[] = ['commercial', 'senior', 'category', 'delinquency', 'salesforce', 'ranking'];
const today = new Date();
const initialPeriodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
const initialPeriodEnd = today.toISOString().slice(0, 10);

export default function AdminScreen() {
  const { user } = useAuth();
  const [section, setSection] = useState<AdminSection>('uploads');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [rut, setRut] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('seller');
  const [teamName, setTeamName] = useState('');
  const [supervisorRut, setSupervisorRut] = useState('');
  const [salesManagerRut, setSalesManagerRut] = useState('');

  const [kind, setKind] = useState<SnapshotKind>('commercial');
  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);
  const [sourceName, setSourceName] = useState('');
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);

  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function refreshUsers() {
    try {
      const result = await adminService.list();
      setUsers(result.users);
      setResetRequests(result.resetRequests);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar las cuentas.');
    }
  }

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let active = true;
    adminService.list()
      .then((result) => {
        if (!active) return;
        setUsers(result.users);
        setResetRequests(result.resetRequests);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar las cuentas.');
      });
    return () => { active = false; };
  }, [user?.role]);

  const pending = useMemo(() => resetRequests.map((request) => ({
    request,
    account: users.find((account) => account.id === request.userId),
  })).filter((item): item is { request: PasswordResetRequest; account: AdminUser } => Boolean(item.account)), [resetRequests, users]);

  if (!user) return null;
  if (user.role !== 'admin') return <Redirect href="/(tabs)/home" />;
  const adminId = user.id;

  function clearFeedback() {
    setError('');
    setMessage('');
  }

  async function selectCsv() {
    clearFeedback();
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      const webFile = (asset as typeof asset & { file?: Blob }).file;
      const text = webFile ? await webFile.text() : await (await fetch(asset.uri)).text();
      setSourceName(asset.name);
      setParsed(parseSnapshotCsv(text, kind));
    } catch {
      setError('No fue posible leer el archivo. Expórtalo desde Excel como CSV UTF-8.');
    }
  }

  async function publishSnapshot() {
    clearFeedback();
    if (!parsed || !sourceName) { setError('Selecciona primero un archivo CSV.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd) || periodEnd < periodStart) {
      setError('Revisa las fechas del período. Usa el formato AAAA-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      const count = await adminService.importSnapshot({ kind, periodStart, periodEnd, sourceName, parsed, adminId });
      setMessage(`Foto publicada correctamente para ${count} trabajadores.`);
      setParsed(null);
      setSourceName('');
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'No fue posible publicar la foto.');
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    clearFeedback();
    setBusy(true);
    try {
      await adminService.createUser({ name, rut, password, role, teamName, supervisorRut, salesManagerRut });
      setMessage('Cuenta creada correctamente. Ya puede iniciar sesión con su RUT.');
      setName(''); setRut(''); setPassword(''); setTeamName(''); setSupervisorRut(''); setSalesManagerRut('');
      await refreshUsers();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No fue posible crear la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(account: AdminUser) {
    clearFeedback();
    setBusy(true);
    try {
      await adminService.setActive(account.id, !account.active);
      setMessage(account.active ? 'Cuenta desactivada.' : 'Cuenta activada.');
      await refreshUsers();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No fue posible actualizar la cuenta.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!resetTarget) return;
    clearFeedback();
    setBusy(true);
    try {
      await adminService.resetPassword(resetTarget.id, newPassword);
      setMessage(`Contraseña restablecida para ${resetTarget.name}.`);
      setResetTarget(null);
      setNewPassword('');
      await refreshUsers();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No fue posible restablecer la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <AppHeader />
          <Text style={styles.title}>Administración</Text>
          <Text style={styles.subtitle}>Cuentas, accesos y fotos de datos agregados</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.tabs}>
            {([
              ['uploads', 'Cargas'],
              ['users', 'Cuentas'],
              ['resets', `Accesos${pending.length ? ` (${pending.length})` : ''}`],
            ] as [AdminSection, string][]).map(([value, label]) => (
              <Pressable key={value} onPress={() => { setSection(value); clearFeedback(); }} style={[styles.tab, section === value && styles.tabActive]}>
                <Text style={[styles.tabText, section === value && styles.tabTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}

          {section === 'uploads' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Publicar una foto de totales</Text>
              <Text style={styles.cardText}>Exporta la hoja necesaria desde Excel como “CSV UTF-8”. El archivo se valida en este dispositivo y no se guarda completo.</Text>
              <Text style={styles.label}>Tipo de foto</Text>
              <View style={styles.chips}>
                {snapshotKinds.map((value) => (
                  <Pressable key={value} onPress={() => { setKind(value); setParsed(null); setSourceName(''); }} style={[styles.chip, kind === value && styles.chipActive]}>
                    <Text style={[styles.chipText, kind === value && styles.chipTextActive]}>{snapshotKindLabels[value]}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.dateRow}>
                <View style={styles.flex}><FormField autoCapitalize="none" icon="calendar-outline" label="Desde" onChangeText={setPeriodStart} placeholder="AAAA-MM-DD" value={periodStart} /></View>
                <View style={styles.flex}><FormField autoCapitalize="none" icon="calendar-outline" label="Hasta" onChangeText={setPeriodEnd} placeholder="AAAA-MM-DD" value={periodEnd} /></View>
              </View>
              <AppButton icon="document-attach-outline" label={sourceName || 'Seleccionar CSV'} onPress={selectCsv} variant="secondary" />
              {parsed ? (
                <View style={[styles.validation, parsed.errors.length ? styles.validationError : styles.validationOk]}>
                  <Ionicons color={parsed.errors.length ? colors.danger : colors.success} name={parsed.errors.length ? 'alert-circle-outline' : 'checkmark-circle-outline'} size={22} />
                  <View style={styles.flex}>
                    <Text style={styles.validationTitle}>{parsed.rows.length} filas válidas</Text>
                    {parsed.errors.slice(0, 8).map((item) => <Text key={item} style={styles.validationText}>• {item}</Text>)}
                  </View>
                </View>
              ) : null}
              <AppButton disabled={!parsed || Boolean(parsed.errors.length)} label="Validar y publicar" loading={busy} onPress={publishSnapshot} />
              <View style={styles.privacy}>
                <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={21} />
                <Text style={styles.privacyText}>Solo se aceptan RUT de trabajadores y totales permitidos. Cualquier columna adicional bloquea la publicación.</Text>
              </View>
            </View>
          ) : null}

          {section === 'users' ? (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Crear cuenta</Text>
                <FormField icon="person-outline" label="Nombre completo" onChangeText={setName} placeholder="Nombre y apellido" value={name} />
                <FormField autoCapitalize="characters" icon="card-outline" label="RUT" onChangeText={setRut} placeholder="12.345.678-9" value={rut} />
                <FormField icon="lock-closed-outline" label="Contraseña permanente" onChangeText={setPassword} password placeholder="10+ caracteres, mayúscula, número y símbolo" value={password} />
                <Text style={styles.label}>Perfil</Text>
                <View style={styles.chips}>
                  {roles.map((value) => (
                    <Pressable key={value} onPress={() => setRole(value)} style={[styles.chip, role === value && styles.chipActive]}>
                      <Text style={[styles.chipText, role === value && styles.chipTextActive]}>{roleLabels[value]}</Text>
                    </Pressable>
                  ))}
                </View>
                <FormField icon="people-outline" label="Equipo (opcional)" onChangeText={setTeamName} placeholder="Ej. Equipo Norte" value={teamName} />
                <FormField autoCapitalize="characters" icon="person-outline" label="RUT coordinador (opcional)" onChangeText={setSupervisorRut} placeholder="Sin puntos ni guion" value={supervisorRut} />
                <FormField autoCapitalize="characters" icon="briefcase-outline" label="RUT jefe de ventas (opcional)" onChangeText={setSalesManagerRut} placeholder="Sin puntos ni guion" value={salesManagerRut} />
                <AppButton disabled={!name || !rut || !password} label="Crear cuenta administrada" loading={busy} onPress={createUser} />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Cuentas existentes</Text>
                {users.map((account, index) => (
                  <View key={account.id} style={[styles.accountRow, index < users.length - 1 && styles.accountBorder]}>
                    <View style={styles.flex}>
                      <Text style={styles.accountName}>{account.name}</Text>
                      <Text style={styles.accountMeta}>{formatRut(account.rut)} · {roleLabels[account.role]}</Text>
                    </View>
                    <Pressable disabled={busy} onPress={() => toggleActive(account)} style={[styles.status, account.active ? styles.statusActive : styles.statusInactive]}>
                      <Text style={styles.statusText}>{account.active ? 'Activa' : 'Inactiva'}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {section === 'resets' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Solicitudes de recuperación</Text>
              {!pending.length ? <Text style={styles.empty}>No hay solicitudes pendientes.</Text> : pending.map(({ request, account }, index) => (
                <View key={request.id} style={[styles.accountRow, index < pending.length - 1 && styles.accountBorder]}>
                  <View style={styles.flex}>
                    <Text style={styles.accountName}>{account.name}</Text>
                    <Text style={styles.accountMeta}>{formatRut(account.rut)} · {request.requestCount} solicitud(es)</Text>
                  </View>
                  <Pressable onPress={() => { setResetTarget(account); setNewPassword(''); }} style={styles.resetButton}>
                    <Text style={styles.resetText}>Restablecer</Text>
                  </Pressable>
                </View>
              ))}
              {resetTarget ? (
                <View style={styles.resetForm}>
                  <Text style={styles.cardText}>Nueva contraseña permanente para {resetTarget.name}</Text>
                  <FormField icon="lock-closed-outline" label="Nueva contraseña" onChangeText={setNewPassword} password placeholder="10+ caracteres, mayúscula, número y símbolo" value={newPassword} />
                  <AppButton disabled={!newPassword} label="Guardar nueva contraseña" loading={busy} onPress={resetPassword} />
                  <AppButton label="Cancelar" onPress={() => setResetTarget(null)} variant="secondary" />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 36 },
  mobileFrame: { maxWidth: 760, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600', marginTop: spacing.xxl },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 3 },
  content: { gap: spacing.lg, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  tabs: { backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', padding: 4 },
  tab: { alignItems: 'center', borderRadius: radii.pill, flex: 1, minHeight: 42, justifyContent: 'center', paddingHorizontal: 5 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  tabTextActive: { color: colors.surface },
  card: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.lg, padding: spacing.xl },
  cardTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 23, fontWeight: '600' },
  cardText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, lineHeight: 18 },
  label: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { backgroundColor: colors.softGreen, borderColor: 'transparent', borderRadius: radii.pill, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, fontWeight: '800' },
  chipTextActive: { color: colors.surface },
  dateRow: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  validation: { alignItems: 'flex-start', borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  validationOk: { backgroundColor: colors.softGreen },
  validationError: { backgroundColor: '#FBECE9' },
  validationTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  validationText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, lineHeight: 15, marginTop: 3 },
  privacy: { alignItems: 'flex-start', backgroundColor: colors.softGreen, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  privacyText: { color: colors.textMuted, flex: 1, fontFamily: typography.sans, fontSize: 10, lineHeight: 16 },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 11, lineHeight: 17, padding: spacing.md },
  success: { backgroundColor: colors.softGreen, borderRadius: radii.md, color: colors.success, fontFamily: typography.sans, fontSize: 11, lineHeight: 17, padding: spacing.md },
  accountRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm },
  accountBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  accountName: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  accountMeta: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 4 },
  status: { borderRadius: radii.pill, paddingHorizontal: 11, paddingVertical: 7 },
  statusActive: { backgroundColor: colors.softGreen },
  statusInactive: { backgroundColor: '#FBECE9' },
  statusText: { color: colors.text, fontFamily: typography.sans, fontSize: 9, fontWeight: '900' },
  resetButton: { backgroundColor: colors.goldSoft, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 },
  resetText: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900' },
  resetForm: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.md, paddingTop: spacing.lg },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, paddingVertical: spacing.xl, textAlign: 'center' },
});
