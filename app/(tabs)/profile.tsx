import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { AppButton } from '@/components/Buttons';
import { ScreenContainer } from '@/components/ScreenContainer';
import { UserAvatar } from '@/components/UserAvatar';
import { currentUser } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { roleLabels, User } from '@/types';
import { formatDate } from '@/utils/format';
import { formatRut } from '@/utils/rut';

type IconName = ComponentProps<typeof Ionicons>['name'];

const profileDetails: { icon: IconName; label: string; getValue: (profile: User) => string }[] = [
  { icon: 'card-outline', label: 'Usuario', getValue: (profile) => formatRut(profile.rut) },
  { icon: 'people-outline', label: 'Equipo', getValue: (profile) => profile.teamId ? 'Equipo asignado' : 'Sin equipo asignado' },
  { icon: 'person-outline', label: 'Coordinador', getValue: (profile) => profile.supervisorId ? 'Coordinación asignada' : 'No aplica' },
  { icon: 'briefcase-outline', label: 'Jefe de ventas', getValue: (profile) => profile.salesManagerId ? 'Jefatura asignada' : 'No aplica' },
  { icon: 'calendar-outline', label: 'Fecha de ingreso', getValue: (profile) => formatDate(profile.joinDate) },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { isLoading, signOut, user } = useAuth();
  const profile = user ?? currentUser;

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
  supportCard: { alignItems: 'flex-start', backgroundColor: colors.goldSoft, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  supportContent: { flex: 1 },
  supportTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  supportText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, lineHeight: 16, marginTop: 3 },
  version: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, textAlign: 'center' },
});
