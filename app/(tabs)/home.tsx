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
import { formatUF } from '@/utils/format';

function metricUf(metric?: Partial<MetricSnapshot>): number {
  return metric?.productionUf ?? metric?.eligibleTotalUf ?? metric?.quarterTotalUf ?? 0;
}

function sumMetric(workers: VisibleProfile[], latest: DashboardData['latestByUser'], key: keyof MetricSnapshot): number {
  return workers.reduce((total, worker) => total + Number(latest[worker.id]?.[key] ?? 0), 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user)
      .then((result) => { if (active) setData(result); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : 'No fue posible cargar el tablero.'); });
    return () => { active = false; };
  }, [user]);

  const sellers = useMemo(
    () => data?.profiles.filter((profile) => profile.role === 'seller' && profile.active) ?? [],
    [data],
  );
  const ownMetric = user && data ? data.latestByUser[user.id] : undefined;
  const sellerRows = useMemo(
    () => [...sellers].sort((left, right) => metricUf(data?.latestByUser[right.id]) - metricUf(data?.latestByUser[left.id])),
    [data, sellers],
  );
  const isSeller = user?.role === 'seller';
  const firstName = user?.name.split(' ')[0] ?? '';
  const totalUf = isSeller ? metricUf(ownMetric) : sellerRows.reduce((total, seller) => total + metricUf(data?.latestByUser[seller.id]), 0);
  const totalMora = isSeller ? ownMetric?.delinquentClientsCount ?? 0 : sumMetric(sellerRows, data?.latestByUser ?? {}, 'delinquentClientsCount');
  const totalSalesforce = isSeller ? ownMetric?.salesforceRecords ?? 0 : sumMetric(sellerRows, data?.latestByUser ?? {}, 'salesforceRecords');
  const totalBusinesses = isSeller ? ownMetric?.businessCount ?? 0 : sumMetric(sellerRows, data?.latestByUser ?? {}, 'businessCount');

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
            <View>
              <Text style={styles.screenTitle}>{isSeller ? 'Mi avance' : user?.role === 'coordinator' ? 'Mi equipo' : user?.role === 'sales_manager' ? 'Mi jefatura' : 'Vista general'}</Text>
              <Text style={styles.period}>{data?.periodLabel ?? 'Cargando última foto…'}</Text>
            </View>
            {user?.role === 'admin' ? (
              <Pressable onPress={() => router.push('/(tabs)/admin')} style={styles.adminShortcut}>
                <Ionicons color={colors.primary} name="settings-outline" size={20} />
              </Pressable>
            ) : null}
          </View>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}

          <View style={styles.salesCard}>
            <Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={120} style={styles.leaf} />
            <Text style={styles.salesLabel}>{isSeller ? 'VENTA / PRODUCCIÓN ACUMULADA' : 'PRODUCCIÓN DEL EQUIPO VISIBLE'}</Text>
            <Text style={styles.salesValue}>{formatUF(totalUf)} <Text style={styles.salesUnit}>UF</Text></Text>
            <Text style={styles.updated}>{data ? `Última foto publicada · ${data.periodLabel}` : 'Esperando datos publicados'}</Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard detail={ownMetric?.delinquencyRate !== undefined && isSeller ? `${ownMetric.delinquencyRate}%` : 'clientes'} icon="alert-circle-outline" label="MORA / SAUCE" tone="red" value={`${totalMora}`} />
            <MetricCard detail="negocios" icon="briefcase-outline" label="PRODUCTIVIDAD" value={`${totalBusinesses}`} />
            <MetricCard detail={isSeller ? 'posición' : 'vendedores'} icon="trophy-outline" label={isSeller ? 'RANKING' : 'EQUIPO'} tone="gold" value={isSeller ? (ownMetric?.rankingPosition ? `#${ownMetric.rankingPosition}` : '—') : `${sellers.length}`} />
            <MetricCard detail="registros" icon="cloud-upload-outline" label="SALESFORCE" value={`${totalSalesforce}`} />
          </View>

          {isSeller ? (
            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>CATEGORÍA</Text>
                <Text style={styles.detailValue}>{ownMetric?.category ?? 'Sin foto publicada'}</Text>
                <Text style={styles.detailHint}>{ownMetric?.estimatedPrizeClp ? `$${ownMetric.estimatedPrizeClp.toLocaleString('es-CL')} estimado` : 'Según avance agregado'}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>SENIOR</Text>
                <Text style={styles.detailValue}>{ownMetric?.seniorLevel ?? 'Sin foto publicada'}</Text>
                <Text style={styles.detailHint}>{ownMetric?.eligibleTotalUf !== undefined ? `${formatUF(ownMetric.eligibleTotalUf)} UF válidas` : 'Según última carga'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>{user?.role === 'sales_manager' ? 'Vendedores de la jefatura' : 'Detalle de vendedores'}</Text>
                <Text style={styles.sectionCount}>{sellerRows.length} visibles</Text>
              </View>
              <View style={styles.workerList}>
                {sellerRows.length ? sellerRows.slice(0, 20).map((seller, index) => {
                  const metric = data?.latestByUser[seller.id];
                  return (
                    <View key={seller.id} style={[styles.workerRow, index < Math.min(sellerRows.length, 20) - 1 && styles.workerBorder]}>
                      <View style={styles.position}><Text style={styles.positionText}>{index + 1}</Text></View>
                      <View style={styles.workerMain}>
                        <Text numberOfLines={1} style={styles.workerName}>{seller.name}</Text>
                        <Text style={styles.workerMeta}>{metric?.category ?? 'Sin categoría'} · Mora {metric?.delinquentClientsCount ?? 0}</Text>
                      </View>
                      <Text style={styles.workerUf}>{formatUF(metricUf(metric))} UF</Text>
                    </View>
                  );
                }) : <Text style={styles.empty}>Aún no hay vendedores asignados o fotos publicadas.</Text>}
              </View>
            </View>
          )}

          <View style={styles.privacyNote}>
            <Ionicons color={colors.secondary} name="shield-checkmark-outline" size={21} />
            <Text style={styles.privacyText}>Este tablero muestra totales de trabajadores. No almacena información individual de clientes.</Text>
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
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  screenTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 27, fontWeight: '600' },
  period: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: 3 },
  adminShortcut: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 44, justifyContent: 'center', width: 44 },
  loader: { paddingVertical: spacing.xxl },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.md },
  salesCard: { ...shadows.floating, backgroundColor: colors.primary, borderRadius: radii.xl, minHeight: 158, overflow: 'hidden', padding: spacing.xl },
  leaf: { bottom: -34, position: 'absolute', right: -13 },
  salesLabel: { color: 'rgba(255,255,255,0.67)', fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  salesValue: { color: colors.surface, fontFamily: typography.serif, fontSize: 40, fontWeight: '600', marginTop: spacing.md },
  salesUnit: { color: colors.goldOnDark, fontFamily: typography.sans, fontSize: 15, fontWeight: '800' },
  updated: { color: 'rgba(255,255,255,0.57)', fontFamily: typography.sans, fontSize: 9, marginTop: spacing.sm },
  metricsRow: { flexDirection: 'row', gap: 7 },
  detailGrid: { flexDirection: 'row', gap: spacing.md },
  detailCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, minHeight: 116, padding: spacing.lg },
  detailLabel: { color: colors.goldText, fontFamily: typography.sans, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  detailValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 19, fontWeight: '600', marginTop: spacing.sm },
  detailHint: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: spacing.sm },
  section: { gap: spacing.md },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 21, fontWeight: '600' },
  sectionCount: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  workerList: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', paddingHorizontal: spacing.md },
  workerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 70, paddingVertical: spacing.md },
  workerBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  position: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 32, justifyContent: 'center', width: 32 },
  positionText: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '900' },
  workerMain: { flex: 1 },
  workerName: { color: colors.text, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  workerMeta: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9, marginTop: 4 },
  workerUf: { color: colors.primary, fontFamily: typography.sans, fontSize: 11, fontWeight: '900' },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, lineHeight: 18, padding: spacing.xl, textAlign: 'center' },
  privacyNote: { alignItems: 'flex-start', backgroundColor: colors.softGreen, borderRadius: radii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  privacyText: { color: colors.textMuted, flex: 1, fontFamily: typography.sans, fontSize: 10, lineHeight: 16 },
});
