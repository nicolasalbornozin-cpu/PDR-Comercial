import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { DashboardData } from '@/types';
import { colors, radii, spacing, typography } from '@/theme';

export function RecentAchievements({ data }: { data: DashboardData | null }) {
  const achievements = (data?.snapshots ?? []).filter(s =>
    (s.kind === 'category' && s.category && !/sin|no |pendiente/i.test(s.category)) ||
    (s.kind === 'senior' && s.seniorLevel && !/sin|no |pendiente|en carrera/i.test(s.seniorLevel)),
  ).sort((a,b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0,5);
  return <View style={styles.section}>
    <View style={styles.heading}><View style={styles.medal}><Ionicons name="trophy" size={23} color={colors.goldOnDark} /></View><Text style={styles.title}>Últimos logros</Text></View>
    {achievements.map(item => <View style={styles.row} key={`${item.kind}-${item.userId}-${item.id}`}>
      <Ionicons name={item.kind === 'senior' ? 'diamond' : 'ribbon'} color={colors.goldText} size={24} />
      <View style={styles.copy}><Text style={styles.label}>{item.kind === 'senior' ? item.seniorLevel : item.category}</Text><Text style={styles.detail}>{data?.profiles.find(p => p.id === item.userId)?.name ?? 'Logro publicado'}</Text><Text style={styles.date}>Publicado {item.publishedAt.slice(0,10)}</Text></View>
    </View>)}
    {!achievements.length ? <Text style={styles.detail}>{data ? 'Aún no hay logros confirmados en las cargas publicadas.' : 'Los logros aparecerán al cargar los indicadores.'}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  section: { backgroundColor: colors.paleGreen, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  heading: { flexDirection:'row', alignItems:'center', gap:spacing.md },
  medal: { backgroundColor:colors.primary, borderRadius:24, width:46, height:46, alignItems:'center', justifyContent:'center' },
  title: { fontFamily:typography.serif, fontSize:23, color:colors.primary, fontWeight:'600' },
  row: { flexDirection:'row', gap:spacing.md, alignItems:'center', backgroundColor:colors.surface, borderRadius:radii.md, padding:spacing.md },
  copy: { flex:1 }, label:{color:colors.primary,fontSize:14,fontWeight:'800'}, detail:{color:colors.textMuted,fontSize:12,lineHeight:18}, date:{color:colors.textMuted,fontSize:10,marginTop:3},
});
