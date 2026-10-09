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
import { daysWithoutSale, hasMonthWithoutSale, latestGoal } from '@/utils/commercialRules';
import { goalRemainingUf } from '@/utils/goalProgress';
import { formatUF } from '@/utils/format';
import { scopedSellers, teamSummary } from '@/utils/teamOverview';

const titles = { debt: 'Contratos en mora', zero: 'Días sin vender', category: 'Categorización de mi equipo', senior: 'Senior de mi equipo', productivity: 'Productividad de mi equipo' };
export default function TeamScreen() {
  const { kind: rawKind, scope: scopeId } = useLocalSearchParams<{kind?: string; scope?: string}>();
  const kind = rawKind && Object.hasOwn(titles,rawKind) ? rawKind as keyof typeof titles : 'debt';
  const { user, isPreviewing } = useAuth();
  const router = useRouter();
  const [loaded, setLoaded] = useState<{userId:string;data:DashboardData} | null>(null);
  const [error, setError] = useState('');
  const allowed = ['coordinator','sales_manager','commercial_manager','sales_director','admin'].includes(user?.role ?? '');
  useEffect(() => {
    if (!user || !allowed) return;
    let active=true;
    snapshotService.getDashboard(user,{preview:isPreviewing}).then(data=>{if(active){setLoaded({userId:user.id,data});setError('');}}).catch(()=>{if(active)setError('Error al comunicar con el servidor');});
    return()=>{active=false;};
  },[user,isPreviewing,allowed]);
  if (!allowed || !user) return <Redirect href="/(tabs)/home" />;
  const data=loaded?.userId===user.id?loaded.data:null;
  const scope=data?.profiles.find(p=>p.id===scopeId&&['coordinator','sales_manager'].includes(p.role)&&p.active&&p.employmentStatus==='active');
  const goalKind=kind==='category'||kind==='senior';
  if(data&&scopeId&&!scope)return <ScreenContainer><DetailHeader title={titles[kind]}/><Text>No tienes acceso a este equipo.</Text></ScreenContainer>;
  const sellers=data?scopedSellers(data,user,scope):[];
  const groupRole = scope?.role==='coordinator'||user.role==='coordinator' ? null
    : scope?.role==='sales_manager'||user.role==='sales_manager' ? 'coordinator' : 'sales_manager';
  const groups=data?.profiles.filter(p=>p.role===groupRole&&p.active&&p.employmentStatus==='active'
    && (!scope||p.salesManagerId===scope.id)
    && (user.role!=='sales_manager'||p.salesManagerId===user.id))??[];
  const workers=sellers.filter(p=>kind!=='debt'||(data?.latestByUser[p.id]?.debtSalesCount??0)>0)
    .sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const summary=data?teamSummary(sellers,data):null;
  return <ScreenContainer contentContainerStyle={styles.page}>
    <DetailHeader title={titles[kind]}/>
    {scope?<Text style={styles.name}>{scope.name}</Text>:null}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:!data?<ActivityIndicator color={colors.gold}/>:null}
    {summary?<View style={styles.card}><View style={styles.identity}>
      <Text style={styles.name}>{groupRole==='coordinator'?'Mis coordinadores':groupRole==='sales_manager'?'Mis jefes de venta':sellers.length+' ejecutivos de mi equipo'}</Text>
      <Text style={styles.detail}>{kind==='debt'?summary.debt+' contratos en mora · suma total':kind==='zero'?(summary.days===null?'Sin fecha de última venta':summary.days+' días sin vender como equipo')+' · '+summary.zero+' personas con un mes sin vender':goalKind?'Todos los ejecutivos, incluidos quienes todavía no cumplen': 'Productividad de Producción, sin recalcular el resultado individual'}</Text>
    </View></View>:null}
    {groupRole?groups.map(p=>{
      const children=data?scopedSellers(data,user,p):[];
      const totals=data?teamSummary(children,data):null;
      return <Pressable key={p.id} accessibilityRole="button" onPress={()=>router.push({pathname:'/team',params:{kind,scope:p.id}})} style={styles.card}>
        <View style={styles.identity}><Text style={styles.name}>{p.name}</Text><Text style={styles.detail}>{children.length} ejecutivos</Text>
          <Text style={styles.detail}>{kind==='debt'?(totals?.debt??0)+' contratos en mora':kind==='productivity'?'Productividad promedio: '+(totals?.productivity?.toFixed(2)??'Sin dato'):kind==='zero'?(totals?.days??'Sin dato')+' días sin vender como equipo · '+(totals?.zero??0)+' personas sin ventas en un mes':'Ver avance de todos los ejecutivos'}</Text>
        </View><Ionicons name="chevron-forward" size={22} color={colors.goldText}/>
      </Pressable>;
    }):workers.map(p=>{
      const m=data?.latestByUser[p.id];const goal=goalKind&&data?latestGoal(data,p.id,kind):undefined;
      const missing=goalKind?goalRemainingUf(goal,kind):undefined;
      return <Pressable key={p.id} disabled={!goalKind} accessibilityRole={goalKind?'button':undefined} onPress={()=>router.push({pathname:'/goals',params:{worker:p.id,focus:kind}})} style={styles.card}>
        <View style={styles.identity}><Text style={styles.name}>{p.name}</Text>
          <Text style={styles.detail}>{kind==='debt'?m?.debtSalesCount+' contratos en mora':kind==='zero'?m?.lastSaleDate?daysWithoutSale(m.lastSaleDate)+' días sin vender · última venta '+m.lastSaleDate+(hasMonthWithoutSale(m)?' · un mes sin ventas':''):'Sin fecha de venta registrada':kind==='productivity'?(m?.productionUf===undefined?'Sin dato':formatUF(m.productionUf))+' UF de Producción':kind==='category'?goal?.category:goal?.seniorLevel}</Text>
          {goal?<><Text style={styles.detail}>{goal.goalPending?'Pendiente de nueva carga':formatUF(kind==='category'?goal.categoryUf??0:goal.eligibleTotalUf??0)+' UF · '+(goal.smadCount??'—')+' SMAD'}</Text><Text style={styles.detail}>{missing===undefined?goal.categoryRemaining??goal.seniorRemaining:'Faltan '+formatUF(missing)+' UF y '+(goal.smadRemaining??'—')+' SMAD'}</Text></>:null}
        </View>{kind==='productivity'?<Text style={[styles.productivity,{color:m?.productivity===undefined?colors.textMuted:m.productivity<1?colors.danger:colors.success}]}>{m?.productivity?.toFixed(2)??'—'}</Text>:goalKind?<Ionicons name="chevron-forward" size={22} color={colors.goldText}/>:null}
      </Pressable>;
    })}
    {data&&!(groupRole?groups.length:workers.length)?<Text style={styles.subtitle}>No hay personas en este grupo.</Text>:null}
  </ScreenContainer>;
}
const styles=StyleSheet.create({page:{gap:spacing.md,padding:spacing.xl,maxWidth:620,width:'100%',alignSelf:'center'},subtitle:{fontFamily:typography.sans,color:colors.textMuted,fontSize:13},card:{backgroundColor:colors.surface,borderRadius:radii.lg,padding:spacing.lg,flexDirection:'row',alignItems:'center',gap:spacing.md},identity:{flex:1,gap:6},name:{fontFamily:typography.sans,fontSize:13,fontWeight:'800',color:colors.primary},detail:{fontFamily:typography.sans,fontSize:12,color:colors.textMuted},productivity:{fontFamily:typography.sans,fontSize:25,fontWeight:'800'},error:{color:colors.danger}});
