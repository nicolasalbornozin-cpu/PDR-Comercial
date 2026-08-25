import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { FilterChip } from '@/components/FilterChip';
import { RankingRow } from '@/components/RankingRow';
import { RankingTabs } from '@/components/RankingTabs';
import { ScreenContainer } from '@/components/ScreenContainer';
import { competitions, managementRanking, sellerRanking, teamRanking } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { RankingMode } from '@/types';
import { formatDate, formatUF } from '@/utils/format';

export default function RankingScreen() {
  const [mode, setMode] = useState<RankingMode>('sellers');
  const [competitionId, setCompetitionId] = useState(competitions[0].id);

  const entries = useMemo(() => {
    if (mode === 'teams') return teamRanking;
    if (mode === 'management') return managementRanking;
    return sellerRanking;
  }, [mode]);

  const selectedCompetition = competitions.find((competition) => competition.id === competitionId) ?? competitions[0];
  const currentEntry = entries.find((entry) => entry.isCurrentUser) ?? entries[0];
  const nextEntry = entries.find((entry) => entry.position === currentEntry.position - 1);
  const gap = mode === 'sellers' ? 52 : nextEntry ? Math.max(nextEntry.value - currentEntry.value, 0) : 0;

  function handleModeChange(nextMode: RankingMode) {
    setMode(nextMode);
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <View style={styles.header}>
          <AppHeader />
          <Text style={styles.title}>Global</Text>
          <Text style={styles.subtitle}>Compara tu avance con todos</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.globalCard}>
            <View style={styles.globalPattern}><Ionicons color="rgba(255,255,255,0.08)" name="globe-outline" size={126} /></View>
            <View style={styles.globalItem}>
              <Ionicons color={colors.gold} name="people-outline" size={20} />
              <Text style={styles.globalValue}>96</Text>
              <Text style={styles.globalLabel}>Vendedores</Text>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItem}>
              <Ionicons color={colors.gold} name="git-network-outline" size={20} />
              <Text style={styles.globalValue}>12</Text>
              <Text style={styles.globalLabel}>Equipos</Text>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItemWide}>
              <Ionicons color={colors.gold} name="trending-up-outline" size={20} />
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.globalValue}>118.430</Text>
              <Text style={styles.globalLabel}>UF acumuladas</Text>
            </View>
          </View>

          <RankingTabs onChange={handleModeChange} value={mode} />

          <View>
            <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
              {competitions.map((competition) => (
                <FilterChip active={competition.id === competitionId} key={competition.id} label={competition.name} onPress={() => setCompetitionId(competition.id)} />
              ))}
            </ScrollView>
            <Text style={styles.period}>Período: {formatDate(selectedCompetition.startDate)} — {formatDate(selectedCompetition.endDate)}</Text>
          </View>

          <View style={styles.positionCard}>
            <View style={styles.positionContent}>
              <Text style={styles.positionLabel}>{mode === 'sellers' ? 'TU POSICIÓN' : mode === 'teams' ? 'POSICIÓN DE TU EQUIPO' : 'POSICIÓN DE TU JEFATURA'}</Text>
              <View style={styles.positionMain}>
                <Text style={styles.positionNumber}>#{currentEntry.position}</Text>
                <View style={styles.positionLine} />
                <Text style={styles.positionUF}>{formatUF(currentEntry.value)} <Text style={styles.positionUnit}>UF</Text></Text>
              </View>
              <View style={styles.insightRow}>
                <Ionicons color={colors.gold} name="arrow-up-circle-outline" size={18} />
                <Text style={styles.insight}>{gap > 0 ? `Te faltan ${formatUF(gap)} UF para subir 1 puesto` : 'Estás liderando este ranking'}</Text>
              </View>
            </View>
            <Ionicons color="rgba(255,255,255,0.08)" name="trophy-outline" size={104} style={styles.trophy} />
          </View>

          <View style={styles.rankingSection}>
            <View style={styles.rankingHeading}>
              <Text style={styles.rankingTitle}>{mode === 'sellers' ? 'Ranking de vendedores' : mode === 'teams' ? 'Ranking de equipos' : 'Ranking de jefaturas'}</Text>
              <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>ACTIVO</Text></View>
            </View>
            <View style={styles.list}>
              {entries.map((entry) => <RankingRow entry={entry} key={entry.userId} />)}
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
  globalCard: { ...shadows.card, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.xl, flexDirection: 'row', minHeight: 138, overflow: 'hidden', paddingHorizontal: spacing.md },
  globalPattern: { bottom: -25, position: 'absolute', right: -15 },
  globalItem: { alignItems: 'center', flex: 0.9, gap: 5 },
  globalItemWide: { alignItems: 'center', flex: 1.25, gap: 5 },
  globalValue: { color: colors.surface, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  globalLabel: { color: 'rgba(255,255,255,0.62)', fontFamily: typography.sans, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  globalDivider: { backgroundColor: 'rgba(255,255,255,0.17)', height: 58, width: 1 },
  filters: { gap: spacing.sm, paddingRight: spacing.xl },
  period: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: spacing.sm },
  positionCard: { ...shadows.floating, backgroundColor: colors.primary, borderRadius: radii.xl, minHeight: 154, overflow: 'hidden', padding: spacing.xl },
  positionContent: { zIndex: 1 },
  positionLabel: { color: 'rgba(255,255,255,0.64)', fontFamily: typography.sans, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  positionMain: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 8 },
  positionNumber: { color: colors.surface, fontFamily: typography.serif, fontSize: 42, fontWeight: '600' },
  positionLine: { backgroundColor: colors.gold, height: 35, width: 1 },
  positionUF: { color: colors.surface, fontFamily: typography.sans, fontSize: 19, fontWeight: '800' },
  positionUnit: { color: colors.goldOnDark, fontSize: 12 },
  insightRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 11 },
  insight: { color: 'rgba(255,255,255,0.78)', fontFamily: typography.sans, fontSize: 11, fontWeight: '600' },
  trophy: { bottom: -13, position: 'absolute', right: -6 },
  rankingSection: { gap: spacing.md },
  rankingHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rankingTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  list: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', padding: spacing.sm },
});
