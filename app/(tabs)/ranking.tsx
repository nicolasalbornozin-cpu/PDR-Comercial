import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { FilterChip } from '@/components/FilterChip';
import { RankingRow } from '@/components/RankingRow';
import { RankingTabs } from '@/components/RankingTabs';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { competitions, managementRanking, sellerRanking, teamRanking } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { RankingMode } from '@/types';
import { formatDate, formatUF } from '@/utils/format';

export default function RankingScreen() {
  const [mode, setMode] = useState<RankingMode>('sellers');
  const [competitionId, setCompetitionId] = useState(competitions[0].id);
  const [publishedSellerRanking, setPublishedSellerRanking] = useState(sellerRanking);
  const { isPreviewing, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let active = true;
    snapshotService.getSellerRanking(user, { preview: isPreviewing })
      .then((entries) => { if (active && entries.length) setPublishedSellerRanking(entries); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isPreviewing, user]);

  const entries = useMemo(() => {
    if (mode === 'teams') return teamRanking;
    if (mode === 'management') return managementRanking;
    return publishedSellerRanking;
  }, [mode, publishedSellerRanking]);

  const selectedCompetition = competitions.find((competition) => competition.id === competitionId) ?? competitions[0];
  const currentEntry = entries.find((entry) => entry.isCurrentUser) ?? entries[0];
  const nextEntry = entries.find((entry) => entry.position === currentEntry.position - 1);
  const gap = mode === 'sellers' ? 52 : nextEntry ? Math.max(nextEntry.value - currentEntry.value, 0) : 0;
  const teamCount = new Set(publishedSellerRanking.map((entry) => entry.teamId).filter(Boolean)).size;
  const totalUf = publishedSellerRanking.reduce((total, entry) => total + entry.value, 0);

  function handleModeChange(nextMode: RankingMode) {
    setMode(nextMode);
  }

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.72)', 'rgba(248,247,243,0.08)']} locations={[0, 0.47, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.header}>
            <AppHeader />
            <Text style={styles.title}>Global</Text>
            <Text style={styles.subtitle}>Compara tu avance con todos</Text>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <View style={styles.globalCard}>
            <View style={styles.globalItem}>
              <View style={styles.globalIcon}><Ionicons color={colors.primary} name="people-outline" size={23} /></View>
              <View><Text style={styles.globalLabel}>Vendedores</Text><Text style={styles.globalValue}>{publishedSellerRanking.length}</Text></View>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItem}>
              <View style={styles.globalIcon}><Ionicons color={colors.primary} name="git-network-outline" size={23} /></View>
              <View><Text style={styles.globalLabel}>Equipos</Text><Text style={styles.globalValue}>{teamCount || teamRanking.length}</Text></View>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItemWide}>
              <View style={styles.globalIcon}><Ionicons color={colors.primary} name="trending-up-outline" size={23} /></View>
              <View style={styles.globalCopy}><Text numberOfLines={1} style={styles.globalLabel}>UF acumuladas</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.globalValue}>{formatUF(totalUf)}</Text></View>
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
            <View style={styles.positionBadge}><Ionicons color={colors.goldOnDark} name="diamond-outline" size={32} /></View>
            <View style={styles.positionRank}>
              <Text style={styles.positionLabel}>{mode === 'sellers' ? 'Tu posición' : mode === 'teams' ? 'Tu equipo' : 'Tu jefatura'}</Text>
              <Text style={styles.positionNumber}>#{currentEntry.position}</Text>
            </View>
            <View style={styles.positionLine} />
            <View style={styles.positionContent}>
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.positionUF}>{formatUF(currentEntry.value)} <Text style={styles.positionUnit}>UF</Text></Text>
              <Text numberOfLines={2} style={styles.insight}>{gap > 0 ? `Te faltan ${formatUF(gap)} UF para subir 1 puesto` : 'Estás liderando este ranking'}</Text>
            </View>
            <Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={108} style={styles.trophy} />
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
  page: { alignItems: 'center', backgroundColor: colors.background, paddingBottom: 30 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 292, overflow: 'hidden' },
  header: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  title: { color: colors.primary, fontFamily: typography.serif, fontSize: 36, fontWeight: '600', marginTop: 30 },
  subtitle: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, marginTop: 3 },
  content: { gap: spacing.lg, marginTop: -48, paddingHorizontal: spacing.xl },
  globalCard: { ...shadows.floating, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radii.xl, flexDirection: 'row', minHeight: 116, paddingHorizontal: spacing.md },
  globalItem: { alignItems: 'center', flex: 0.95, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  globalItemWide: { alignItems: 'center', flex: 1.3, flexDirection: 'row', gap: 8, justifyContent: 'center' },
  globalCopy: { flexShrink: 1, minWidth: 0 },
  globalIcon: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, height: 43, justifyContent: 'center', width: 43 },
  globalValue: { color: colors.primary, fontFamily: typography.sans, fontSize: 21, fontWeight: '700', marginTop: 2 },
  globalLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 8.5 },
  globalDivider: { backgroundColor: colors.border, height: 54, width: 1 },
  filters: { gap: spacing.sm, paddingRight: spacing.xl },
  period: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 10, marginTop: spacing.sm },
  positionCard: { ...shadows.floating, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radii.lg, flexDirection: 'row', minHeight: 124, overflow: 'hidden', padding: spacing.lg },
  positionBadge: { alignItems: 'center', borderColor: 'rgba(224,197,111,0.62)', borderRadius: radii.pill, borderWidth: 1, height: 59, justifyContent: 'center', width: 59, zIndex: 1 },
  positionRank: { marginLeft: spacing.md, zIndex: 1 },
  positionContent: { flex: 1, minWidth: 0, zIndex: 1 },
  positionLabel: { color: 'rgba(255,255,255,0.74)', fontFamily: typography.sans, fontSize: 10 },
  positionNumber: { color: colors.surface, fontFamily: typography.sans, fontSize: 31, fontWeight: '700', marginTop: 2 },
  positionLine: { backgroundColor: 'rgba(255,255,255,0.55)', height: 66, marginHorizontal: spacing.lg, width: 1 },
  positionUF: { color: colors.surface, fontFamily: typography.sans, fontSize: 25, fontWeight: '400' },
  positionUnit: { fontSize: 15 },
  insight: { color: 'rgba(255,255,255,0.8)', fontFamily: typography.sans, fontSize: 9.5, lineHeight: 14, marginTop: 6 },
  trophy: { bottom: -13, position: 'absolute', right: -6 },
  rankingSection: { gap: spacing.md },
  rankingHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  rankingTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600' },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  list: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', padding: spacing.sm },
});
