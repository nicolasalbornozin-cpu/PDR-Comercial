import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { MetricCard } from '@/components/MetricCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData, MetricSnapshot, roleLabels, VisibleProfile } from '@/types';
import { daysWithoutSale, delinquencyTone, isBirthdayToday, productivityTone, seniorEligibleUf } from '@/utils/commercialRules';
import { formatUF } from '@/utils/format';

function sumMetric(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  return workers.reduce((total, worker) => total + Number(latest[worker.id]?.[key] ?? 0), 0);
}

function averageMetric(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  const values = workers.map((worker) => latest[worker.id]?.[key]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function sellerDays(metric?: Partial<MetricSnapshot>): string {
  const days = daysWithoutSale(metric?.lastSaleDate);
  return days === null ? 'Sin fecha' : `${days} día${days === 1 ? '' : 's'}`;
}

function ScopeCard({ title, subtitle, sellers, data }: { title: string; subtitle: string; sellers: VisibleProfile[]; data: DashboardData }) {
  const annual = sellers.reduce((total, seller) => total + Number(data.annualEmittedUfByUser[seller.id] ?? 0), 0);
  const monthly = sellers.reduce((total, seller) => total + Number(data.monthlyEmittedUfByUser[seller.id] ?? 0), 0);
  const mora = averageMetric(sellers, data.latestByUser, 'delinquencyRate');
  const productivity = averageMetric(sellers, data.latestByUser, 'productivity');
  const cancellations = sumMetric(sellers, data.latestByUser, 'cancellationCount');
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
        <Text style={[styles.scopeStat, { color: delinquencyTone(mora) === 'red' ? colors.danger : delinquencyTone(mora) === 'gold' ? colors.goldText : colors.success }]}>Mora <Text style={styles.scopeStrong}>{mora.toFixed(1)}%</Text></Text>
        <Text style={[styles.scopeStat, productivity < 1 && styles.dangerText]}>Prod. <Text style={styles.scopeStrong}>{productivity.toFixed(2)}</Text></Text>
        <Text style={styles.scopeStat}>Anul. <Text style={styles.scopeStrong}>{cancellations}</Text></Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { isPreviewing, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user, { preview: isPreviewing })
      .then((result) => { if (active) { setData(result); setError(''); } })
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
  const moraRate = isSeller ? Number(ownMetric?.delinquencyRate ?? 0) : averageMetric(sellerRows, data?.latestByUser ?? {}, 'delinquencyRate');
  const productivity = isSeller ? Number(ownMetric?.productivity ?? 0) : averageMetric(sellerRows, data?.latestByUser ?? {}, 'productivity');
  const cancellations = isSeller ? Number(ownMetric?.cancellationCount ?? 0) : sumMetric(sellerRows, data?.latestByUser ?? {}, 'cancellationCount');
  const noSaleCount = isSeller
    ? daysWithoutSale(ownMetric?.lastSaleDate) ?? 0
    : sellerRows.filter((seller) => (daysWithoutSale(data?.latestByUser[seller.id]?.lastSaleDate) ?? 0) >= 3).length;
  const birthdayProfiles = data?.profiles.filter((profile) => isBirthdayToday(profile.birthDate)) ?? [];
  const debtInstallments = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtInstallmentsCount');
  const debtUf0 = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtUf0');
  const debtUf8 = sumMetric(sellerRows, data?.latestByUser ?? {}, 'debtUf8');

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
          <View style={styles.titleRow}>
            <View style={styles.flex}>
              <Text style={styles.screenTitle}>{isSeller ? 'Mi avance' : user?.role === 'coordinator' ? 'Mi equipo' : isManager ? 'Mis coordinaciones' : 'Vista general'}</Text>
              <Text style={styles.period}>{data?.periodLabel ?? 'Cargando última actualización…'}</Text>
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

          <View style={styles.metricsPair}>
            <MetricCard detail="cartera vigente" icon="alert-circle-outline" label="MORA" tone={delinquencyTone(moraRate)} value={`${moraRate.toFixed(1)}%`} />
            <MetricCard detail="emitidas" icon="briefcase-outline" label="PRODUCTIVIDAD" tone={productivityTone(productivity)} value={productivity.toFixed(2)} />
          </View>
          <View style={styles.metricsPair}>
            <MetricCard detail="del período" icon="close-circle-outline" label="ANULACIONES" tone={cancellations ? 'red' : 'green'} value={`${cancellations}`} />
            <MetricCard detail={isSeller ? 'desde última venta' : 'con 3+ días'} icon="calendar-outline" label="DÍAS SIN VENDER" tone={noSaleCount >= 3 ? 'red' : 'green'} value={`${noSaleCount}`} />
          </View>

          {isSeller ? (
            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>CATEGORÍA</Text>
                <Text style={styles.detailValue}>{ownMetric?.category ?? 'Sin foto publicada'}</Text>
                <Text style={styles.detailHint}>{ownMetric?.estimatedPrizeClp ? `$${ownMetric.estimatedPrizeClp.toLocaleString('es-CL')} estimado` : 'Solo ventas emitidas'}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>SENIOR · {data?.seniorOpen ? 'ABIERTO' : 'CERRADO'}</Text>
                <Text style={styles.detailValue}>{ownMetric?.seniorLevel ?? 'Sin foto publicada'}</Text>
                <Text style={styles.detailHint}>{formatUF(seniorEligibleUf(ownMetric, data?.seniorOpen ?? true))} UF · {data?.seniorOpen ? 'cantadas' : 'emitidas'}</Text>
              </View>
            </View>
          ) : null}

          {!isSeller && data ? (
            <View style={styles.debtCard}>
              <View style={styles.debtHeading}><Ionicons color={colors.goldText} name="wallet-outline" size={20} /><Text style={styles.debtTitle}>Cuotas en deuda</Text></View>
              <View style={styles.debtStats}>
                <View><Text style={styles.debtValue}>{debtInstallments}</Text><Text style={styles.debtLabel}>cuotas</Text></View>
                <View><Text style={styles.debtValue}>{formatUF(debtUf0)} UF</Text><Text style={styles.debtLabel}>tramo 0%</Text></View>
                <View><Text style={styles.debtValue}>{formatUF(debtUf8)} UF</Text><Text style={styles.debtLabel}>tramo 8%</Text></View>
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
                    return <ScopeCard data={data} key={coordinator.id} sellers={coordinatedSellers} subtitle={`${coordinatedSellers.length} vendedores`} title={coordinator.name} />;
                  })}
                  {!coordinators.length ? <Text style={styles.empty}>Aún no hay coordinadores asignados.</Text> : null}
                </View>
              ) : (
                <View style={styles.workerList}>
                  {sellerRows.map((seller, index) => {
                    const metric = data.latestByUser[seller.id];
                    const rate = Number(metric?.delinquencyRate ?? 0);
                    const sellerProductivity = Number(metric?.productivity ?? 0);
                    return (
                      <View key={seller.id} style={[styles.workerRow, index < sellerRows.length - 1 && styles.workerBorder]}>
                        <View style={styles.position}><Text style={styles.positionText}>{index + 1}</Text></View>
                        <View style={styles.workerMain}>
                          <Text numberOfLines={1} style={styles.workerName}>{seller.name}</Text>
                          <Text style={styles.workerMeta}>Mes {formatUF(data.monthlyEmittedUfByUser[seller.id] ?? 0)} UF · Sin vender: {sellerDays(metric)}</Text>
                          <Text style={styles.workerMeta}>Anul. {metric?.cancellationCount ?? 0} · Mora <Text style={{ color: delinquencyTone(rate) === 'red' ? colors.danger : delinquencyTone(rate) === 'gold' ? colors.goldText : colors.success }}>{rate.toFixed(1)}%</Text> · Prod. <Text style={sellerProductivity < 1 ? styles.dangerText : styles.successText}>{sellerProductivity.toFixed(2)}</Text></Text>
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
            <Text style={styles.privacyText}>Los indicadores generales consideran exclusivamente ventas emitidas. Senior abierto es la única excepción y usa ventas cantadas hasta su cierre.</Text>
          </View>
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
  content: { gap: spacing.lg, marginTop: -15, paddingHorizontal: spacing.xl },
  flex: { flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
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
  metricsPair: { flexDirection: 'row', gap: spacing.sm },
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
  dangerText: { color: colors.danger },
  successText: { color: colors.success },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.xl, textAlign: 'center' },
  privacyNote: { alignItems: 'flex-start', backgroundColor: colors.softGreen, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  privacyText: { color: colors.textMuted, flex: 1, fontFamily: typography.sans, fontSize: 10, lineHeight: 16 },
});
