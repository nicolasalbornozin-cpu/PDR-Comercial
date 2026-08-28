import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/Buttons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { UserAvatar } from '@/components/UserAvatar';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { adminService } from '@/services/adminService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { AdminUser, roleLabels, User, UserRole } from '@/types';
import { formatDate } from '@/utils/format';
import { formatRut } from '@/utils/rut';

type IconName = ComponentProps<typeof Ionicons>['name'];
type PreviewRole = Exclude<UserRole, 'admin'>;

const previewRoles: { icon: IconName; label: string; role: PreviewRole }[] = [
  { icon: 'person-outline', label: 'Ver como vendedor', role: 'seller' },
  { icon: 'people-outline', label: 'Ver como coordinador', role: 'coordinator' },
  { icon: 'briefcase-outline', label: 'Ver como jefe de venta', role: 'sales_manager' },
];

const profileDetails: { icon: IconName; label: string; getValue: (profile: User) => string }[] = [
  { icon: 'card-outline', label: 'Usuario', getValue: (profile) => formatRut(profile.rut) },
  { icon: 'people-outline', label: 'Equipo', getValue: (profile) => profile.teamId ? 'Equipo asignado' : 'Sin equipo asignado' },
  { icon: 'person-outline', label: 'Coordinador', getValue: (profile) => profile.supervisorId ? 'Coordinación asignada' : 'No aplica' },
  { icon: 'briefcase-outline', label: 'Jefe de ventas', getValue: (profile) => profile.salesManagerId ? 'Jefatura asignada' : 'No aplica' },
  { icon: 'calendar-outline', label: 'Fecha de ingreso', getValue: (profile) => formatDate(profile.joinDate) },
];

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function accountToPreviewUser(account: AdminUser): User {
  return {
    id: account.id,
    name: account.name,
    email: '',
    rut: account.rut,
    role: account.role,
    avatar: initials(account.name),
    teamId: account.teamId,
    supervisorId: account.supervisorId,
    salesManagerId: account.salesManagerId,
    joinDate: account.createdAt.slice(0, 10),
    active: account.active,
    mustChangePassword: false,
  };
}

