import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { DetailHeader } from '@/components/DetailHeader';
import { GoalCard } from '@/components/GoalCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { images } from '@/data/assets';
import { goals } from '@/data/mockData';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { formatUF, getProgress } from '@/utils/format';

export default function GoalsScreen() {
  const [senior, category, productivity, delinquency] = goals;
  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(9,61,42,0.62)', 'rgba(9,61,42,0.12)', colors.background]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroInner}>
            <DetailHeader light title="Mis metas" />
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

          <GoalCard badge="Carrera comercial" icon="diamond-outline" insight={`Te faltan ${senior.targetValue - senior.currentValue} UF`} progress={getProgress(senior.currentValue, senior.targetValue)} title={senior.name} value={`${formatUF(senior.currentValue)} / ${formatUF(senior.targetValue)} UF`} />
          <GoalCard badge="Nivel Diamante" icon="ribbon-outline" insight="Faltan 80 UF para Diamante" progress={0.91} title={category.name} value="91%" />
          <GoalCard badge="Negocios realizados" icon="briefcase-outline" insight={`Te faltan ${productivity.targetValue - productivity.currentValue} negocios`} progress={getProgress(productivity.currentValue, productivity.targetValue)} title={productivity.name} value={`${productivity.currentValue} de ${productivity.targetValue} negocios`} />

          <View style={styles.moraCard}>
            <View style={styles.moraTop}>
              <View style={styles.moraTitleRow}>
                <View style={styles.moraIcon}><Ionicons color={colors.secondary} name="shield-checkmark-outline" size={22} /></View>
                <View>
                  <Text style={styles.moraTitle}>{delinquency.name}</Text>
                  <Text style={styles.moraSub}>Calidad de cartera</Text>
                </View>
              </View>
              <Text style={styles.moraValue}>{delinquency.currentValue}%</Text>
            </View>
            <View style={styles.meterWrap}>
              <View style={styles.meter}>
                <View style={[styles.meterSegment, styles.meterGreen]} />
                <View style={[styles.meterSegment, styles.meterYellow]} />
                <View style={[styles.meterSegment, styles.meterRed]} />
              </View>
              <View style={styles.marker}>
                <View style={styles.markerDot} />
              </View>
            </View>
            <View style={styles.objectiveRow}>
              <Ionicons color={colors.secondary} name="checkmark-circle" size={18} />
              <Text style={styles.objectiveText}>Dentro de objetivo</Text>
            </View>
          </View>

          <View style={styles.motivation}>
            <View style={styles.leaf}><Ionicons color="rgba(39,114,80,0.13)" name="leaf-outline" size={92} /></View>
            <Ionicons color={colors.gold} name="sparkles-outline" size={24} />
            <Text style={styles.motivationTitle}>¡Vas por un gran camino, Erika!</Text>
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
  marker: { alignItems: 'center', bottom: -6, left: '29%', position: 'absolute' },
  markerDot: { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 7, borderWidth: 3, height: 14, width: 14 },
  objectiveRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  objectiveText: { color: colors.secondary, fontFamily: typography.sans, fontSize: 12, fontWeight: '800' },
  motivation: { backgroundColor: colors.softGreen, borderRadius: radii.xl, gap: 7, overflow: 'hidden', padding: spacing.xl },
  leaf: { bottom: -30, position: 'absolute', right: -10, transform: [{ rotate: '-20deg' }] },
  motivationTitle: { color: colors.primary, fontFamily: typography.serif, fontSize: 20, fontWeight: '600' },
  motivationText: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 12 },
});
