import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ComponentProps } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { GoalCard } from '@/components/GoalCard';
import { MetricCard } from '@/components/MetricCard';
import { ScreenContainer } from '@/components/ScreenContainer';
import { SectionHeader } from '@/components/SectionHeader';
import { images } from '@/data/assets';
import { activities, executiveMetrics, goals } from '@/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import { colors, radii, shadows, spacing, typography } from '@/theme';
import { formatUF, getProgress } from '@/utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? 'Erika';
  const seniorGoal = goals[0];
  const categoryGoal = goals[1];

  return (
    <ScreenContainer contentContainerStyle={styles.page} edges={['top', 'left', 'right']}>
      <View style={styles.mobileFrame}>
        <ImageBackground source={images.park} style={styles.hero}>
          <LinearGradient colors={['rgba(248,247,243,0.34)', colors.background]} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.heroContent}>
            <AppHeader />
            <View style={styles.greeting}>
              <Text style={styles.hello}>Hola, {firstName}</Text>
              <Text style={styles.team}>Equipo Cristian Hernández</Text>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.content}>
          <Text style={styles.screenTitle}>Perfil Ejecutivo</Text>

          <View style={styles.salesCard}>
            <View style={styles.botanicalOne}><Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={110} /></View>
            <View style={styles.botanicalTwo}><Ionicons color="rgba(198,162,76,0.11)" name="leaf-outline" size={78} /></View>
            <View style={styles.salesTop}>
              <View>
                <Text style={styles.salesLabel}>VENTA ACUMULADA</Text>
                <Text style={styles.salesValue}>{formatUF(executiveMetrics.ufSold)} <Text style={styles.salesUnit}>UF</Text></Text>
              </View>
              <View style={styles.trendIcon}>
                <Ionicons color={colors.gold} name="trending-up" size={25} />
              </View>
            </View>
            <Text style={styles.updated}>Actualizado hoy · 18:30</Text>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard detail="clientes" icon="alert-circle-outline" label="MORA" tone="red" value={`${executiveMetrics.delinquencyRate}%`} />
            <MetricCard detail="negocios" icon="briefcase-outline" label="PRODUCTIVIDAD" value={`${executiveMetrics.businessCount}`} />
            <MetricCard detail="global" icon="trophy-outline" label="RANKING" tone="gold" value={`#${executiveMetrics.rankingPosition}`} />
            <MetricCard detail="registros" icon="cloud-upload-outline" label="SALESFORCE" value={`${executiveMetrics.salesforceRecords}`} />
          </View>

          <View style={styles.section}>
            <SectionHeader actionLabel="Ver detalle" onAction={() => router.push('/goals')} title="Mis metas" />
            <GoalCard
              compact
              badge="Meta principal"
              icon="diamond-outline"
              insight={`Te faltan ${seniorGoal.targetValue - seniorGoal.currentValue} UF`}
              progress={getProgress(seniorGoal.currentValue, seniorGoal.targetValue)}
              title={seniorGoal.name}
              value={`${formatUF(seniorGoal.currentValue)} / ${formatUF(seniorGoal.targetValue)} UF`}
            />
            <View style={styles.goalPair}>
              <View style={styles.smallGoal}>
                <Text style={styles.smallGoalLabel}>{categoryGoal.name}</Text>
                <Text style={styles.smallGoalValue}>91%</Text>
                <View style={styles.smallTrack}><View style={[styles.smallFill, { width: '91%' }]} /></View>
              </View>
              <View style={styles.smallGoal}>
                <Text style={styles.smallGoalLabel}>Senior Q3</Text>
                <Text style={styles.smallGoalValue}>78%</Text>
                <View style={styles.smallTrack}><View style={[styles.smallFill, { width: '78%' }]} /></View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Actividad reciente" />
            <View style={styles.activityCard}>
              {activities.map((activity, index) => {
                const tone = activity.tone === 'gold' ? colors.gold : activity.tone === 'success' ? colors.secondary : colors.textMuted;
                return (
                  <Pressable key={activity.id} onPress={() => activity.id === 'positions' ? router.push('/(tabs)/ranking') : activity.id === 'race' ? router.push('/goals') : router.push('/notifications')} style={[styles.activityRow, index < activities.length - 1 && styles.activityBorder]}>
                    <View style={[styles.activityIcon, { backgroundColor: `${tone}16` }]}>
                      <Ionicons color={tone} name={activity.icon as IconName} size={19} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityDescription}>{activity.description}</Text>
                    </View>
                    <Text style={styles.activityDate}>{activity.relativeDate}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', paddingBottom: 28 },
  mobileFrame: { maxWidth: 620, width: '100%' },
  hero: { height: 244 },
  heroContent: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  greeting: { marginTop: 48 },
  hello: { color: colors.primary, fontFamily: typography.serif, fontSize: 29, fontWeight: '600' },
  team: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 13, fontWeight: '600', marginTop: 4 },
  content: { gap: spacing.xl, marginTop: -35, paddingHorizontal: spacing.xl },
  screenTitle: { color: colors.text, fontFamily: typography.serif, fontSize: 27, fontWeight: '600' },
  salesCard: { ...shadows.floating, backgroundColor: colors.primary, borderRadius: radii.xl, minHeight: 164, overflow: 'hidden', padding: spacing.xxl },
  botanicalOne: { bottom: -35, position: 'absolute', right: -15, transform: [{ rotate: '-15deg' }] },
  botanicalTwo: { position: 'absolute', right: 60, top: -30, transform: [{ rotate: '28deg' }] },
  salesTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  salesLabel: { color: 'rgba(255,255,255,0.68)', fontFamily: typography.sans, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  salesValue: { color: colors.surface, fontFamily: typography.serif, fontSize: 42, fontWeight: '600', marginTop: 9 },
  salesUnit: { color: colors.goldOnDark, fontFamily: typography.sans, fontSize: 18, fontWeight: '800' },
  trendIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: radii.md, height: 48, justifyContent: 'center', width: 48 },
  updated: { color: 'rgba(255,255,255,0.52)', fontFamily: typography.sans, fontSize: 10, marginTop: 15 },
  metricsRow: { flexDirection: 'row', gap: 7 },
  section: { gap: spacing.md, marginTop: 5 },
  goalPair: { flexDirection: 'row', gap: spacing.md },
  smallGoal: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, flex: 1, gap: 7, padding: spacing.lg },
  smallGoalLabel: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, fontWeight: '700' },
  smallGoalValue: { color: colors.primary, fontFamily: typography.serif, fontSize: 24, fontWeight: '600' },
  smallTrack: { backgroundColor: colors.border, borderRadius: radii.pill, height: 6, overflow: 'hidden' },
  smallFill: { backgroundColor: colors.gold, borderRadius: radii.pill, height: '100%' },
  activityCard: { ...shadows.card, backgroundColor: colors.surface, borderRadius: radii.lg, overflow: 'hidden', paddingHorizontal: spacing.lg },
  activityRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, minHeight: 78, paddingVertical: spacing.md },
  activityBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  activityIcon: { alignItems: 'center', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  activityContent: { flex: 1 },
  activityTitle: { color: colors.text, fontFamily: typography.sans, fontSize: 13, fontWeight: '800' },
  activityDescription: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 11, marginTop: 3 },
  activityDate: { color: colors.textMuted, fontFamily: typography.sans, fontSize: 9 },
});
