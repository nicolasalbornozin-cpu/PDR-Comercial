import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { GoalCard } from '@/components/GoalCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SellerBottomNav } from '@/components/seller/SellerBottomNav';
import { images } from '@/data/assets';
import { goals } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { DashboardData } from '@/types';
import { formatUF, getProgress } from '@/utils/format';

export default function GoalsScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [senior, category, productivity, delinquency] = goals;

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getDashboard(user).then((result) => { if (active) setData(result); }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  const metric = user && data ? data.latestByUser[user.id] : undefined;
  const firstName = user?.name.split(/\s+/)[0] || 'Vendedor';
  const seniorCurrent = metric?.eligibleTotalUf ?? metric?.quarterTotalUf ?? metric?.productionUf ?? senior.currentValue;
  const seniorTarget = Math.max(senior.targetValue, seniorCurrent);
  const productivityCurrent = metric?.businessCount ?? productivity.currentValue;
  const delinquencyCurrent = metric?.delinquencyRate ?? delinquency.currentValue;
  const categoryValue = metric?.category ?? category.name;
  const completedCount = [seniorCurrent >= seniorTarget, productivityCurrent >= productivity.targetValue, delinquencyCurrent <= delinquency.targetValue].filter(Boolean).length;
  return (
    <View style={styles.screen}>
      <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
        <View style={styles.mobileFrame}>
          <ImageBackground source={images.park} style={styles.hero}>
            <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.69)', 'rgba(248,247,243,0.08)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroInner}>
              <AppHeader />
              <View style={styles.heroTitleBlock}>
                <View style={styles.titleIcon}><Ionicons color={colors.primary} name="leaf-outline" size={25} /></View>
                <View><Text style={styles.title}>Mis metas</Text><Text style={styles.subtitle}>Tu progreso actualizado al día de hoy</Text></View>
              </View>
            </View>
          </ImageBackground>

          <View style={styles.content}>
            <View style={styles.summary}>
              <View style={styles.summaryItem}>
                <View style={[styles.summaryIcon, styles.summaryIconGold]}><Ionicons color={colors.gold} name="trophy-outline" size={22} /></View>
                <View>
                  <Text style={styles.summaryValue}>{completedCount}</Text>
                  <Text style={styles.summaryLabel}>metas cumplidas</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryItem}>
                <View style={styles.summaryIcon}><Ionicons color={colors.secondary} name="trending-up-outline" size={22} /></View>
                <View>
                  <Text style={[styles.summaryValue, styles.summaryValueGold]}>{Math.max(4 - completedCount, 0)}</Text>
                  <Text style={styles.summaryLabel}>en progreso</Text>
                </View>
              </View>
            </View>

            <GoalCard badge={metric?.seniorLevel ?? 'Carrera comercial'} icon="diamond-outline" insight={seniorTarget > seniorCurrent ? `Te faltan ${formatUF(seniorTarget - seniorCurrent)} UF` : 'Meta alcanzada'} progress={getProgress(seniorCurrent, seniorTarget)} title={metric?.seniorLevel ?? senior.name} value={`${formatUF(seniorCurrent)} / ${formatUF(seniorTarget)} UF`} />
            <GoalCard badge="Categoría vigente" icon="star-outline" insight="Según la última foto publicada" progress={metric?.category ? 1 : 0} title="Categoría" value={categoryValue} />
            <GoalCard badge="Negocios realizados" icon="briefcase-outline" insight={productivity.targetValue > productivityCurrent ? `Te faltan ${productivity.targetValue - productivityCurrent} negocios` : 'Meta alcanzada'} progress={getProgress(productivityCurrent, productivity.targetValue)} title={productivity.name} value={`${productivityCurrent} de ${productivity.targetValue} negocios`} />

            <View style={styles.moraCard}>
              <View style={styles.moraTop}>
                <View style={styles.moraTitleRow}>
                  <View style={styles.moraIcon}><Ionicons color={colors.gold} name="time-outline" size={24} /></View>
                  <View>
                    <Text style={styles.moraTitle}>{delinquency.name}</Text>
                    <Text style={styles.moraSub}>Calidad de cartera</Text>
                  </View>
                </View>
                <Text style={styles.moraValue}>{delinquencyCurrent}%</Text>
              </View>
              <View style={styles.meterWrap}>
                <View style={styles.meter}>
                  <View style={[styles.meterSegment, styles.meterGreen]} />
                  <View style={[styles.meterSegment, styles.meterYellow]} />
                  <View style={[styles.meterSegment, styles.meterRed]} />
                </View>
                <View style={styles.marker}><Ionicons color={colors.primary} name="caret-down" size={17} /></View>
              </View>
              <View style={styles.objectiveRow}>
                <Ionicons color={delinquencyCurrent <= delinquency.targetValue ? colors.secondary : colors.warning} name="checkmark-circle" size={18} />
                <Text style={styles.objectiveText}>{delinquencyCurrent <= delinquency.targetValue ? 'Dentro de objetivo' : 'Requiere atención'}</Text>
              </View>
            </View>

            <View style={styles.motivation}>
              <View style={styles.leaf}><Ionicons color="rgba(39,114,80,0.13)" name="leaf-outline" size={92} /></View>
              <View style={styles.motivationIcon}><Ionicons color={colors.gold} name="leaf-outline" size={24} /></View>
              <View><Text style={styles.motivationTitle}>¡Vas por un gran camino, {firstName}!</Text><Text style={styles.motivationText}>Sigue así, cada meta te acerca al éxito.</Text></View>
            </View>
          </View>
        </View>
      </ScreenContainer>
      <SellerBottomNav />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 112 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 270 },
  heroInner: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  heroTitleBlock: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 37 },
  titleIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: radii.pill, height: 51, justifyContent: 'center', width: 51 },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 4 },
  content: { gap: spacing.lg, marginTop: -43, paddingHorizontal: spacing.xl },
  summary: { ...shadows.floating, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, flexDirection: 'row', justifyContent: 'space-around', minHeight: 92, paddingHorizontal: spacing.lg },
  summaryItem: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  summaryIconGold: { backgroundColor: colors.goldSoft },
  summaryValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 23, fontWeight: '700' },
  summaryValueGold: { color: colors.goldText },
  summaryLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10 },
  divider: { backgroundColor: colors.border, height: 42, width: 1 },
  moraCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, gap: spacing.lg, padding: spacing.xl },
  moraTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  moraTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  moraIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 55, justifyContent: 'center', width: 55 },
  moraTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 19, fontWeight: '600' },
  moraSub: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, marginTop: 2 },
  moraValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 25, fontWeight: '900' },
  meterWrap: { paddingTop: 8, position: 'relative' },
  meter: { borderRadius: radii.pill, flexDirection: 'row', height: 10, overflow: 'hidden' },
  meterSegment: { height: '100%' },
  meterGreen: { backgroundColor: colors.secondary, flex: 0.46 },
  meterYellow: { backgroundColor: '#DFB84B', flex: 0.28 },
  meterRed: { backgroundColor: colors.danger, flex: 0.26 },
  marker: { alignItems: 'center', bottom: 6, left: '29%', position: 'absolute' },
  objectiveRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  objectiveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  motivation: { alignItems: 'center', backgroundColor: colors.softGreen, borderColor: '#DDE8DE', borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, overflow: 'hidden', padding: spacing.lg },
  motivationIcon: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.pill, height: 48, justifyContent: 'center', width: 48 },
  leaf: { bottom: -30, position: 'absolute', right: -10, transform: [{ rotate: '-20deg' }] },
  motivationTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 20, fontWeight: '600' },
  motivationText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12 },
});
