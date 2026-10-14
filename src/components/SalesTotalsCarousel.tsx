import {Ionicons} from '@expo/vector-icons';
import {useRef,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {colors,radii,shadows,spacing,typography} from '@/theme';
import {formatUF} from '@/utils/format';
export function SalesTotalsCarousel({annualEmitted,annualGross,monthlyEmitted,monthlyGross,label,channel}:{annualEmitted:number;annualGross:number;monthlyEmitted:number;monthlyGross:number;label:string;channel:boolean}){
 const [width,setWidth]=useState(320),[page,setPage]=useState(0);const scroll=useRef<ScrollView>(null);
 const pages=[{title:'VENTAS ACUMULADAS DEL AÑO',emitted:annualEmitted,gross:annualGross},{title:'VENTAS DEL MES',emitted:monthlyEmitted,gross:monthlyGross}];
 return <View style={styles.card}>
  <Ionicons color="rgba(255,255,255,0.07)" name="leaf-outline" size={120} style={styles.leaf}/>
  <View onLayout={e=>{const w=e.nativeEvent.layout.width;if(w>0)setWidth(w);}}>
   <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e=>setPage(Math.round(e.nativeEvent.contentOffset.x/width))}>
    {pages.map(p=><View key={p.title} style={{width,gap:spacing.md}}><Text style={styles.label}>{p.title}{channel?' · CANAL SANTA CLARA':''}</Text>
     <View style={styles.split}><View style={styles.half}><Text style={styles.label}>EMITIDO</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{formatUF(p.emitted)} <Text style={styles.unit}>UF</Text></Text></View><View style={styles.divider}/><View style={styles.half}><Text style={styles.label}>BRUTO</Text><Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{formatUF(p.gross)} <Text style={styles.unit}>UF</Text></Text></View></View>
     <Text style={styles.caption}>{p.title===pages[1].title?label:'Desliza para ver el mes comercial'}</Text>
    </View>)}
   </ScrollView>
  </View>
  <View style={styles.dots}>{pages.map((p,index)=><Pressable key={p.title} accessibilityRole="button" accessibilityLabel={index?'Ver ventas mensuales':'Ver ventas anuales'} accessibilityState={{selected:page===index}} hitSlop={10} onPress={()=>{scroll.current?.scrollTo({x:index*width,animated:true});setPage(index);}} style={[styles.dot,page===index&&styles.selected]}/>)}</View>
 </View>;
}
const styles=StyleSheet.create({card:{...shadows.card,backgroundColor:colors.primary,borderRadius:radii.xl,padding:spacing.xl,gap:spacing.md,overflow:'hidden'},leaf:{position:'absolute',right:-10,bottom:-20},label:{color:'rgba(255,255,255,0.72)',fontFamily:typography.sans,fontSize:10,fontWeight:'700'},split:{flexDirection:'row',alignItems:'center',gap:spacing.md},half:{flex:1,gap:6},divider:{width:1,height:50,backgroundColor:'rgba(255,255,255,0.2)'},value:{fontFamily:typography.sans,fontSize:27,fontWeight:'800',color:colors.surface},unit:{fontSize:14,color:colors.goldOnDark},caption:{fontFamily:typography.sans,fontSize:11,color:'rgba(255,255,255,0.7)'},dots:{flexDirection:'row',gap:10,alignSelf:'center'},dot:{height:8,width:8,borderRadius:4,backgroundColor:'rgba(255,255,255,0.3)'},selected:{backgroundColor:colors.gold}});
