import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/DetailHeader';
import { GoalCard } from '@/components/GoalCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData, MetricSnapshot } from '@/types';
import { formatDate, formatUF, getProgress } from '@/utils/format';

type GoalKind = 'senior' | 'category';
type GoalVersion = 'current' | 'previous';

function missingSmad(snapshot: Partial<MetricSnapshot> | undefined, kind: GoalKind): number | undefined {
  if (snapshot?.smadRemaining !== undefined) return snapshot.smadRemaining;
  const remaining = kind === 'category' ? snapshot?.categoryRemaining : snapshot?.seniorRemaining;
  const parsed = /(?:Y\s+)?(\d+)\s*SMAD\b/i.exec(remaining ?? '');
  if (parsed) return Number(parsed[1]);
  return undefined;
}

function pendingUf(snapshot: Partial<MetricSnapshot> | undefined, total: number | undefined): number | undefined {
  if (snapshot?.notEmittedUf !== undefined) return snapshot.notEmittedUf;
  return total !== undefined && snapshot?.emittedUf !== undefined ? Math.max(total - snapshot.emittedUf, 0) : undefined;
}

function categoryPeriodName(snapshot: Partial<MetricSnapshot> | undefined, fallback: string): string {
  const label = snapshot?.categoryLabel?.replace(/^catego\s*[·:-]?\s*/i, '').trim();
  return label || fallback;
}

