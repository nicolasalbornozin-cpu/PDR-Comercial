import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { RankingRow } from '@/components/RankingRow';
import {PlatformLabelEditor} from '@/components/PlatformLabelEditor';
import {useCommercialRefresh} from '@/hooks/useCommercialRefresh';
import { RankingTabs } from '@/components/RankingTabs';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { RankingEntry, RankingPeriod } from '@/types';
import { formatUF } from '@/utils/format';

function rankingCopy(role: string | undefined, mode: 'executives'|'teams') {
  if (mode === 'teams') return {title:'Ranking de equipos',subtitle:role==='sales_manager'?'Comparación de los equipos de tu jefatura':'Comparación de los equipos comerciales',position:role==='seller'||role==='coordinator'?'POSICIÓN DE TU EQUIPO':'MEJOR EQUIPO'};
  return {title:'Ranking por ejecutivo',subtitle:role==='coordinator'?'Ejecutivos de tu equipo':role==='sales_manager'?'Ejecutivos de tu jefatura':'Comparación de los ejecutivos comerciales',position:role==='seller'?'TU POSICIÓN':'MEJOR EJECUTIVO'};
}

export default function RankingScreen() {
  const [period, setPeriod] = useState<RankingPeriod>('annual');
  const [mode,setMode] = useState<'executives'|'teams'>('executives');
  const [loaded, setLoaded] = useState<{userId:string;period:RankingPeriod;mode:typeof mode;entries:RankingEntry[]}|null>(null);
  const [periodLabel, setPeriodLabel] = useState('Mes comercial vigente');
  const [executiveCount,setExecutiveCount]=useState<number>();
  const revision=useCommercialRefresh();
  const [error, setError] = useState('');
  const [showEmission, setShowEmission] = useState(false);
  const { isPreviewing, user } = useAuth();
  const entries = useMemo(() => loaded?.userId === user?.id && loaded?.period === period && loaded?.mode === mode ? loaded.entries : [], [loaded, period, mode, user?.id]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      snapshotService.getRanking(user, period, { preview: isPreviewing,rankingMode:mode }),
      snapshotService.getDashboard(user, { preview: isPreviewing }),
      snapshotService.getRankingPeriod(user,period,{preview:isPreviewing}),
    ])
      .then(([result, dashboard, label]) => { if (active) { setLoaded({userId:user.id,period,mode,entries:result}); setPeriodLabel(period==='annual'?label:dashboard.periodLabel);setExecutiveCount(dashboard.rankingExecutiveCount); setError(''); } })
      .catch(() => { if (active) setError('Error al comunicar con el servidor'); });
    return () => { active = false; };
  }, [isPreviewing, period, mode, user,revision]);

  const copy = rankingCopy(user?.role,mode);
  const totalUf = useMemo(() => entries.reduce((total, entry) => total + entry.value, 0), [entries]);
  const currentEntry = entries.find((entry) => entry.isCurrentUser) ?? (user?.role !== 'seller' && user?.role !== 'coordinator' || mode==='executives'&&user?.role==='coordinator' ? entries[0] : undefined);
  const nextEntry = currentEntry ? entries.find((entry) => entry.position === currentEntry.position - 1) : undefined;
  const gap = currentEntry && nextEntry ? Math.max(nextEntry.value - currentEntry.value, 0) : 0;

  return (
    <ScreenContainer scroll={false} edges={['top', 'left', 'right']}>
      <FlatList data={entries} keyExtractor={entry=>entry.userId} extraData={showEmission}
        initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} contentContainerStyle={styles.page}
        ListHeaderComponent={<View style={styles.mobileFrame}>
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
              <Text style={styles.globalValue}>{mode==='teams'?entries.length:entries.length||(executiveCount??'—')}</Text>
              <Text style={styles.globalLabel}>{mode==='teams'?'Equipos en ranking':'Ejecutivos en ranking'}</Text>
            </View>
            <View style={styles.globalDivider} />
            <View style={styles.globalItemWide}>
              <Ionicons color={colors.gold} name="checkmark-circle-outline" size={20} />
              <Text adjustsFontSizeToFit numberOfLines={1} style={styles.globalValue}>{formatUF(totalUf)}</Text>
              <Text style={styles.globalLabel}>UF totales</Text>
            </View>
          </View>

          <RankingTabs onChange={setPeriod} value={period} />
          <View accessibilityRole="tablist" style={styles.modeTabs}>{([{id:'executives',label:'Por ejecutivo'},{id:'teams',label:'Por equipo'}] as const).map(tab=><Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{selected:mode===tab.id}} onPress={()=>setMode(tab.id)} style={[styles.modeTab,mode===tab.id&&styles.modeSelected]}><Text style={[styles.modeText,mode===tab.id&&styles.modeTextSelected]}>{tab.label}</Text></Pressable>)}</View>
          <Text style={styles.period}>{periodLabel} · ventas totales</Text>
          <Text style={styles.period}>Los totales de equipos incluyen las ventas de CURSO, sin habilitar acceso. El ranking conserva las anulaciones del Excel; Inicio usa la tabla de totales anuales.</Text>
          <Pressable accessibilityRole="button" accessibilityState={{expanded:showEmission}} onPress={()=>setShowEmission(current=>!current)} style={styles.emissionToggle}><Ionicons name="swap-horizontal" size={19} color={colors.primary}/><Text style={styles.emissionText}>{showEmission?'Ocultar':'Ver'} emitidas vs. sin emitir</Text></Pressable>
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
                  <Text style={styles.insight}>{gap > 0 ? `Faltan ${formatUF(gap)} UF para subir un puesto` : 'Liderando este ranking'}</Text>
                </View>
              </View>
              <Ionicons color="rgba(255,255,255,0.08)" name="trophy-outline" size={104} style={styles.trophy} />
            </View>
          ) : null}

          <View style={styles.rankingSection}>
            <View style={styles.rankingHeading}>
              <Text style={styles.rankingTitle}>{`${period==='annual'?'Ranking anual':'Ranking mensual'} · ${periodLabel}`}</Text>
              {period==='monthly'?<PlatformLabelEditor id="monthly_ranking" label={periodLabel} onSaved={setPeriodLabel}/>:null}
              <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>TOTALES</Text></View>
            </View>
          </View>
        </View>
      </View>}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay un ranking total publicado para este período.</Text>}
        renderItem={({item:entry})=><View style={styles.rankingRow}><RankingRow entry={entry}/>{showEmission?<View style={styles.comparison}><Text style={styles.emissionText}>Emitidas: {entry.emittedValue===undefined?'Sin dato':`${formatUF(entry.emittedValue)} UF`}</Text><Text style={styles.emissionText}>Sin emitir: {entry.notEmittedValue===undefined?'Sin dato':`${formatUF(entry.notEmittedValue)} UF`}</Text></View>:null}</View>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'stretch', paddingBottom: 30 },
  rankingRow:{maxWidth:620,width:'100%',alignSelf:'center',paddingHorizontal:spacing.xl,backgroundColor:colors.surface},
  mobileFrame: { maxWidth: 620, width: '100%',alignSelf:'center' },
  modeTabs:{flexDirection:'row',gap:8},
  modeTab:{flex:1,alignItems:'center',paddingVertical:13,borderRadius:radii.pill,backgroundColor:colors.softGreen},
  modeSelected:{backgroundColor:colors.primary},
  modeText:{color:colors.primary,fontFamily:typography.sans,fontWeight:'700',fontSize:13},
  modeTextSelected:{color:colors.surface},
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
  emissionToggle:{alignSelf:'center',flexDirection:'row',alignItems:'center',gap:8,padding:12,borderRadius:radii.pill,backgroundColor:colors.softGreen},
  emissionText:{fontFamily:typography.sans,fontSize:11,color:colors.primary,fontWeight:'700'},
  comparison:{padding:spacing.md,gap:spacing.sm,flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',backgroundColor:colors.paleGreen},
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
  rankingTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 22, fontWeight: '600',flex:1 },
  liveBadge: { alignItems: 'center', backgroundColor: colors.softGreen, borderRadius: radii.pill, flexDirection: 'row', gap: 5, paddingHorizontal: 9, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.secondary, borderRadius: 4, height: 7, width: 7 },
  liveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  list: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', padding: spacing.sm },
  empty: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12, padding: spacing.xl, textAlign: 'center' },
});
