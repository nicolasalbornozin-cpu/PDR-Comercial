import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData, MetricSnapshot, User } from '@/types';
import { formatUF } from '@/utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface SellerHomeDashboardProps {
  data: DashboardData | null;
  error: string;
  metric?: Partial<MetricSnapshot>;
  user: User;
}

interface SellerMetricProps {
  detail?: string;
  icon: IconName;
  label: string;
  value: string;
}

function metricUf(metric?: Partial<MetricSnapshot>): number {
  return metric?.productionUf ?? metric?.eligibleTotalUf ?? metric?.quarterTotalUf ?? 0;
}

function teamLabel(teamId: string): string {
  if (!teamId) return 'Equipo por asignar';
  const readable = teamId.replace(/^team[-_]?/i, '').replace(/[-_]+/g, ' ').trim();
  if (!readable) return 'Equipo asignado';
  return `Equipo ${readable.replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
}

function SellerMetric({ detail, icon, label, value }: SellerMetricProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}><Ionicons color={colors.goldText} name={icon} size={21} /></View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricLabel}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricValue}>{value}</Text>
      {detail ? <Text adjustsFontSizeToFit numberOfLines={1} style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function CompactGoal({ icon, label, value, progress }: { icon: IconName; label: string; value: string; progress: number }) {
  return (
    <View style={styles.compactGoal}>
      <View style={styles.compactGoalTop}>
        <View style={styles.compactGoalIcon}><Ionicons color={colors.gold} name={icon} size={17} /></View>
        <Text numberOfLines={1} style={styles.compactGoalLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.compactGoalValue}>{value}</Text>
      </View>
      <ProgressBar color={colors.secondary} height={6} progress={progress} />
    </View>
  );
}

export function SellerHomeDashboard({ data, error, metric, user }: SellerHomeDashboardProps) {
  const router = useRouter();
  const firstName = user.name.split(/\s+/)[0] || 'Vendedor';
  const soldUf = metricUf(metric);
  const eligibleUf = metric?.eligibleTotalUf ?? metric?.quarterTotalUf ?? soldUf;
  const category = metric?.category ?? 'Sin categoría publicada';
  const senior = metric?.seniorLevel ?? 'Sin nivel publicado';
  const categoryProgress = metric?.category ? 1 : 0;
  const seniorProgress = eligibleUf > 0 && soldUf > 0 ? Math.min(eligibleUf / Math.max(soldUf, eligibleUf), 1) : 0;

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.68)', 'rgba(248,247,243,0.05)']} locations={[0, 0.43, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <AppHeader />
            <View style={styles.greeting}>
              <Text style={styles.hello}>Hola, <Text style={styles.helloName}>{firstName}</Text></Text>
              <Text style={styles.team}>{teamLabel(user.teamId)}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.executivePanel}>
          <View style={styles.panelHeading}>
            <View>
              <Text style={styles.panelTitle}>Perfil Ejecutivo</Text>
              <View style={styles.goldUnderline} />
            </View>
            <View style={styles.leafBadge}><Ionicons color={colors.primary} name="leaf-outline" size={24} /></View>
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}

          <LinearGradient colors={[colors.primaryDark, colors.secondary]} end={{ x: 1, y: 0 }} start={{ x: 0, y: 0 }} style={styles.salesCard}>
            <Ionicons color="rgba(255,255,255,0.08)" name="leaf-outline" size={124} style={styles.salesLeaf} />
            <View style={styles.salesIcon}><Ionicons color={colors.goldOnDark} name="trending-up-outline" size={27} /></View>
            <View style={styles.salesCopy}>
              <Text style={styles.salesLabel}>Venta acumulada</Text>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.salesValue}>{formatUF(soldUf)} <Text style={styles.salesUnit}>UF</Text></Text>
              <Text numberOfLines={1} style={styles.salesPeriod}>{data?.periodLabel ?? 'Esperando datos publicados'}</Text>
            </View>
          </LinearGradient>

          <View style={styles.metricsRow}>
            <SellerMetric detail={metric?.delinquentClientsCount !== undefined ? `${metric.delinquentClientsCount} clientes` : undefined} icon="time-outline" label="Mora" value={metric?.delinquencyRate !== undefined ? `${metric.delinquencyRate}%` : '—'} />
            <SellerMetric detail="negocios" icon="briefcase-outline" label="Productividad" value={`${metric?.businessCount ?? 0}`} />
            <SellerMetric icon="trophy-outline" label="Ranking" value={metric?.rankingPosition ? `#${metric.rankingPosition}` : '—'} />
            <SellerMetric detail="registros" icon="cloud-upload-outline" label="Salesforce" value={`${metric?.salesforceRecords ?? 0}`} />
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}><Ionicons color={colors.primary} name="locate-outline" size={20} /></View>
              <Text style={styles.sectionTitle}>Mis metas</Text>
            </View>
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/goals')} style={styles.detailButton}>
              <Text style={styles.detailText}>Ver detalle</Text>
              <Ionicons color={colors.goldText} name="chevron-forward" size={15} />
            </Pressable>
          </View>

          <Pressable accessibilityRole="button" onPress={() => router.push('/goals')} style={({ pressed }) => [styles.mainGoal, pressed && styles.pressed]}>
            <View style={styles.mainGoalIcon}><Ionicons color={colors.gold} name="diamond-outline" size={29} /></View>
            <View style={styles.mainGoalBody}>
              <View style={styles.mainGoalTop}>
                <Text numberOfLines={1} style={styles.mainGoalTitle}>{senior}</Text>
                <Text style={styles.mainGoalValue}>{formatUF(eligibleUf)} UF</Text>
              </View>
              <ProgressBar color={colors.primary} height={8} progress={seniorProgress} />
              <Text numberOfLines={1} style={styles.mainGoalHint}>Avance según la última foto publicada</Text>
            </View>
          </Pressable>

          <View style={styles.compactGoalsRow}>
            <CompactGoal icon="star-outline" label="Categoría" progress={categoryProgress} value={category} />
            <CompactGoal icon="briefcase-outline" label="Negocios" progress={metric?.businessCount ? Math.min(metric.businessCount / 8, 1) : 0} value={`${metric?.businessCount ?? 0}`} />
          </View>

          <View style={styles.sectionHeading}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionIcon}><Ionicons color={colors.primary} name="pulse-outline" size={20} /></View>
              <Text style={styles.sectionTitle}>Actividad reciente</Text>
            </View>
          </View>

          <View style={styles.activityCard}>
            <View style={styles.activityRow}>
              <View style={styles.activityIcon}><Ionicons color={colors.primary} name="trending-up-outline" size={18} /></View>
              <View style={styles.activityCopy}><Text style={styles.activityTitle}>{metric?.rankingPosition ? `Posición #${metric.rankingPosition} en el ranking` : 'Ranking pendiente de publicación'}</Text><Text style={styles.activityDescription}>Tu avance se actualiza con cada nueva carga.</Text></View>
              <Text style={styles.activityDate}>Última foto</Text>
            </View>
            <View style={styles.activityDivider} />
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, styles.activityIconSoft]}><Ionicons color={colors.secondary} name="star-outline" size={18} /></View>
              <View style={styles.activityCopy}><Text style={styles.activityTitle}>{category}</Text><Text style={styles.activityDescription}>Categoría comercial vigente.</Text></View>
              <Ionicons color={colors.goldText} name="checkmark-circle-outline" size={17} />
            </View>
            <View style={styles.activityDivider} />
            <View style={styles.activityRow}>
              <View style={[styles.activityIcon, styles.activityIconPale]}><Ionicons color={colors.primary} name="calendar-outline" size={18} /></View>
              <View style={styles.activityCopy}><Text style={styles.activityTitle}>Datos actualizados</Text><Text numberOfLines={1} style={styles.activityDescription}>{data?.periodLabel ?? 'Sin carga publicada'}</Text></View>
              <Ionicons color={colors.textMuted} name="shield-checkmark-outline" size={17} />
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 30 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 285, overflow: 'hidden' },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  greeting: { marginTop: 42 },
  hello: { color: '#505B56', fontFamily: typography.sans, fontSize: 27, fontWeight: '400' },
  helloName: { color: colors.primary, fontWeight: '800' },
  team: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 5 },
  executivePanel: { backgroundColor: colors.surface, borderTopLeftRadius: 34, borderTopRightRadius: 34, gap: spacing.lg, marginTop: -50, minHeight: 700, paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl },
  panelHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  panelTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 30, fontWeight: '600' },
  goldUnderline: { backgroundColor: colors.gold, borderRadius: 3, height: 3, marginTop: 8, width: 46 },
  leafBadge: { alignItems: 'center', backgroundColor: colors.paleGreen, borderRadius: radii.pill, height: 48, justifyContent: 'center', width: 48 },
  loader: { paddingVertical: spacing.lg },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.md },
  salesCard: { alignItems: 'center', borderRadius: radii.lg, flexDirection: 'row', minHeight: 134, overflow: 'hidden', padding: spacing.lg },
  salesLeaf: { bottom: -40, position: 'absolute', right: -15 },
  salesIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: radii.pill, height: 58, justifyContent: 'center', width: 58 },
  salesCopy: { flex: 1, marginLeft: spacing.lg, minWidth: 0 },
  salesLabel: { color: 'rgba(255,255,255,0.76)', fontFamily: typography.sans, fontSize: 13 },
  salesValue: { color: colors.surface, fontFamily: typography.sans, fontSize: 38, fontWeight: '400', letterSpacing: -0.8, marginTop: 2 },
  salesUnit: { fontSize: 23 },
  salesPeriod: { color: 'rgba(255,255,255,0.58)', fontFamily: typography.sans, fontSize: 9, marginTop: 3 },
  metricsRow: { flexDirection: 'row', gap: 7 },
  metricCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderColor: '#EDF0ED', borderRadius: radii.lg, borderWidth: 1, flex: 1, minHeight: 124, paddingHorizontal: 5, paddingVertical: 12 },
  metricIcon: { alignItems: 'center', backgroundColor: colors.paleGreen, borderRadius: radii.pill, height: 39, justifyContent: 'center', width: 39 },
  metricLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 7, textAlign: 'center' },
  metricValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 22, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  metricDetail: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8, marginTop: 1, textAlign: 'center' },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sectionIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  sectionTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 21, fontWeight: '600' },
  detailButton: { alignItems: 'center', flexDirection: 'row', gap: 2, paddingVertical: spacing.sm },
  detailText: { color: colors.goldText, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  mainGoal: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderColor: '#EEF1EE', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  mainGoalIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 58, justifyContent: 'center', width: 58 },
  mainGoalBody: { flex: 1, gap: 7, minWidth: 0 },
  mainGoalTop: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  mainGoalTitle: { color: colors.primary, flex: 1, fontFamily: typography.sans, fontSize: 14, fontWeight: '800' },
  mainGoalValue: { color: colors.text, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  mainGoalHint: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9 },
  compactGoalsRow: { flexDirection: 'row', gap: spacing.md },
  compactGoal: { ...shadows.card, backgroundColor: colors.surface, borderColor: '#EEF1EE', borderRadius: radii.lg, borderWidth: 1, flex: 1, gap: 8, minWidth: 0, padding: spacing.md },
  compactGoalTop: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  compactGoalIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 31, justifyContent: 'center', width: 31 },
  compactGoalLabel: { color: colors.text, flex: 1, fontFamily: typography.sans, fontSize: 10, fontWeight: '800' },
  compactGoalValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 9, fontWeight: '800', maxWidth: '43%' },
  activityCard: { ...shadows.card, backgroundColor: colors.surface, borderColor: '#EEF1EE', borderRadius: radii.lg, borderWidth: 1, paddingHorizontal: spacing.md },
  activityRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 61, paddingVertical: 9 },
  activityIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 35, justifyContent: 'center', width: 35 },
  activityIconSoft: { backgroundColor: '#E5F5E7' },
  activityIconPale: { backgroundColor: colors.paleGreen },
  activityCopy: { flex: 1, minWidth: 0 },
  activityTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 11, fontWeight: '800' },
  activityDescription: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 2 },
  activityDate: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8 },
  activityDivider: { backgroundColor: colors.border, height: 1, marginLeft: 47 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
});
