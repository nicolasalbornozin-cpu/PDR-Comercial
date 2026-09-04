import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/DetailHeader';
import { GoalCard } from '@/components/GoalCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData } from '@/types';
import { formatUF, getProgress } from '@/utils/format';
import { delinquencyTone, productivityTone, seniorEligibleUf } from '@/utils/commercialRules';

export default function GoalsScreen() {
  const { isPreviewing, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user, { preview: isPreviewing }).then((result) => {
      if (active) setData(result);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isPreviewing, user]);

  const metric = user && data ? data.latestByUser[user.id] : undefined;
  const seniorValue = seniorEligibleUf(metric, data?.seniorOpen ?? true);
  const categoryValue = user && data ? Number(data.monthlyEmittedUfByUser[user.id] ?? 0) : 0;
  const productivityValue = Number(metric?.productivity ?? 0);
  const delinquencyValue = Number(metric?.delinquencyRate ?? 0);
  const moraTone = delinquencyTone(delinquencyValue);
  const moraCopy = moraTone === 'red' ? 'Sobre 30% · requiere atención' : moraTone === 'gold' ? 'Cerca del límite' : 'Dentro de objetivo';
  const markerPosition = `${Math.min(Math.max(delinquencyValue / 40, 0), 1) * 100}%` as `${number}%`;
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
                <Text style={styles.summaryValue}>3</Text>
                <Text style={styles.summaryLabel}>metas cumplidas</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <View style={[styles.summaryIcon, styles.summaryIconGold]}><Ionicons color={colors.gold} name="hourglass-outline" size={20} /></View>
              <View>
                <Text style={styles.summaryValue}>1</Text>
                <Text style={styles.summaryLabel}>en progreso</Text>
              </View>
            </View>
          </View>

          {!data ? <ActivityIndicator color={colors.gold} style={styles.loader} /> : null}
          <GoalCard badge={`Senior ${data?.seniorOpen ? 'abierto · ventas cantadas' : 'cerrado · ventas emitidas'}`} icon="diamond-outline" insight={seniorValue >= 1950 ? 'Meta cumplida' : `Te faltan ${formatUF(1950 - seniorValue)} UF`} progress={getProgress(seniorValue, 1950)} title={metric?.seniorLevel ?? 'Super Senior'} value={`${formatUF(seniorValue)} / 1.950 UF`} />
          <GoalCard badge="Solo ventas emitidas" icon="ribbon-outline" insight={categoryValue >= 1000 ? 'Meta mensual cumplida' : `Faltan ${formatUF(1000 - categoryValue)} UF emitidas para Diamante`} progress={getProgress(categoryValue, 1000)} title={metric?.category ?? 'Categoría comercial'} tone="green" value={`${Math.round(getProgress(categoryValue, 1000) * 100)}%`} />
          <GoalCard badge="Índice de productividad" icon="briefcase-outline" insight={productivityValue < 1 ? 'Bajo el mínimo de 1,00' : 'Dentro del objetivo'} progress={getProgress(productivityValue, 1)} title="Productividad" tone={productivityTone(productivityValue)} value={`${productivityValue.toFixed(2)} / 1,00`} />

          <View style={styles.moraCard}>
            <View style={styles.moraTop}>
              <View style={styles.moraTitleRow}>
                <View style={styles.moraIcon}><Ionicons color={colors.secondary} name="shield-checkmark-outline" size={22} /></View>
                <View>
                  <Text style={styles.moraTitle}>Mora objetivo</Text>
                  <Text style={styles.moraSub}>Calidad de cartera</Text>
                </View>
              </View>
              <Text style={[styles.moraValue, { color: moraTone === 'red' ? colors.danger : moraTone === 'gold' ? colors.goldText : colors.success }]}>{delinquencyValue.toFixed(1)}%</Text>
            </View>
            <View style={styles.meterWrap}>
              <View style={styles.meter}>
                <View style={[styles.meterSegment, styles.meterGreen]} />
                <View style={[styles.meterSegment, styles.meterYellow]} />
                <View style={[styles.meterSegment, styles.meterRed]} />
              </View>
              <View style={[styles.marker, { left: markerPosition }]}>
                <View style={styles.markerDot} />
              </View>
            </View>
            <View style={styles.objectiveRow}>
              <Ionicons color={moraTone === 'red' ? colors.danger : moraTone === 'gold' ? colors.warning : colors.secondary} name={moraTone === 'red' ? 'alert-circle' : 'checkmark-circle'} size={18} />
              <Text style={[styles.objectiveText, { color: moraTone === 'red' ? colors.danger : moraTone === 'gold' ? colors.goldText : colors.secondary }]}>{moraCopy}</Text>
            </View>
          </View>

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
