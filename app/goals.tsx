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
import { DashboardData } from '@/types';
import { formatUF, getProgress } from '@/utils/format';
import { seniorEligibleUf } from '@/utils/commercialRules';

export default function GoalsScreen() {
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { isPreviewing, user } = useAuth();
  const [loaded, setLoaded] = useState<{userId:string;data:DashboardData}|null>(null);
  const [categoryOpen, setCategoryOpen] = useState(focus === 'category');
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
  const seniorValue = seniorEligibleUf(metric, data?.seniorOpen ?? true);
  const categoryValue = Number(metric?.categoryUf ?? 0);
  const categoryTarget = metric?.categoryTargetUf ?? 0;
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
          <GoalCard badge={`Senior ${data?.seniorOpen ? 'abierto' : 'cerrado'} · ${metric?.smadCount ?? '—'} SMAD`} icon="diamond-outline" insight={metric?.seniorRemaining ? `${metric.seniorRemaining} · Revisa también SMAD y multiproductos` : 'Sin carga Senior publicada'} progress={getProgress(seniorValue,metric?.seniorTargetUf??0)} title={metric?.seniorLevel ?? 'Senior'} value={metric?.eligibleTotalUf !== undefined ? `${formatUF(seniorValue)} UF` : 'Sin datos'} />
          <Pressable onPress={() => setCategoryOpen((open) => !open)} style={({ pressed }) => pressed && styles.pressed}>
            <GoalCard badge={metric?.categoryLabel ?? 'Catego'} icon="ribbon-outline" insight={categoryOpen ? 'Toca para ocultar el detalle' : 'Toca para ver período y emisión'} progress={getProgress(categoryValue,categoryTarget)} title={metric?.category ?? 'Categoría comercial'} tone="green" value={metric?.categoryUf !== undefined ? `${formatUF(categoryValue)} UF` : 'Sin datos'} />
          </Pressable>
          {categoryOpen ? (
            <View style={styles.categoryDetail}>
              <View style={styles.categoryDetailTitle}><Ionicons color={colors.goldText} name="calendar-outline" size={20} /><Text style={styles.categoryPeriod}>{metric?.categoryLabel ?? 'Período de Catego sin publicar'}</Text></View>
              <View style={styles.emissionRow}>
                <View style={styles.emissionItem}><Text style={styles.emissionLabel}>Emitido</Text><Text style={styles.emissionValue}>{metric?.emittedUf === undefined ? 'Sin dato' : `${formatUF(metric.emittedUf)} UF`}</Text></View>
                <View style={styles.emissionDivider} />
                <View style={styles.emissionItem}><Text style={styles.emissionLabel}>Sin emitir</Text><Text style={[styles.emissionValue, metric?.notEmittedUf ? styles.pendingValue : undefined]}>{metric?.notEmittedUf === undefined ? 'Sin dato' : `${formatUF(metric.notEmittedUf)} UF`}</Text></View>
              </View>
              {metric?.emittedUf === undefined || metric?.notEmittedUf === undefined ? <Text style={styles.emissionNote}>Este desglose aparecerá después de volver a publicar Carga Catego con CANTO y Base TRIO dentro del mismo archivo.</Text> : null}
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
  pressed: { opacity: 0.8, transform: [{ scale: 0.992 }] },
  categoryDetail: { ...shadows.card, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  categoryDetailTitle: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  categoryPeriod: { color: colors.primary, flex: 1, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
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
