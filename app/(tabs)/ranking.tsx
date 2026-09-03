import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { RankingRow } from '@/components/RankingRow';
import { RankingTabs } from '@/components/RankingTabs';
import { ScreenContainer } from '@/components/ScreenContainer';
import { sellerRanking } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { RankingEntry, RankingPeriod } from '@/types';
import { formatUF } from '@/utils/format';

function rankingCopy(role?: string) {
  if (role === 'coordinator') return { title: 'Ranking de equipos', subtitle: 'Tu equipo frente a los demás equipos', position: 'POSICIÓN DE TU EQUIPO' };
  if (role === 'sales_manager') return { title: 'Mis coordinaciones', subtitle: 'Comparación de los equipos de tu jefatura', position: 'MEJOR COORDINACIÓN' };
  return { title: 'Ranking general', subtitle: 'Tu avance frente al resto de vendedores', position: 'TU POSICIÓN' };
}

export default function RankingScreen() {
  const [period, setPeriod] = useState<RankingPeriod>('annual');
  const [entries, setEntries] = useState<RankingEntry[]>(sellerRanking);
  const [error, setError] = useState('');
  const { isPreviewing, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getRanking(user, period, { preview: isPreviewing })
      .then((result) => { if (active) { setEntries(result); setError(''); } })
      .catch(() => { if (active) setError('Error al comunicar con el servidor'); });
    return () => { active = false; };
  }, [isPreviewing, period, user]);

  const copy = rankingCopy(user?.role);
  const totalUf = useMemo(() => entries.reduce((total, entry) => total + entry.value, 0), [entries]);
  const currentEntry = entries.find((entry) => entry.isCurrentUser) ?? entries[0];
  const nextEntry = currentEntry ? entries.find((entry) => entry.position === currentEntry.position - 1) : undefined;
  const gap = currentEntry && nextEntry ? Math.max(nextEntry.value - currentEntry.value, 0) : 0;

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <AppHeader />
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.globalCard}>
            <Ionicons color="rgba(255,255,255,0.08)" name="trophy-outline" size={118} style={styles.pattern} />
            <View style={styles.globalItem}>
              <Ionicons color={colors.gold} name="people-outline" size={20} />
              <Text style={styles.globalValue}>{entries.length}</Text>
              <Text style={styles.globalLabel}>{user?.role === 'seller' ? 'Vendedores' : user?.role === 'coordinator' ? 'Equipos' : 'Coordinaciones'}</Text>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItemWide}>
              <Ionicons color={colors.gold} name="checkmark-circle-outline" size={20} />
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.globalValue}>{formatUF(totalUf)}</Text>
              <Text style={styles.globalLabel}>UF emitidas</Text>
            </View>
          </View>

          <RankingTabs onChange={setPeriod} value={period} />
          <Text style={styles.period}>{period === 'annual' ? 'Acumulado del año calendario' : 'Mes comercial vigente'} · solo ventas emitidas</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          {currentEntry ? (
            <View style={styles.positionCard}>
              <View style={styles.positionContent}>
                <Text style={styles.positionLabel}>{copy.position}</Text>
                <View style={styles.positionMain}>
                  <Text style={styles.positionNumber}>#{currentEntry.position}</Text>
                  <View style={styles.positionLine} />
                  <Text style={styles.positionUF}>{formatUF(currentEntry.value)} <Text style={styles.positionUnit}>UF</Text></Text>
                </View>
                <View style={styles.insightRow}>
                  <Ionicons color={colors.gold} name="arrow-up-circle-outline" size={18} />
                  <Text style={styles.insight}>{gap > 0 ? `Faltan ${formatUF(gap)} UF emitidas para subir un puesto` : 'Liderando este ranking'}</Text>
                </View>
              </View>
              <Ionicons color="rgba(255,255,255,0.08)" name="trophy-outline" size={104} style={styles.trophy} />
            </View>
          ) : null}

          <View style={styles.rankingSection}>
            <View style={styles.rankingHeading}>
              <Text style={styles.rankingTitle}>{period === 'annual' ? 'Ranking anual' : 'Ranking mensual'}</Text>
              <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>EMITIDAS</Text></View>
            </View>
            <View style={styles.list}>
              {entries.map((entry) => <RankingRow entry={entry} key={entry.userId} />)}
              {!entries.length ? <Text style={styles.empty}>Aún no hay ventas emitidas para este período.</Text> : null}
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 30 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 34, fontWeight: '600', marginTop: spacing.xxl },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 3 },
  content: { gap: spacing.lg, marginTop: spacing.xl, paddingHorizontal: spacing.xl },
  globalCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.xl, flexDirection: 'row', minHeight: 128, overflow: 'hidden', paddingHorizontal: spacing.xl },
  pattern: { bottom: -24, position: 'absolute', right: -12 },
  globalItem: { alignItems: 'center', flex: 1, gap: 5 },
  globalItemWide: { alignItems: 'center', flex: 1.5, gap: 5 },
  globalValue: { color: colors.surface, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  globalLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: typography.sans, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  globalDivider: { backgroundColor: 'rgba(255,255,255,0.17)', height: 58, width: 1 },
  period: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, textAlign: 'center' },
  error: { backgroundColor: '#FBECE9', borderRadius: radii.md, color: colors.danger, fontFamily: typography.sans, fontSize: 11, padding: spacing.md },
  positionCard: { ...shadows.floating, backgroundColor: colors.primary, borderRadius: radii.xl, minHeight: 154, overflow: 'hidden', padding: spacing.xl },
  positionContent: { zIndex: 1 },
  positionLabel: { color: 'rgba(255,255,255,0.64)', fontFamily: typography.sans, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  positionMain: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 8 },
  positionNumber: { color: colors.surface, fontFamily: typography.serif, fontSize: 42, fontWeight: '600' },
  positionLine: { backgroundColor: colors.gold, height: 35, width: 1 },
  positionUF: { color: colors.surface, fontFamily: typography.sans, fontSize: 19, fontWeight: '800' },
  positionUnit: { color: colors.goldOnDark, fontSize: 12 },
  insightRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 11 },
  insight: { color: 'rgba(255,255,255,0.78)', flex: 1, fontFamily: typography.sans, fontSize: 11, fontWeight: '600' },
  trophy: { bottom: -13, position: 'absolute', right: -6 },
  rankingSection: { gap: spacing.md },
  rankingHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rankingTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  list: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', padding: spacing.sm },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, padding: spacing.xl, textAlign: 'center' },
});
