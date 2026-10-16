import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {AppButton} from './Buttons';
import {parseIndividualSheet,searchName,SheetImport,SheetSource,sheetSources} from '@/services/individualSheetParser';
import {individualSheetService} from '@/services/individualSheetService';
import {uploadCampaignLabel,uploadPublicationDates} from '@/utils/uploadCampaign';
import {colors,radii,spacing} from '@/theme';

const choices: {source:SheetSource;slot:'current'|'previous';title:string}[]=[
 {source:'category',slot:'current',title:'Catego vigente'},{source:'category',slot:'previous',title:'Catego anterior'},
 {source:'senior',slot:'current',title:'Carga Senior vigente'},{source:'senior',slot:'previous',title:'Carga Senior anterior'},
 ...(['dotacion','production_sellers','titanes','rbh','msc','sauce','ranking_monthly'] as SheetSource[]).map(source=>({source,slot:'current' as const,title:sheetSources[source].label})),
];
export function IndependentSheetUpload(){
 const [selection,setSelection]=useState(0),[parsed,setParsed]=useState<SheetImport[]>([]),[filename,setFilename]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const {source,slot}=choices[selection];
 const isGoal=source==='category'||source==='senior';
 const dates=uploadPublicationDates(slot);
 async function choose(){
  if(busy)return;
  setError('');setMessage('');setParsed([]);
  setBusy(true);let cachedFile:File|undefined;
  try{
   const picked=await DocumentPicker.getDocumentAsync({type:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel'],copyToCacheDirectory:true});
   if(picked.canceled)return;const asset=picked.assets[0];
   const webFile=(asset as typeof asset & {file?:Blob}).file;if(!webFile)cachedFile=new File(asset.uri);
   if((asset.size??webFile?.size??cachedFile?.size??0)>20*1024*1024)throw Error('El Excel excede 20 MB.');
   const data=webFile?new Uint8Array(await webFile.arrayBuffer()):await new File(asset.uri).bytes();const xlsx=await import('xlsx');
   if(data.byteLength>20*1024*1024)throw Error('El Excel excede 20 MB.');
   const book=xlsx.read(data,{type:'array',cellNF:true});
   if(source==='ranking_monthly'&&!/^ranking plataforma(?: \(\d+\))?\.xlsx?$/i.test(asset.name.trim()))throw Error('Selecciona Ranking Plataforma.xlsx.');
   const selectedNames=source==='senior'||source==='category'?book.SheetNames.filter(n=>searchName(n)===searchName(sheetSources[source].sheet)):book.SheetNames;
   const selectedBook={...book,SheetNames:selectedNames,Sheets:Object.fromEntries(selectedNames.map(n=>[n,book.Sheets[n]]))};
   const imports=[parseIndividualSheet(selectedBook,source,dates)];
   if(source==='production_sellers')imports.push(parseIndividualSheet(book,'production_coordinators',dates));
   if(source==='ranking_monthly'){
    const annual={start:`${dates.year}-01-01`,end:`${dates.year}-12-31`};
    imports.push(parseIndividualSheet(book,'ranking_annual',annual),parseIndividualSheet(book,'cancellations',annual));
   }
   setFilename(asset.name);setParsed(imports);
  }catch(e){setError(e instanceof Error?e.message:'No se pudo leer el Excel.');}finally{if(cachedFile?.exists){try{cachedFile.delete();}catch{/* The OS may already have cleared the picker cache. */}}setBusy(false);}
 }
 async function publish(){
  if(!parsed.length||busy)return;setBusy(true);setError('');setMessage('');
  try{
   const label=uploadCampaignLabel(filename,source,slot);
   if(parsed.length>1){
    const result=await individualSheetService.publishBundle(parsed.map(p=>({parsed:p,filename,label:p.source==='ranking_annual'?`Ranking anual ${dates.year}`:p.source==='cancellations'?`Anulaciones ${dates.year}`:label,start:p.source==='ranking_annual'||p.source==='cancellations'?`${dates.year}-01-01`:dates.start,end:p.source==='ranking_annual'||p.source==='cancellations'?`${dates.year}-12-31`:dates.end})));
    setMessage(`${result.published} resultados publicados juntos.${result.skipped.length?` ${result.skipped.length} filas fuera de dotación omitidas.`:''}`);
   }else{
    const result=await individualSheetService.publish(parsed[0],filename,label,dates.start,dates.end,slot==='current'?'open':'closed',slot);
    setMessage(`${choices[selection].title}: ${result.published} trabajadores publicados.${isGoal?' La otra carga se conservó.':''}${result.skipped.length?` ${result.skipped.length} filas fuera de dotación omitidas.`:''}`);
   }
   setParsed([]);setFilename('');
  }catch(e){setError(e instanceof Error?e.message:'No se pudo publicar.');}finally{setBusy(false);}
 }
 const errors=parsed.flatMap(p=>p.errors);
 return <View style={styles.card}>
  <Text style={styles.title}>Actualizar datos</Text>
  <Text style={styles.copy}>Elige el destino. Catego y Senior se cargan por separado en vigente o anterior, sin escribir fechas. Sus nombres se pueden editar con el lápiz. Dotación define equipos y accesos; las correcciones de nombres por RUT se conservan.</Text>
  <View style={styles.choices}>{choices.map((choice,index)=><Pressable accessibilityRole="button" accessibilityState={{selected:selection===index}} disabled={busy} key={choice.source+choice.slot} onPress={()=>{setSelection(index);setParsed([]);setFilename('');setError('');setMessage('');}} style={[styles.chip,selection===index&&styles.selected]}><Text style={{color:selection===index?colors.surface:colors.primary}}>{choice.title}</Text></Pressable>)}</View>
  <Text style={styles.sheet}>{source==='ranking_monthly'?'Ranking Plataforma: anual total, anual emitido, mensual, mensual emitido y anulaciones':source==='production_sellers'?'Hojas: produccion vendedores y produccion coordinadores':`Hoja: ${sheetSources[source].sheet}`}</Text>
  {isGoal?<Text style={styles.copy}>Destino: {choices[selection].title}. Sube un Excel con una sola hoja «{source==='category'?'Carga Catego':'Carga Senior'}». Reemplaza únicamente {slot==='current'?'la vigente; la anterior se conserva':'la anterior; la vigente se conserva'}. No necesitas escribir fechas ni período aquí.</Text>:null}
  {source==='production_sellers'?<Text style={styles.copy}>Un solo Excel con las dos hojas: «produccion vendedores» y «produccion coordinadores». Se publican juntas.</Text>:null}
  {['titanes','rbh','msc'].includes(source)?<Text style={styles.copy}>Sube el archivo individual «{sheetSources[source].sheet}.xlsx», con su hoja del mismo nombre. Solo reemplaza la mora de esta jefatura.</Text>:null}
  {source==='sauce'?<Text style={styles.copy}>Sube «Carga Sauce.xlsx» con la hoja «Carga Sauce». Este porcentaje de riesgo se carga por separado de los contratos en mora.</Text>:null}
  {source==='dotacion'?<Text style={styles.copy}>Nómina completa: los ausentes, con licencia o vacaciones no podrán ingresar (Error 444). Se conservan las tres excepciones autorizadas y el administrador.</Text>:null}
  {source==='ranking_monthly'?<Text style={styles.copy}>En «Ranking anual total», las tablas Jefes y Coordinadores con Bruto / Emitido actualizan las UF anuales de Inicio sin recalcularlas. En «anulaciones», Ejecutivo y Última venta se leen por separado de las UF anuladas. La app calcula los días sin vender desde esa fecha.</Text>:null}
  <AppButton label={filename||'Seleccionar Excel'} icon="document-attach-outline" variant="secondary" onPress={choose} disabled={busy}/>
  {parsed.map(p=><View style={styles.validation} key={p.source}><Text style={styles.sheet}>{p.sheet}: {p.records.length} trabajadores · {p.errors.length} errores</Text>{[...p.errors.slice(0,5),...p.warnings.slice(0,3)].map((t,i)=><Text style={styles.copy} key={i}>{t}</Text>)}</View>)}
  {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
  {message?<Text accessibilityRole="alert" style={{color:colors.success}}>{message}</Text>:null}
  <AppButton label={`Publicar ${choices[selection].title}`} loading={busy} disabled={busy||!parsed.length||parsed.some(p=>!p.records.length)||!!errors.length} onPress={publish}/>
 </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderRadius:radii.xl,padding:spacing.xl,gap:spacing.md},title:{fontSize:23,color:colors.primary,fontWeight:'700'},copy:{fontSize:13,lineHeight:20,color:colors.textMuted},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderRadius:18,padding:10,backgroundColor:colors.softGreen},selected:{backgroundColor:colors.primary},sheet:{color:colors.primary,fontWeight:'700'},validation:{padding:12,backgroundColor:colors.background,borderRadius:12,gap:8}});
