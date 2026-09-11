import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { GoalCard } from '@/components/GoalCard';
import { RecentAchievements } from '@/components/RecentAchievements';
import { MetricCard } from '@/components/MetricCard';
import { ProgressBar } from '@/components/ProgressBar';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData, MetricSnapshot, roleLabels, VisibleProfile } from '@/types';
import { daysWithoutSale, isBirthdayToday, productivityTone, seniorEligibleUf } from '@/utils/commercialRules';
import { formatUF } from '@/utils/format';

function sumMetric(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  return workers.reduce((total, worker) => total + Number(latest[worker.id]?.[key] ?? 0), 0);
}

function averageMetric(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  const values = workers.map((worker) => latest[worker.id]?.[key]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function averageCount(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  return workers.length ? sumMetric(workers, latest, key) / workers.length : 0;
}

function sellerDays(metric?: Partial<MetricSnapshot>): string {
  const days = daysWithoutSale(metric?.lastSaleDate);
  return days === null ? 'Sin fecha' : `${days} día${days === 1 ? '' : 's'}`;
}

function ScopeCard({ title, subtitle, sellers, data, monthlyTarget }: { title: string; subtitle: string; sellers: VisibleProfile[]; data: DashboardData; monthlyTarget: number }) {
  const annual = sellers.reduce((total, seller) => total + Number(data.annualEmittedUfByUser[seller.id] ?? 0), 0);
  const monthly = sellers.reduce((total, seller) => total + Number(data.monthlyEmittedUfByUser[seller.id] ?? 0), 0);
  const mora = averageCount(sellers, data.latestByUser, 'debtSalesCount');
  const hasMora = sellers.some(w=>data.latestByUser[w.id]?.debtSalesCount !== undefined);
  const hasProductivity = sellers.some(w=>data.latestByUser[w.id]?.productivity !== undefined);
  const productivity = averageMetric(sellers, data.latestByUser, 'productivity');
  const cancellations = sumMetric(sellers, data.latestByUser, 'cancellationUf');
  return (
    <View style={styles.scopeCard}>
      <View style={styles.scopeHeading}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.workerName}>{title}</Text>
          <Text style={styles.workerMeta}>{subtitle}</Text>
        </View>
        <Text style={styles.workerUf}>{formatUF(annual)} UF</Text>
      </View>
      <View style={styles.scopeStats}>
        <Text style={styles.scopeStat}>Mes <Text style={styles.scopeStrong}>{formatUF(monthly)} UF</Text></Text>
        <Text style={[styles.scopeStat, { color: hasMora ? mora > 0 ? colors.danger : colors.success : colors.textMuted }]}>Mora prom. <Text style={styles.scopeStrong}>{hasMora ? `${mora.toFixed(1)} contratos` : '—'}</Text></Text>
        <Text style={[styles.scopeStat, hasProductivity && productivity < 1 && styles.dangerText]}>Prod. <Text style={styles.scopeStrong}>{hasProductivity ? productivity.toFixed(2) : '—'}</Text></Text>
        <Text style={styles.scopeStat}>Anul. <Text style={styles.scopeStrong}>{formatUF(cancellations)} UF</Text></Text>
      </View>
      <ProgressBar color={colors.secondary} height={7} progress={monthlyTarget ? monthly / monthlyTarget : 0} />
      <Text style={styles.progressCaption}>{monthlyTarget ? `${Math.round((monthly / monthlyTarget) * 100)}% del mejor resultado visible` : 'Sin ventas emitidas este mes'}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { isPreviewing, user } = useAuth();
  const [loaded, setLoaded] = useState<{userId:string;data:DashboardData}|null>(null);
  const data = loaded?.userId === user?.id ? loaded?.data ?? null : null;
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user, { preview: isPreviewing })
      .then((result) => { if (active) { setLoaded({userId:user.id,data:result}); setError(''); } })
      .catch(() => { if (active) setError('Error al comunicar con el servidor'); });
    return () => { active = false; };
  }, [isPreviewing, user]);

  const sellers = useMemo(
    () => data?.profiles.filter((profile) => profile.role === 'seller' && profile.active && profile.employmentStatus === 'active') ?? [],
    [data],
  );
  const coordinators = useMemo(
    () => data?.profiles.filter((profile) => profile.role === 'coordinator' && profile.active && profile.employmentStatus === 'active') ?? [],
    [data],
  );
  const sellerRows = useMemo(
    () => [...sellers].sort((left, right) => Number(data?.annualEmittedUfByUser[right.id] ?? 0) - Number(data?.annualEmittedUfByUser[left.id] ?? 0)),
    [data, sellers],
  );
  const ownMetric = user && data ? data.latestByUser[user.id] : undefined;
  const isSeller = user?.role === 'seller';
  const isManager = user?.role === 'sales_manager';
  const firstName = user?.name.split(' ')[0] ?? '';
  const totalAnnualUf = isSeller
    ? Number(data?.annualEmittedUfByUser[user?.id ?? ''] ?? 0)
    : sellerRows.reduce((total, seller) => total + Number(data?.annualEmittedUfByUser[seller.id] ?? 0), 0);
  const totalMonthlyUf = isSeller
    ? Number(data?.monthlyEmittedUfByUser[user?.id ?? ''] ?? 0)
    : sellerRows.reduce((total, seller) => total + Number(data?.monthlyEmittedUfByUser[seller.id] ?? 0), 0);
  const moraContracts = isSeller ? Number(ownMetric?.debtSalesCount ?? 0) : averageCount(sellerRows, data?.latestByUser ?? {}, 'debtSalesCount');
  const productivity = ownMetric?.productivity ?? averageMetric(sellerRows, data?.latestByUser ?? {}, 'productivity');
  const cancellations = isSeller ? Number(ownMetric?.cancellationUf ?? 0) : sumMetric(sellerRows, data?.latestByUser ?? {}, 'cancellationUf');
  const hasMora = isSeller ? ownMetric?.debtSalesCount !== undefined : sellerRows.some(w=>data?.latestByUser[w.id]?.debtSalesCount !== undefined);
  const hasProductivity = ownMetric?.productivity !== undefined || (!isSeller && sellerRows.some(w=>data?.latestByUser[w.id]?.productivity !== undefined));
  const hasSalesforce = isSeller ? ownMetric?.salesforceRecords !== undefined : sellerRows.some(w=>data?.latestByUser[w.id]?.salesforceRecords !== undefined);
  const noSaleCount = isSeller
    ? daysWithoutSale(ownMetric?.lastSaleDate) ?? 0
    : sellerRows.filter((seller) => (daysWithoutSale(data?.latestByUser[seller.id]?.lastSaleDate) ?? 0) >= 3).length;
  const birthdayProfiles = data?.profiles.filter((profile) => isBirthdayToday(profile.birthDate)) ?? [];
  const debtInstallments = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtInstallmentsCount');
  const debtUf08 = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtUf08');
  const debtSales = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtSalesCount');
  const bestMonthlyUf = Math.max(...sellerRows.map((seller) => Number(data?.monthlyEmittedUfByUser[seller.id] ?? 0)), 0);
  const rankingPosition = ownMetric?.rankingPosition;
  const salesforceRecords = isSeller ? Number(ownMetric?.salesforceRecords ?? 0) : sumMetric(sellerRows, data?.latestByUser ?? {}, 'salesforceRecords');
  const seniorUf = seniorEligibleUf(ownMetric, data?.seniorOpen ?? true);
  const seniorTarget = ownMetric?.seniorTargetUf;

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(248,247,243,0.34)', colors.background]} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <AppHeader />
            <View style={styles.greeting}>
              <Text style={styles.hello}>Hola, {firstName}</Text>
              <Text style={styles.team}>{user ? roleLabels[user.role] : 'Panel comercial'}</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.panelAccent} />
          <View style={styles.titleRow}>
            <View style={styles.titleIdentity}>
              <View style={styles.titleIcon}><Ionicons color={colors.secondary} name="leaf-outline" size={24} /></View>
              <View style={styles.flex}>
              <Text style={styles.screenTitle}>{isSeller ? 'Mi avance' : user?.role === 'coordinator' ? 'Mi equipo' : isManager ? 'Mis coordinaciones' : 'Vista general'}</Text>
              <Text style={styles.period}>{data?.periodLabel ?? 'Cargando última actualización…'}</Text>
              </View>
            </View>
            {user?.role === 'admin' ? (
              <Pressable onPress={() => router.push('/(tabs)/admin')} style={styles.adminShortcut}>
                <Ionicons color={colors.primary} name="settings-outline" size={20} />
              </Pressable>
            ) : null}
          </View>

          {birthdayProfiles.length ? (
            <View style={styles.birthdayCard}>
              <Ionicons color={colors.goldText} name="gift-outline" size={23} />
              <Text style={styles.birthdayText}>{birthdayProfiles.some((profile) => profile.id === user?.id) ? `¡Feliz cumpleaños, ${firstName}!` : `¡Feliz cumpleaños, ${birthdayProfiles.map((profile) => profile.name.split(' ')[0]).join(', ')}!`}</Text>
            </View>
          ) : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}

          <View style={styles.salesCard}>
            <Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={120} style={styles.leaf} />
            <Text style={styles.salesLabel}>VENTAS EMITIDAS ACUMULADAS DEL AÑO</Text>
            <Text style={styles.salesValue}>{formatUF(totalAnnualUf)} <Text style={styles.salesUnit}>UF</Text></Text>
            <Text style={styles.updated}>Mes comercial: {formatUF(totalMonthlyUf)} UF · {data?.periodLabel ?? 'sin datos publicados'}</Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard detail={hasMora ? isSeller ? 'contratos en mora' : 'promedio por vendedor' : 'sin mora cargada'} icon="alert-circle-outline" label="MORA" tone={hasMora && moraContracts > 0 ? 'red' : 'green'} value={hasMora ? isSeller ? `${moraContracts}` : moraContracts.toFixed(1) : '—'} />
            <MetricCard detail={hasProductivity?'según Producción':'sin datos cargados'} icon="briefcase-outline" label="PRODUCTIVIDAD" tone={hasProductivity?productivityTone(productivity):'gold'} value={hasProductivity?productivity.toFixed(2):'—'} />
            <MetricCard detail={isSeller ? 'posición anual' : 'personas visibles'} icon="trophy-outline" label={isSeller ? 'RANKING' : 'EQUIPO'} tone="gold" value={isSeller ? rankingPosition !== undefined ? `#${rankingPosition}` : '—' : `${sellerRows.length}`} />
            <MetricCard detail={hasSalesforce?'registros':'sin datos cargados'} icon="cloud-outline" label="SALESFORCE" value={hasSalesforce?`${salesforceRecords}`:'—'} />
          </View>

          {isSeller ? <View style={styles.secondaryMetrics}><View style={styles.secondaryMetric}><View style={[styles.secondaryIcon, ownMetric?.sauceRisk !== undefined && ownMetric.sauceRisk > 30 ? styles.dangerBackground : undefined]}><Ionicons name="shield-checkmark-outline" color={ownMetric?.sauceRisk !== undefined && ownMetric.sauceRisk > 30 ? colors.danger : colors.goldText} size={20}/></View><View><Text style={styles.secondaryLabel}>Riesgo Sauce</Text><Text style={[styles.secondaryValue, ownMetric?.sauceRisk !== undefined && ownMetric.sauceRisk > 30 ? styles.dangerText : undefined]}>{ownMetric?.sauceRisk === undefined ? 'Sin dato' : `${ownMetric.sauceRisk.toFixed(1)}%`}</Text></View></View></View> : null}
          <View style={styles.secondaryMetrics}>
            <View style={styles.secondaryMetric}>
              <View style={[styles.secondaryIcon, { backgroundColor: cancellations ? '#FBECE9' : colors.softGreen }]}><Ionicons color={cancellations ? colors.danger : colors.success} name="close-circle-outline" size={19} /></View>
              <View><Text style={styles.secondaryLabel}>Anulaciones Senior</Text><Text style={[styles.secondaryValue, cancellations ? styles.dangerText : styles.successText]}>{formatUF(cancellations)} UF</Text></View>
            </View>
            <View style={styles.secondaryDivider} />
            <View style={styles.secondaryMetric}>
              <View style={[styles.secondaryIcon, { backgroundColor: noSaleCount >= 3 ? '#FBECE9' : colors.softGreen }]}><Ionicons color={noSaleCount >= 3 ? colors.danger : colors.success} name="calendar-outline" size={19} /></View>
              <View><Text style={styles.secondaryLabel}>Días sin vender</Text><Text style={[styles.secondaryValue, noSaleCount >= 3 ? styles.dangerText : styles.successText]}>{isSeller ? sellerDays(ownMetric) : `${noSaleCount} personas`}</Text></View>
            </View>
          </View>

          {isSeller ? (
            <View style={styles.goalsSection}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionTitleRow}><View style={styles.sectionIcon}><Ionicons color={colors.secondary} name="locate-outline" size={20} /></View><Text style={styles.sectionTitle}>Mis metas</Text></View>
                <Pressable onPress={() => router.push('/goals')}><Text style={styles.detailLink}>Ver detalle  ›</Text></Pressable>
              </View>
              <GoalCard icon="diamond-outline" badge={`${ownMetric?.smadCount ?? '—'} SMAD`} insight={ownMetric?.seniorRemaining ?? 'Sin carga Senior publicada'} progress={seniorTarget ? seniorUf / seniorTarget : 0} title={ownMetric?.seniorLevel ?? 'Senior'} value={ownMetric?.eligibleTotalUf !== undefined ? `${formatUF(seniorUf)} UF` : 'Sin datos'} />
              <Pressable onPress={() => router.push({ pathname: '/goals', params: { focus: 'category' } })} style={({ pressed }) => pressed && styles.pressed}>
                <GoalCard badge={ownMetric?.category ?? 'Sin categoría'} icon="star-outline" insight="Toca para ver el período y el estado de emisión" progress={ownMetric?.categoryTargetUf ? (ownMetric.categoryUf??0)/ownMetric.categoryTargetUf : 0} title={ownMetric?.categoryLabel??'Catego'} tone="green" value={ownMetric?.categoryUf!==undefined?`${formatUF(ownMetric.categoryUf)} UF`:'Sin datos'} />
              </Pressable>
            </View>
          ) : null}

          {!isSeller && data ? (
            <View style={styles.debtCard}>
              <View style={styles.debtHeading}><Ionicons color={colors.goldText} name="wallet-outline" size={20} /><Text style={styles.debtTitle}>Cuotas en deuda</Text></View>
              <View style={styles.debtStats}>
                <View><Text style={styles.debtValue}>{debtInstallments}</Text><Text style={styles.debtLabel}>cuotas</Text></View>
                <View><Text style={styles.debtValue}>{formatUF(debtUf08)} UF</Text><Text style={styles.debtLabel}>grupo 0–8%</Text></View>
                <View><Text style={styles.debtValue}>{debtSales}</Text><Text style={styles.debtLabel}>ventas en mora</Text></View>
              </View>
            </View>
          ) : null}

          {!isSeller && data ? (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{isManager ? 'Detalle por coordinador' : 'Detalle de vendedores'}</Text>
                <Text style={styles.sectionCount}>{isManager ? coordinators.length : sellerRows.length} visibles</Text>
              </View>
              {isManager ? (
                <View style={styles.workerList}>
                  {coordinators.map((coordinator) => {
                    const coordinatedSellers = sellerRows.filter((seller) => seller.supervisorId === coordinator.id);
                    const coordinatorMonthly = coordinatedSellers.reduce((total, seller) => total + Number(data.monthlyEmittedUfByUser[seller.id] ?? 0), 0);
                    const bestCoordination = Math.max(...coordinators.map((item) => sellerRows.filter((seller) => seller.supervisorId === item.id).reduce((total, seller) => total + Number(data.monthlyEmittedUfByUser[seller.id] ?? 0), 0)), coordinatorMonthly);
                    return <ScopeCard data={data} key={coordinator.id} monthlyTarget={bestCoordination} sellers={coordinatedSellers} subtitle={`${coordinatedSellers.length} vendedores`} title={coordinator.name} />;
                  })}
                  {!coordinators.length ? <Text style={styles.empty}>Aún no hay coordinadores asignados.</Text> : null}
                </View>
              ) : (
                <View style={styles.workerList}>
                  {sellerRows.map((seller, index) => {
                    const metric = data.latestByUser[seller.id];
                    const mora = Number(metric?.debtSalesCount ?? 0);
                    const sellerProductivity = Number(metric?.productivity ?? 0);
                    return (
                      <View key={seller.id} style={[styles.workerRow, index < sellerRows.length - 1 && styles.workerBorder]}>
                        <View style={styles.position}><Text style={styles.positionText}>{index + 1}</Text></View>
                        <View style={styles.workerMain}>
                          <Text numberOfLines={1} style={styles.workerName}>{seller.name}</Text>
                          <Text style={styles.workerMeta}>Mes {formatUF(data.monthlyEmittedUfByUser[seller.id] ?? 0)} UF · Sin vender: {sellerDays(metric)}</Text>
                          <Text style={styles.workerMeta}>Anul. {metric?.cancellationUf === undefined ? '—' : `${formatUF(metric.cancellationUf)} UF`} · Mora <Text style={{ color: metric?.debtSalesCount === undefined ? colors.textMuted : mora > 0 ? colors.danger : colors.success }}>{metric?.debtSalesCount === undefined ? '—' : `${mora} contratos`}</Text> · Prod. <Text style={metric?.productivity === undefined ? styles.workerMeta : sellerProductivity < 1 ? styles.dangerText : styles.successText}>{metric?.productivity === undefined ? '—' : sellerProductivity.toFixed(2)}</Text></Text>
                          <View style={styles.workerProgress}><ProgressBar color={mora > 0 ? colors.danger : colors.secondary} height={5} progress={bestMonthlyUf ? Number(data.monthlyEmittedUfByUser[seller.id] ?? 0) / bestMonthlyUf : 0} /></View>
                        </View>
                        <Text style={styles.workerUf}>{formatUF(data.annualEmittedUfByUser[seller.id] ?? 0)} UF</Text>
                      </View>
                    );
                  })}
                  {!sellerRows.length ? <Text style={styles.empty}>Aún no hay vendedores asignados o datos emitidos publicados.</Text> : null}
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.privacyNote}>
            <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={21} />
            <Text style={styles.privacyText}>Ventas acumuladas y rankings: solo emitidas. Producción y Catego conservan los resultados de sus hojas cargadas. Senior abierto admite cantadas; el cierre requiere una nueva carga recalculada con emitidas.</Text>
          </View>
          <RecentAchievements data={data} />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 30 },
  mobileFrame: { maxWidth: 700, width: '100%' },
  hero: { height: 225, overflow: 'hidden' },
  heroContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  greeting: { marginTop: 35 },
  hello: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600' },
  team: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, fontWeight: '700', marginTop: 3 },
  content: { ...shadows.floating, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: spacing.lg, marginTop: -35, overflow: 'hidden', paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  panelAccent: { backgroundColor: colors.gold, borderRadius: radii.pill, height: 3, left: spacing.xl, position: 'absolute', top: 0, width: 52 },
  flex: { flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  titleIdentity: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md },
  titleIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 48, justifyContent: 'center', width: 48 },
  screenTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 27, fontWeight: '600' },
  period: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: 3 },
  adminShortcut: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  loader: { paddingVertical: spacing.xxl },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.md },
  birthdayCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.goldSoft, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  birthdayText: { color: colors.goldText, flex: 1, fontFamily: typography.serif, fontSize: 18, fontWeight: '600' },
  salesCard: { ...shadows.floating, backgroundColor: colors.primary, borderRadius: radii.xl, minHeight: 158, overflow: 'hidden', padding: spacing.xl },
  leaf: { bottom: -34, position: 'absolute', right: -13 },
  salesLabel: { color: 'rgba(255,255,255,0.67)', fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  salesValue: { color: colors.surface, fontFamily: typography.serif, fontSize: 40, fontWeight: '600', marginTop: spacing.md },
  salesUnit: { color: colors.goldOnDark, fontFamily: typography.sans, fontSize: 15, fontWeight: '800' },
  updated: { color: 'rgba(255,255,255,0.57)', fontFamily: typography.sans, fontSize: 9, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: 7 },
  secondaryMetrics: { ...shadows.card, alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', minHeight: 76, paddingHorizontal: spacing.md },
  secondaryMetric: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm },
  secondaryIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  dangerBackground: { backgroundColor: '#FBECE9' },
  secondaryLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9 },
  secondaryValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800', marginTop: 2 },
  secondaryDivider: { backgroundColor: colors.border, height: 42, marginHorizontal: spacing.sm, width: 1 },
  goalsSection: { gap: spacing.md },
  goalPair: { flexDirection: 'row', gap: spacing.md },
  sectionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sectionIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 38, justifyContent: 'center', width: 38 },
  detailLink: { color: colors.goldText, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  detailGrid: { flexDirection: 'row', gap: spacing.md },
  detailCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, minHeight: 116, padding: spacing.lg },
  detailLabel: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  detailValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 19, fontWeight: '600', marginTop: spacing.sm },
  detailHint: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: spacing.sm },
  debtCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.md, padding: spacing.lg },
  debtHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  debtTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 18, fontWeight: '600' },
  debtStats: { flexDirection: 'row', justifyContent: 'space-between' },
  debtValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 16, fontWeight: '900' },
  debtLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 2 },
  section: { gap: spacing.md },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 21, fontWeight: '600' },
  sectionCount: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  workerList: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', paddingHorizontal: spacing.md },
  workerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 82, paddingVertical: spacing.md },
  workerBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  position: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  positionText: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '900' },
  workerMain: { flex: 1 },
  workerName: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  workerMeta: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 4 },
  workerUf: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '900' },
  scopeCard: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.sm, paddingVertical: spacing.lg },
  scopeHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  scopeStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  scopeStat: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9 },
  scopeStrong: { fontWeight: '900' },
  progressCaption: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8 },
  workerProgress: { marginTop: spacing.sm },
  dangerText: { color: colors.danger },
  successText: { color: colors.success },
  pressed: { opacity: 0.8, transform: [{ scale: 0.992 }] },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.xl, textAlign: 'center' },
  privacyNote: { alignItems: 'flex-start', backgroundColor: colors.softGreen, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  privacyText: { color: colors.textMuted, flex: 1, fontFamily: typography.sans, fontSize: 10, lineHeight: 16 },
});
