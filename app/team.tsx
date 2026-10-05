import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { DetailHeader } from '@/components/DetailHeader';
import { ScreenContainer } from '@/components/ScreenContainer';
import { useAuth } from '@/hooks/useAuth';
import { snapshotService } from '@/services/snapshotService';
import { colors, radii, spacing, typography } from '@/theme';
import { DashboardData } from '@/types';
import { daysWithoutSale, hasGoalLevel, hasMonthWithoutSale, hasQualifiedSenior, latestGoal } from '@/utils/commercialRules';
import { formatUF } from '@/utils/format';
import { teamProductivityRows } from '@/utils/teamProductivity';

const titles = { debt: 'Contratos en mora', zero: 'Un mes sin vender', category: 'Ejecutivos categorizando', senior: 'Seniors de mi equipo', productivity: 'Productividad de mi equipo' };
export default function TeamScreen() {
  const { kind: rawKind } = useLocalSearchParams<{kind?: string}>();
  const kind = rawKind && Object.hasOwn(titles,rawKind) ? rawKind as keyof typeof titles : 'debt';
  const { user, isPreviewing } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{userId:string;data:DashboardData} | null>(null);
  const [error, setError] = useState('');
  const allowed = ['coordinator','sales_manager','commercial_manager','admin'].includes(user?.role ?? '') && (!(kind==='category'||kind==='senior') || user?.role==='coordinator');
  useEffect(() => {
    if (!user || !allowed) return;
    let active=true;
    snapshotService.getDashboard(user,{preview:isPreviewing}).then(data=>{if(active)setLoaded({userId:user.id,data});}).catch(()=>{if(active)setError('Error al comunicar con el servidor');});
    return()=>{active=false;};
  },[user,isPreviewing,allowed]);
  if (!allowed) return <Redirect href="/(tabs)/home" />;
  const data=loaded&&loaded.userId===user?.id?loaded.data:null;
  const workers=(data?.profiles??[]).filter(p=>p.role==='seller'&&p.active&&p.employmentStatus==='active').filter(p=>{
    const metric=data?.latestByUser[p.id];
    if(kind==='debt')return (metric?.debtSalesCount??0)>0;
    if(kind==='zero')return hasMonthWithoutSale(metric);
    if(kind==='productivity')return true;
    const goal=data?latestGoal(data,p.id,kind):undefined;
    return kind==='category'?hasGoalLevel(goal?.category):hasQualifiedSenior(goal);
  }).sort((a,b)=>kind==='debt'?(data?.latestByUser[b.id]?.debtSalesCount??0)-(data?.latestByUser[a.id]?.debtSalesCount??0):a.name.localeCompare(b.name,'es'));
  const productivityRows = data && user ? teamProductivityRows(data, user) : [];
  const productivityMetrics = productivityRows.filter(row => row.metric?.productivity !== undefined);
  const productionPeriod = data?.snapshots.find(row => row.kind === 'commercial' && row.productivity !== undefined);
  return <ScreenContainer contentContainerStyle={styles.page}>
    <DetailHeader title={titles[kind]} />
    <Text style={styles.subtitle}>{kind==='debt'?`${workers.reduce((sum,p)=>sum+(data?.latestByUser[p.id]?.debtSalesCount??0),0)} contratos en total · ${workers.length} ejecutivos`: `${workers.length} ejecutivos de tu equipo`}</Text>
    {error?<Text accessibilityRole="alert">{error}</Text>:!data?<ActivityIndicator color={colors.gold}/>:null}
    {kind === 'productivity' && data ? <View style={styles.card}>
      <View style={styles.identity}><Text style={styles.name}>{productivityRows.length} ejecutivos de tu equipo</Text>
        <Text style={styles.detail}>Se conserva la productividad calculada en Producción. Rojo: menor a 1.</Text>
        {productionPeriod ? <Text style={styles.detail}>Período: {productionPeriod.periodStart} al {productionPeriod.periodEnd}</Text> : null}
        <Text style={styles.detail}>{productivityMetrics.filter(row => row.metric!.productivity! < 1).length} bajo 1 · {productivityMetrics.length} con dato</Text>
      </View>
    </View> : null}
    {kind === 'productivity' ? productivityRows.map(({person, metric}) => <View key={person.id} style={styles.card}>
      <View style={styles.identity}><Text style={styles.name}>{person.name}</Text>
        <Text style={styles.detail}>{data?.profiles.find(p => p.id === person.supervisorId)?.name ?? 'Mi coordinación'}</Text>
        <Text style={styles.detail}>{metric?.productionUf === undefined ? 'Sin producción cargada' : `${formatUF(metric.productionUf)} UF de Producción`}</Text>
      </View><Text style={[styles.productivity, {color: metric?.productivity === undefined ? colors.textMuted : metric.productivity < 1 ? colors.danger : colors.success}]}>
        {metric?.productivity === undefined ? '—' : metric.productivity.toFixed(2)}
      </Text>
    </View>) : workers.map(p=>{
      const m=data?.latestByUser[p.id];const goal=(kind==='category'||kind==='senior')&&data?latestGoal(data,p.id,kind):undefined;
      const clickable=kind==='category'||kind==='senior';
      return <Pressable key={p.id} disabled={!clickable} accessibilityRole={clickable?'button':undefined} onPress={()=>router.push({pathname:'/goals',params:{worker:p.id,focus:kind}})} style={styles.card}>
        <View style={styles.identity}><Text style={styles.name}>{p.name}</Text><Text style={styles.detail}>{kind==='debt'?`${m?.debtSalesCount} contratos en mora`:kind==='zero'?m?.lastSaleDate?`${daysWithoutSale(m.lastSaleDate)} días sin vender · última venta ${m.lastSaleDate}`:'Sin ventas registradas':kind==='category'?goal?.category:goal?.seniorLevel}</Text>
        {goal?<Text style={styles.detail}>{formatUF(kind==='category'?goal.categoryUf??0:goal.eligibleTotalUf??0)} UF · {goal.smadCount??'—'} SMAD</Text>:null}</View>
        {clickable?<Ionicons name="chevron-forward" size={22} color={colors.goldText}/>:null}
      </Pressable>;
    })}
    {data&&!workers.length?<Text style={styles.subtitle}>No hay ejecutivos en este grupo.</Text>:null}
  </ScreenContainer>;
}
const styles=StyleSheet.create({page:{gap:spacing.md,padding:spacing.xl,maxWidth:620,width:'100%',alignSelf:'center'},subtitle:{fontFamily:typography.sans,color:colors.textMuted,fontSize:13},card:{backgroundColor:colors.surface,borderRadius:radii.lg,padding:spacing.lg,flexDirection:'row',alignItems:'center',gap:spacing.md},identity:{flex:1,gap:6},name:{fontFamily:typography.sans,fontSize:13,fontWeight:'800',color:colors.primary},detail:{fontFamily:typography.sans,fontSize:12,color:colors.textMuted},productivity:{fontFamily:typography.sans,fontSize:25,fontWeight:'800'}});