export default function GoalsScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { isPreviewing, user } = useAuth();
  const [loaded, setLoaded] = useState<{userId:string;data:DashboardData}|null>(null);
  const [openGoal, setOpenGoal] = useState<GoalKind | null>(focus === 'category' || focus === 'senior' ? focus : null);
  const [periodView, setPeriodView] = useState<Record<GoalKind, GoalVersion>>({ senior: 'current', category: 'current' });
  const data = loaded?.userId === user?.id ? loaded?.data ?? null : null;

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user, { preview: isPreviewing }).then((result) => {
      if (active) setLoaded({userId:user.id,data:result});
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isPreviewing, user]);

  const metric = user && data ? data.latestByUser[user.id] : undefined;
  const snapshotsFor = (kind: GoalKind) => user ? (data?.snapshots.filter((snapshot) => snapshot.userId === user.id && snapshot.kind === kind).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt)) ?? []) : [];
  const seniorSnapshots = snapshotsFor('senior');
  const categorySnapshots = snapshotsFor('category');
  const seniorSnapshot = periodView.senior === 'previous' && seniorSnapshots[1] ? seniorSnapshots[1] : seniorSnapshots[0];
  const categorySnapshot = periodView.category === 'previous' && categorySnapshots[1] ? categorySnapshots[1] : categorySnapshots[0];
  const seniorValue = Number(metric?.eligibleTotalUf ?? metric?.quarterTotalUf ?? 0);
  const categoryValue = Number(metric?.categoryUf ?? 0);
  const categoryTarget = metric?.categoryTargetUf ?? 0;
  const categoryPending = metric?.categoryNotEmittedUf !== undefined
    ? metric.categoryNotEmittedUf
    : metric?.categoryUf !== undefined && metric?.categoryEmittedUf !== undefined
      ? Math.max(metric.categoryUf - metric.categoryEmittedUf, 0)
      : undefined;
  const validLevel = (level?:string) => Boolean(level && !/^(no|sin|pendiente|en carrera)/i.test(level));
  const completed = Number(validLevel(metric?.category)) + Number(validLevel(metric?.seniorLevel));
  const available = Number(metric?.categoryUf !== undefined) + Number(metric?.eligibleTotalUf !== undefined);
  const firstName = user?.name.split(' ')[0] ?? 'Erika';
  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(248,247,243,0.18)', 'rgba(248,247,243,0.45)', colors.background]} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <DetailHeader title="Mis metas" />
            <View style={styles.heroTitleBlock}>
              <Text style={styles.title}>Mis metas</Text>
              <Text style={styles.subtitle}>Tu progreso actualizado al día de hoy</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <View style={styles.summaryIcon}><Ionicons color={colors.secondary} name="checkmark-circle" size={21} /></View>
              <View>
                <Text style={styles.summaryValue}>{completed}</Text>
                <Text style={styles.summaryLabel}>metas cumplidas</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, styles.summaryIconGold]}><Ionicons color={colors.gold} name="hourglass-outline" size={20} /></View>
              <View>
                <Text style={styles.summaryValue}>{Math.max(available-completed,0)}</Text>
                <Text style={styles.summaryLabel}>en progreso</Text>
              </View>
            </View>
          </View>

          {!data ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: openGoal === 'senior' }} onPress={() => setOpenGoal((current) => current === 'senior' ? null : 'senior')} style={({ pressed }) => [styles.goalButton, pressed && styles.pressed]}>
            <GoalCard badge={`Senior ${data?.seniorOpen ? 'abierto' : 'cerrado'} · ${metric?.smadCount ?? '—'} SMAD`} icon="diamond-outline" insight={openGoal === 'senior' ? 'Toca para ocultar el detalle' : metric?.seniorRemaining ? `${metric.seniorRemaining} · Toca para ver detalle` : 'Sin carga Senior publicada'} progress={getProgress(seniorValue,metric?.seniorTargetUf??0)} title={metric?.seniorLevel ?? 'Senior'} value={metric?.eligibleTotalUf !== undefined ? `${formatUF(seniorValue)} UF` : 'Sin datos'} />
          </Pressable>
          {openGoal === 'senior' ? (
            <View style={[styles.goalDetail, styles.seniorDetail]}>
              <View style={styles.periodTabs}>
                <Pressable onPress={() => setPeriodView((current) => ({ ...current, senior: 'current' }))} style={[styles.periodTab, periodView.senior === 'current' && styles.periodTabActive]}><Text style={[styles.periodTabText, periodView.senior === 'current' && styles.periodTabTextActive]}>Vigente</Text></Pressable>
                <Pressable disabled={!seniorSnapshots[1]} onPress={() => setPeriodView((current) => ({ ...current, senior: 'previous' }))} style={[styles.periodTab, periodView.senior === 'previous' && styles.periodTabActive, !seniorSnapshots[1] && styles.periodTabDisabled]}><Text style={[styles.periodTabText, periodView.senior === 'previous' && styles.periodTabTextActive]}>Pasada</Text></Pressable>
              </View>
              <View style={styles.detailHeader}>
                <View style={styles.detailIconGold}><Ionicons color={colors.goldText} name="diamond-outline" size={22} /></View>
                <View style={styles.detailHeading}>
                  <Text style={styles.detailEyebrow}>PERÍODO SENIOR</Text>
                  <Text style={styles.detailTitle}>{seniorSnapshot ? `${formatDate(seniorSnapshot.periodStart)} al ${formatDate(seniorSnapshot.periodEnd)}` : 'Sin período publicado'}</Text>
                </View>
              </View>
              <View style={styles.ufComparison}>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>UF brutas totales</Text><Text style={styles.ufMetricValue}>{seniorSnapshot?.eligibleTotalUf === undefined ? 'Sin dato' : `${formatUF(seniorSnapshot.eligibleTotalUf)} UF`}</Text></View>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>UF emitidas</Text><Text style={styles.ufMetricValue}>{seniorSnapshot?.emittedUf === undefined ? 'Sin dato' : `${formatUF(seniorSnapshot.emittedUf)} UF`}</Text></View>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>Sin emitir</Text><Text style={[styles.ufMetricValue, styles.pendingValue]}>{pendingUf(seniorSnapshot, seniorSnapshot?.eligibleTotalUf) === undefined ? 'Sin dato' : `${formatUF(pendingUf(seniorSnapshot, seniorSnapshot?.eligibleTotalUf)!)} UF`}</Text></View>
              </View>
              <View style={styles.requirementsSection}>
                <Text style={styles.requirementsTitle}>Solo falta para cumplir</Text>
                <View style={styles.requirementsGrid}>
                  {([
                    { icon: 'ribbon-outline' as const, label: 'SMAD', value: missingSmad(seniorSnapshot, 'senior') },
                    { icon: 'bed-outline' as const, label: 'Descansos', value: seniorSnapshot?.restRemaining },
                    { icon: 'layers-outline' as const, label: 'SSFF', value: seniorSnapshot?.ssffRemaining },
                  ]).filter((item) => (item.value ?? 0) > 0).map((item) => (
                    <View key={item.label} style={styles.requirementCard}>
                      <View style={styles.requirementIcon}><Ionicons color={colors.goldText} name={item.icon} size={18} /></View>
                      <Text style={styles.requirementValue}>{item.value}</Text>
                      <Text style={styles.requirementLabel}>{item.label}</Text>
                    </View>
                  ))}
                  {![missingSmad(seniorSnapshot, 'senior'), seniorSnapshot?.restRemaining, seniorSnapshot?.ssffRemaining].some((value) => (value ?? 0) > 0) ? (
                    <View style={styles.requirementsComplete}><Ionicons color={colors.success} name="checkmark-circle" size={20} /><Text style={styles.requirementsCompleteText}>Requisitos complementarios cumplidos</Text></View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.detailNote}>{seniorSnapshot?.seniorRemaining ?? 'Sin detalle de tramo publicado.'}</Text>
            </View>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: openGoal === 'category' }} onPress={() => setOpenGoal((current) => current === 'category' ? null : 'category')} style={({ pressed }) => [styles.goalButton, pressed && styles.pressed]}>
            <GoalCard badge={`${metric?.category ?? 'Sin categoría'} · sin emitir`} icon="star" insight={openGoal === 'category' ? 'Toca para ocultar el detalle' : 'Toca para ver el período y la emisión'} progress={getProgress(categoryValue,categoryTarget)} title={metric?.categoryLabel ?? 'Catego'} tone="green" value={categoryPending !== undefined ? `${formatUF(categoryPending)} UF` : 'Sin datos'} />
          </Pressable>
          {openGoal === 'category' ? (
            <View style={[styles.goalDetail, styles.categoryDetail]}>
              <View style={styles.periodTabs}>
                <Pressable onPress={() => setPeriodView((current) => ({ ...current, category: 'current' }))} style={[styles.periodTab, periodView.category === 'current' && styles.periodTabActive]}><Text style={[styles.periodTabText, periodView.category === 'current' && styles.periodTabTextActive]}>Vigente</Text><Text numberOfLines={1} style={[styles.periodTabLabel, periodView.category === 'current' && styles.periodTabTextActive]}>{categoryPeriodName(categorySnapshots[0], 'Actual')}</Text></Pressable>
                <Pressable disabled={!categorySnapshots[1]} onPress={() => setPeriodView((current) => ({ ...current, category: 'previous' }))} style={[styles.periodTab, periodView.category === 'previous' && styles.periodTabActive, !categorySnapshots[1] && styles.periodTabDisabled]}><Text style={[styles.periodTabText, periodView.category === 'previous' && styles.periodTabTextActive]}>Anterior</Text><Text numberOfLines={1} style={[styles.periodTabLabel, periodView.category === 'previous' && styles.periodTabTextActive]}>{categoryPeriodName(categorySnapshots[1], 'Sin carga anterior')}</Text></Pressable>
              </View>
              <View style={styles.detailHeader}>
                <View style={styles.detailIconGreen}><Ionicons color={colors.success} name="calendar-outline" size={22} /></View>
                <View style={styles.detailHeading}>
                  <Text style={styles.detailEyebrow}>PERÍODO DE CATEGO</Text>
                  <Text style={styles.detailTitle}>{categorySnapshot?.categoryLabel ?? 'Período de Catego sin publicar'}</Text>
                  {categorySnapshot ? <Text style={styles.detailDates}>{formatDate(categorySnapshot.periodStart)} al {formatDate(categorySnapshot.periodEnd)}</Text> : null}
                </View>
              </View>
              <View style={styles.ufComparison}>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>UF brutas totales</Text><Text style={styles.ufMetricValue}>{categorySnapshot?.categoryUf === undefined ? 'Sin dato' : `${formatUF(categorySnapshot.categoryUf)} UF`}</Text></View>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>UF emitidas</Text><Text style={styles.ufMetricValue}>{categorySnapshot?.emittedUf === undefined ? 'Sin dato' : `${formatUF(categorySnapshot.emittedUf)} UF`}</Text></View>
                <View style={styles.ufMetric}><Text style={styles.detailMetricLabel}>Sin emitir</Text><Text style={[styles.ufMetricValue, styles.pendingValue]}>{pendingUf(categorySnapshot, categorySnapshot?.categoryUf) === undefined ? 'Sin dato' : `${formatUF(pendingUf(categorySnapshot, categorySnapshot?.categoryUf)!)} UF`}</Text></View>
              </View>
              <View style={styles.smadPanel}>
                <View><Text style={styles.detailMetricLabel}>SMAD actuales</Text><Text style={styles.smadValue}>{categorySnapshot?.smadCount ?? 'Sin dato'}</Text></View>
                <Ionicons color={colors.goldText} name="arrow-forward" size={19} />
                <View><Text style={styles.detailMetricLabel}>SMAD que faltan</Text><Text style={styles.smadValue}>{missingSmad(categorySnapshot, 'category') ?? 'Sin dato'}</Text></View>
              </View>
              <Text style={styles.detailNote}>{categorySnapshot?.categoryRemaining ?? 'Sin detalle de tramo publicado.'}</Text>
              {categorySnapshot?.emittedUf === undefined ? <Text style={styles.emissionNote}>El desglose aparecerá al publicar Carga Catego con CANTO y Base TRIO dentro del mismo archivo.</Text> : null}
            </View>
          ) : null}

          <View style={styles.motivation}>
            <View style={styles.leaf}><Ionicons color="rgba(39,114,80,0.13)" name="leaf-outline" size={92} /></View>
            <Ionicons color={colors.gold} name="sparkles-outline" size={24} />
            <Text style={styles.motivationTitle}>¡Vas por un gran camino, {firstName}!</Text>
            <Text style={styles.motivationText}>Sigue así, cada meta te acerca al éxito.</Text>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 34 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 252 },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 2 },
  heroTitleBlock: { marginTop: 46 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 4 },
  content: { gap: spacing.lg, marginTop: -27, paddingHorizontal: spacing.xl },
  loader: { paddingVertical: spacing.xl },
  summary: { ...shadows.floating, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, flexDirection: 'row', justifyContent: 'space-around', minHeight: 92, paddingHorizontal: spacing.lg },
  summaryItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  summaryIconGold: { backgroundColor: colors.goldSoft },
  summaryValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  summaryLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  divider: { backgroundColor: colors.border, height: 42, width: 1 },
  goalButton: { borderRadius: radii.lg },
  pressed: { opacity: 0.8, transform: [{ scale: 0.992 }] },
  goalDetail: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, gap: spacing.lg, padding: spacing.lg },
  seniorDetail: { borderColor: '#E8D39D' },
  categoryDetail: { borderColor: '#BCD9C9' },
  periodTabs: { alignSelf: 'stretch', backgroundColor: colors.paleGreen, borderRadius: radii.pill, flexDirection: 'row', padding: 4 },
  periodTab: { alignItems: 'center', borderRadius: radii.pill, flex: 1, minHeight: 34, justifyContent: 'center' },
  periodTabActive: { backgroundColor: colors.primary },
  periodTabDisabled: { opacity: 0.4 },
  periodTabText: { color: colors.primary, fontFamily: typography.sans, fontSize: 10, fontWeight: '800' },
  periodTabLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8, marginTop: 1, maxWidth: '94%' },
  periodTabTextActive: { color: colors.surface },
  detailHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  detailHeading: { flex: 1 },
  detailIconGold: { alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.pill, height: 46, justifyContent: 'center', width: 46 },
  detailIconGreen: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 46, justifyContent: 'center', width: 46 },
  detailEyebrow: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  detailTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 18, fontWeight: '600', marginTop: 2 },
  detailDates: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: 3 },
  detailGrid: { flexDirection: 'row', gap: spacing.sm },
  detailMetric: { backgroundColor: colors.paleGreen, borderRadius: radii.md, flex: 1, minWidth: 0, padding: spacing.md },
  detailMetricLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8 },
  detailMetricValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '900', marginTop: 4 },
  detailNote: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, lineHeight: 15 },
  ufComparison: { flexDirection: 'row', gap: spacing.sm },
  ufMetric: { backgroundColor: colors.paleGreen, borderRadius: radii.md, flex: 1, gap: 4, minWidth: 0, padding: spacing.md },
  ufMetricValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '900' },
  smadPanel: { alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.md, flexDirection: 'row', justifyContent: 'space-around', padding: spacing.md },
  smadValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 22, fontWeight: '700', marginTop: 2 },
  requirementsSection: { backgroundColor: colors.goldSoft, borderRadius: radii.md, gap: spacing.sm, padding: spacing.md },
  requirementsTitle: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  requirementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  requirementCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: '#E8D39D', borderRadius: radii.md, borderWidth: 1, flex: 1, minWidth: 78, paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  requirementIcon: { alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  requirementValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 23, fontWeight: '700', marginTop: 5 },
  requirementLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8, fontWeight: '700' },
  requirementsComplete: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  requirementsCompleteText: { color: colors.success, fontFamily: typography.sans, fontSize: 10, fontWeight: '800' },
  emissionRow: { alignItems: 'center', flexDirection: 'row' },
  emissionItem: { flex: 1, gap: 4 },
  emissionDivider: { backgroundColor: colors.border, height: 42, marginHorizontal: spacing.md, width: 1 },
  emissionLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  emissionValue: { color: colors.success, fontFamily: typography.serif, fontSize: 20, fontWeight: '700' },
  pendingValue: { color: colors.warning },
  emissionNote: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, lineHeight: 15 },
  moraCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.lg, padding: spacing.xl },
  moraTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  moraTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  moraIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.md, height: 46, justifyContent: 'center', width: 46 },
  moraTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 19, fontWeight: '600' },
  moraSub: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, marginTop: 2 },
  moraValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 25, fontWeight: '900' },
  meterWrap: { paddingTop: 8, position: 'relative' },
  meter: { borderRadius: radii.pill, flexDirection: 'row', height: 10, overflow: 'hidden' },
  meterSegment: { height: '100%' },
  meterGreen: { backgroundColor: colors.secondary, flex: 0.46 },
  meterYellow: { backgroundColor: '#DFB84B', flex: 0.28 },
  meterRed: { backgroundColor: colors.danger, flex: 0.26 },
  marker: { alignItems: 'center', bottom: -6, marginLeft: -7, position: 'absolute' },
  markerDot: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 7, borderWidth: 3, height: 14, width: 14 },
  objectiveRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  objectiveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  motivation: { backgroundColor: colors.softGreen, borderRadius: radii.xl, gap: 7, overflow: 'hidden', padding: spacing.xl },
  leaf: { bottom: -30, position: 'absolute', right: -10, transform: [{ rotate: '-20deg' }] },
  motivationTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 20, fontWeight: '600' },
  motivationText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12 },
});