function emptyPreviewUser(role: PreviewRole): User {
  const name = role === 'seller' ? 'Vista de vendedor' : role === 'coordinator' ? 'Vista de coordinador' : 'Vista de jefe de venta';
  return {
    id: `preview-${role}`,
    name,
    email: '',
    rut: '',
    role,
    avatar: initials(name),
    teamId: '',
    supervisorId: '',
    salesManagerId: '',
    joinDate: new Date().toISOString().slice(0, 10),
    active: true,
    mustChangePassword: false,
  };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { authenticatedUser, isLoading, isPreviewing, signOut, startPreview, user } = useAuth();
  const profile = user ?? currentUser;
  const [managedUsers, setManagedUsers] = useState<AdminUser[]>([]);
  const [selectedPreviewRole, setSelectedPreviewRole] = useState<PreviewRole | null>(null);
  const [previewLoading, setPreviewLoading] = useState(authenticatedUser?.role === 'admin');
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (authenticatedUser?.role !== 'admin' || isPreviewing) return;
    let active = true;
    adminService.list()
      .then((result) => {
        if (active) setManagedUsers(result.users);
      })
      .catch((loadError) => {
        if (active) setPreviewError(loadError instanceof Error ? loadError.message : 'No fue posible cargar los perfiles disponibles.');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => { active = false; };
  }, [authenticatedUser?.role, isPreviewing]);

  const previewCandidates = useMemo(
    () => selectedPreviewRole
      ? managedUsers.filter((account) => account.active && account.role === selectedPreviewRole).sort((left, right) => left.name.localeCompare(right.name, 'es'))
      : [],
    [managedUsers, selectedPreviewRole],
  );

  const canPreviewRoles = authenticatedUser?.role === 'admin' && !isPreviewing;

  function openPreview(previewUser: User) {
    startPreview(previewUser);
    router.replace('/(tabs)/home');
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/login');
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <AppHeader />
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>Tu información administrativa</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.identityCard}>
            <View style={styles.leaf}><Ionicons color="rgba(39,114,80,0.1)" name="leaf-outline" size={112} /></View>
            <UserAvatar highlighted name={profile.name} size={88} />
            <Text style={styles.name}>{profile.name}</Text>
            <View style={styles.roleBadge}><Ionicons color={colors.gold} name="ribbon-outline" size={15} /><Text style={styles.roleText}>{roleLabels[profile.role]}</Text></View>
            <Text style={styles.employee}>En la plataforma desde {new Date(`${profile.joinDate}T12:00:00`).getFullYear()}</Text>
          </View>

          <View style={styles.infoCard}>
            {profileDetails.map((detail, index) => (
              <View key={detail.label} style={[styles.detailRow, index < profileDetails.length - 1 && styles.detailBorder]}>
                <View style={styles.detailIcon}><Ionicons color={colors.secondary} name={detail.icon} size={19} /></View>
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{detail.label}</Text>
                  <Text numberOfLines={2} style={styles.detailValue}>{detail.getValue(profile)}</Text>
                </View>
              </View>
            ))}
          </View>

          {canPreviewRoles ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeading}>
                <View style={styles.previewHeadingIcon}><Ionicons color={colors.goldText} name="eye-outline" size={20} /></View>
                <View style={styles.previewHeadingCopy}>
                  <Text style={styles.previewTitle}>Vista previa de perfiles</Text>
                  <Text style={styles.previewDescription}>Comprueba exactamente lo que verá una cuenta activa. Tus permisos de administrador permanecen protegidos.</Text>
                </View>
              </View>

              <View style={styles.previewActions}>
                {previewRoles.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.role}
                    onPress={() => { setSelectedPreviewRole(item.role); setPreviewError(''); }}
                    style={({ pressed }) => [styles.previewRoleButton, selectedPreviewRole === item.role && styles.previewRoleButtonActive, pressed && styles.previewPressed]}
                  >
                    <Ionicons color={selectedPreviewRole === item.role ? colors.surface : colors.primary} name={item.icon} size={19} />
                    <Text style={[styles.previewRoleText, selectedPreviewRole === item.role && styles.previewRoleTextActive]}>{item.label}</Text>
                    <Ionicons color={selectedPreviewRole === item.role ? colors.surface : colors.textMuted} name="chevron-forward" size={16} />
                  </Pressable>
                ))}
              </View>

              {previewLoading ? <Text style={styles.previewStatus}>Cargando cuentas disponibles…</Text> : null}
              {previewError ? <Text accessibilityRole="alert" style={styles.previewError}>{previewError}</Text> : null}
              {selectedPreviewRole && !previewLoading ? (
                <View style={styles.previewPicker}>
                  <Text style={styles.previewPickerLabel}>Elige la cuenta cuya experiencia quieres revisar</Text>
                  {previewCandidates.length ? previewCandidates.map((account) => (
                    <Pressable
                      accessibilityLabel={`Ver la aplicación como ${account.name}, ${roleLabels[account.role]}`}
                      accessibilityRole="button"
                      key={account.id}
                      onPress={() => openPreview(accountToPreviewUser(account))}
                      style={({ pressed }) => [styles.previewAccount, pressed && styles.previewPressed]}
                    >
                      <UserAvatar name={account.name} size={38} />
                      <View style={styles.previewAccountCopy}>
                        <Text numberOfLines={1} style={styles.previewAccountName}>{account.name}</Text>
                        <Text style={styles.previewAccountRole}>{roleLabels[account.role]}</Text>
                      </View>
                      <Ionicons color={colors.primary} name="eye-outline" size={19} />
                    </Pressable>
                  )) : (
                    <View style={styles.emptyPreview}>
                      <Text style={styles.emptyPreviewText}>Todavía no hay una cuenta activa con este perfil. Puedes abrir igualmente la interfaz vacía para revisar su diseño.</Text>
                      <AppButton
                        icon="eye-outline"
                        label="Abrir vista sin datos"
                        onPress={() => openPreview(emptyPreviewUser(selectedPreviewRole))}
                        variant="secondary"
                      />
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.supportCard}>
            <Ionicons color={colors.gold} name="help-circle-outline" size={24} />
            <View style={styles.supportContent}>
              <Text style={styles.supportTitle}>¿Necesitas actualizar tus datos?</Text>
              <Text style={styles.supportText}>Solicita el cambio al administrador de la plataforma.</Text>
            </View>
          </View>

          <AppButton icon="log-out-outline" label="Cerrar sesión" loading={isLoading} onPress={handleSignOut} variant="secondary" />
          <Text style={styles.version}>PDR Comercial · Versión 1.0.0</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600', marginTop: spacing.xxl },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 3 },
  content: { gap: spacing.lg, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  identityCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.xl, overflow: 'hidden', padding: spacing.xxl },
  leaf: { bottom: -34, position: 'absolute', right: -18, transform: [{ rotate: '-18deg' }] },
  name: { color: colors.primary, fontFamily: typography.serif, fontSize: 25, fontWeight: '600', marginTop: spacing.md },
  roleBadge: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.pill, flexDirection: 'row', gap: 6, marginTop: 7, paddingHorizontal: 12, paddingVertical: 7 },
  roleText: { color: colors.text, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  employee: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: 11 },
  infoCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.lg },
  detailRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 76, paddingVertical: spacing.md },
  detailBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  detailIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: 13, height: 39, justifyContent: 'center', width: 39 },
  detailContent: { flex: 1 },
  detailLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, fontWeight: '700' },
  detailValue: { color: colors.text, fontFamily: typography.sans, fontSize: 13, fontWeight: '700', marginTop: 3 },
  previewCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.xl, gap: spacing.lg, padding: spacing.lg },
  previewHeading: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  previewHeadingIcon: { alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.md, height: 42, justifyContent: 'center', width: 42 },
  previewHeadingCopy: { flex: 1 },
  previewTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 21, fontWeight: '600' },
  previewDescription: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, lineHeight: 16, marginTop: 4 },
  previewActions: { gap: spacing.sm },
  previewRoleButton: { alignItems: 'center', backgroundColor: colors.softGreen, borderColor: 'transparent', borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 52, paddingHorizontal: spacing.md },
  previewRoleButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  previewRoleText: { color: colors.primary, flex: 1, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  previewRoleTextActive: { color: colors.surface },
  previewPressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
  previewStatus: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, textAlign: 'center' },
  previewError: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 10, lineHeight: 16, padding: spacing.md },
  previewPicker: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, paddingTop: spacing.md },
  previewPickerLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, fontWeight: '800', letterSpacing: 0.3, textTransform: 'uppercase' },
  previewAccount: { alignItems: 'center', backgroundColor: colors.paleGreen, borderRadius: radii.md, flexDirection: 'row', gap: spacing.md, minHeight: 58, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  previewAccountCopy: { flex: 1 },
  previewAccountName: { color: colors.text, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  previewAccountRole: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 3 },
  emptyPreview: { gap: spacing.md },
  emptyPreviewText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, lineHeight: 16 },
  supportCard: { alignItems: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  supportContent: { flex: 1 },
  supportTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  supportText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, lineHeight: 16, marginTop: 3 },
  version: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, textAlign: 'center' },
});
