import {Ionicons} from '@expo/vector-icons';
import {useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {colors,radii,shadows,spacing,typography} from '@/theme';
import {formatUF} from '@/utils/format';
export function SalesTotalsCarousel({annualEmitted,annualGross,monthlyEmitted,monthlyGross,label,channel}:{annualEmitted:number;annualGross:number;monthlyEmitted:number;monthlyGross:number;label:string;channel:boolean}){
 const [width,setWidth]=useState(320),[page,setPage]=useState(0);const scroll=useRef<ScrollView>(null);
 const pages=[{title:'VENTAS ACUMULADAS DEL AÑO',emitted:annualEmitted,gross:annualGross},{title:'VENTAS DEL MES',emitted:monthlyEmitted,gross:monthlyGross}];
 const selectPage=(index:number)=>{const next=index===1?1:0;setPage(next);scroll.current?.scrollTo({x:next*width,animated:true});};
 return <View style={styles.card}>
  <View pointerEvents="none" style={styles.leaf}><Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={120}/></View>
  <View style={styles.switcher}>{['Año','Mes'].map((title,index)=><Pressable key={title} accessibilityRole="button" accessibilityLabel={index?'Ver ventas mensuales':'Ver ventas anuales'} accessibilityState={{selected:page===index}} onPress={()=>selectPage(index)} style={[styles.periodButton,page===index&&styles.periodSelected]}><Text style={[styles.periodText,page===index&&styles.periodTextSelected]}>{title}</Text></Pressable>)}</View>
  <View style={styles.viewport} onLayout={e=>{const w=e.nativeEvent.layout.width;if(w>0&&w!==width){setWidth(w);scroll.current?.scrollTo({x:page*w,animated:false});}}}>
   <ScrollView ref={scroll} style={styles.scroller} horizontal pagingEnabled directionalLockEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={e=>setPage(Math.max(0,Math.min(1,Math.round(e.nativeEvent.contentOffset.x/width))))}>
    {pages.map((p,index)=><View key={p.title} accessibilityElementsHidden={page!==index} importantForAccessibility={page===index?'auto':'no-hide-descendants'} style={{width,gap:spacing.md}}><Text style={styles.label}>{p.title}{channel?' · CANAL SANTA CLARA':''}</Text>
     <View style={styles.split}><View style={styles.half}><Text style={styles.label}>EMITIDO</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{formatUF(p.emitted)} <Text style={styles.unit}>UF</Text></Text></View><View style={styles.divider}/><View style={styles.half}><Text style={styles.label}>BRUTO</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{formatUF(p.gross)} <Text style={styles.unit}>UF</Text></Text></View></View>
     <Text style={styles.caption}>{index===1?label:'Acumulado anual'}</Text>
    </View>)}
   </ScrollView>
  </View>
  <View style={styles.navigation}>
   <Pressable accessibilityRole="button" accessibilityLabel="Anterior: ventas anuales" disabled={page===0} onPress={()=>selectPage(0)} style={[styles.arrow,page===0&&styles.disabled]}><Ionicons name="chevron-back" size={20} color={colors.surface}/></Pressable>
   <View style={styles.hint}><View style={styles.dots}>{pages.map((p,index)=><View key={p.title} style={[styles.dot,page===index&&styles.selected]}/>)}</View><Text style={styles.caption}>Desliza · {page+1} de 2</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Siguiente: ventas mensuales" disabled={page===1} onPress={()=>selectPage(1)} style={[styles.arrow,page===1&&styles.disabled]}><Ionicons name="chevron-forward" size={20} color={colors.surface}/></Pressable>
  </View>
 </View>;
}
const styles=StyleSheet.create({card:{...shadows.card,minWidth:0,backgroundColor:colors.primary,borderRadius:radii.xl,padding:spacing.xl,gap:spacing.md,overflow:'hidden'},leaf:{position:'absolute',right:-10,bottom:-20},switcher:{flexDirection:'row',alignSelf:'flex-start',padding:3,borderRadius:24,backgroundColor:'rgba(255,255,255,0.12)'},periodButton:{minWidth:80,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:22,paddingHorizontal:spacing.md},periodSelected:{backgroundColor:colors.gold},periodText:{fontFamily:typography.sans,color:colors.surface,fontSize:14,fontWeight:'700'},periodTextSelected:{color:colors.primary},viewport:{minWidth:0,width:'100%',overflow:'hidden'},scroller:{flexGrow:0,width:'100%'},label:{color:'rgba(255,255,255,0.72)',fontFamily:typography.sans,fontSize:10,fontWeight:'700'},split:{flexDirection:'row',alignItems:'center',gap:spacing.md},half:{flex:1,gap:6},divider:{width:1,height:50,backgroundColor:'rgba(255,255,255,0.2)'},value:{fontFamily:typography.sans,fontSize:27,fontWeight:'800',color:colors.surface},unit:{fontSize:14,color:colors.goldOnDark},caption:{fontFamily:typography.sans,fontSize:11,color:'rgba(255,255,255,0.7)'},navigation:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},arrow:{minWidth:44,minHeight:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.1)'},disabled:{opacity:0.3},hint:{gap:8,alignItems:'center'},dots:{flexDirection:'row',gap:10,alignSelf:'center'},dot:{height:8,width:8,borderRadius:4,backgroundColor:'rgba(255,255,255,0.3)'},selected:{backgroundColor:colors.gold}});
