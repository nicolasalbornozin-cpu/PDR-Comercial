import {useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import {AppButton} from './Buttons';
import {FormField} from './FormField';
import {parseIndividualSheet,SheetImport,SheetSource,sheetSources} from '@/services/individualSheetParser';
import {individualSheetService} from '@/services/individualSheetService';
import {colors,radii,spacing} from '@/theme';

export function IndependentSheetUpload(){
 const [source,setSource]=useState<SheetSource>('category'),[parsed,setParsed]=useState<SheetImport|null>(null),[filename,setFilename]=useState('');
 const [annualRanking,setAnnualRanking]=useState<SheetImport|null>(null);
 const [label,setLabel]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[closed,setClosed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function choose(){
  setError('');setMessage('');setParsed(null);setAnnualRanking(null);
  try{
   const file=await DocumentPicker.getDocumentAsync({type:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel'],copyToCacheDirectory:true});
   if(file.canceled)return;setBusy(true);const asset=file.assets[0];if((asset.size??0)>20*1024*1024)throw Error('El Excel excede 20 MB.');
   const webFile=(asset as typeof asset & {file?:Blob}).file;
   const data=webFile?new Uint8Array(await webFile.arrayBuffer()):await new File(asset.uri).bytes();const xlsx=await import('xlsx');
   const workbook=xlsx.read(data,{type:'array',cellNF:true});
   if(source==='ranking_monthly'&&!/^ranking plataforma(?: \(\d+\))?\.xlsx?$/i.test(asset.name.trim()))throw Error('Selecciona el archivo Ranking Plataforma.xlsx.');
   const result=parseIndividualSheet(workbook,source,{start,end});
   setFilename(asset.name);setParsed(result);
   if(source==='ranking_monthly'){
    const year=(end||start).slice(0,4);
    setAnnualRanking(parseIndividualSheet(workbook,'ranking_annual',{start:`${year}-01-01`,end:`${year}-12-31`}));
   }
  }catch(e){setError(e instanceof Error?e.message:'No se pudo leer el Excel.');}finally{setBusy(false);}
 }
 async function publish(){
  if(!parsed)return;setBusy(true);setError('');setMessage('');
  try{
   if(source==='ranking_monthly'&&annualRanking){
    const year=(end||start).slice(0,4);
    const monthly=await individualSheetService.publish(parsed,filename,label,start,end);
    const annual=await individualSheetService.publish(annualRanking,filename,`Ranking anual ${year}`,`${year}-01-01`,`${year}-12-31`);
    setMessage(`Ranking Plataforma: ${monthly.published} resultados mensuales y ${annual.published} anuales publicados.`);
   }else{
    const result=await individualSheetService.publish(parsed,filename,label,start,end,closed?'closed':'open');
    const omitted=result.skipped.length?` ${result.skipped.length} persona(s) sin identidad en la dotación fueron omitidas: ${result.skipped.join(', ')}.`:'';
    setMessage(`${parsed.sheet}: ${result.published} trabajadores publicados. Las otras cargas se conservaron.${omitted}`);
   }
   setParsed(null);setAnnualRanking(null);
  }
  catch(e){setError(e instanceof Error?e.message:'No se pudo publicar.');}finally{setBusy(false);}
 }
 return <View style={styles.card}>
  <Text style={styles.title}>Actualizar por hoja</Text>
  <Text style={styles.copy}>Selecciona el origen y su Excel. Solo se carga la hoja indicada. Dotacion controla nombres, equipos y acceso; las demás cargas no habilitan personas. Los contratos y datos de clientes no se envían.</Text>
  {source==='dotacion'?<Text style={styles.copy}>Sube la nómina completa: reemplaza la anterior. Quienes falten, estén con licencia o vacaciones no podrán ingresar (Error 444). Se mantienen Benjamín Hernández, Gabriel De Luca y Tomás Espinoza, y el acceso de administrador.</Text>:null}
  <View style={styles.choices}>{(Object.keys(sheetSources) as SheetSource[]).filter(key=>key!=='ranking_annual').map(key=><Pressable disabled={busy} key={key} onPress={()=>{setSource(key);setParsed(null);setAnnualRanking(null);setFilename('');setLabel('');setStart('');setEnd('');setError('');setMessage('');setClosed(false);}} style={[styles.chip,source===key&&styles.selected]}><Text style={{color:source===key?colors.surface:colors.primary}}>{sheetSources[key].label}</Text></Pressable>)}</View>
  <Text style={styles.sheet}>{source==='ranking_monthly'?'Archivo: Ranking Plataforma.xlsx · hojas anual total, anual, mes y mes emitido':`Hoja: ${sheetSources[source].sheet}`}</Text>
  <FormField label="Nombre del período" icon="calendar-outline" value={label} onChangeText={setLabel} placeholder="Ej.: Catego julio-agosto 2026"/>
  <FormField label="Inicio del período" icon="calendar-outline" value={start} onChangeText={v=>{setStart(v);setParsed(null);}} placeholder="AAAA-MM-DD"/>
  <FormField label="Cierre del período" icon="calendar-outline" value={end} onChangeText={v=>{setEnd(v);setParsed(null);}} placeholder="AAAA-MM-DD"/>
  {source==='senior'?<Pressable accessibilityRole="checkbox" accessibilityState={{checked:closed}} onPress={()=>{setClosed(!closed);setParsed(null);}}><Text style={styles.copy}>{closed?'☑':'☐'} Cierre Senior: confirmo que esta hoja está recalculada solo con ventas emitidas.</Text></Pressable>:null}
  <AppButton label={filename||'Seleccionar Excel'} icon="document-attach-outline" variant="secondary" onPress={choose} disabled={busy}/>
  {parsed?<View style={styles.validation}><Text style={styles.sheet}>{parsed.records.length}{annualRanking?` mensuales · ${annualRanking.records.length} anuales`:' trabajadores'} · {parsed.errors.length+(annualRanking?.errors.length??0)} errores</Text>{[...parsed.errors.slice(0,6),...(annualRanking?.errors.slice(0,6)??[]),...parsed.warnings.slice(0,6)].map((t,i)=><Text style={styles.copy} key={i}>{t}</Text>)}</View>:null}
  {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
  {message?<Text accessibilityRole="alert" style={{color:colors.success}}>{message}</Text>:null}
  <AppButton label={source==='ranking_monthly'?'Publicar ambos rankings':'Publicar esta hoja'} loading={busy} disabled={!parsed||!!parsed.errors.length||!!annualRanking?.errors.length||!label||!start||!end} onPress={publish}/>
 </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderRadius:radii.xl,padding:spacing.xl,gap:spacing.md},title:{fontSize:23,color:colors.primary,fontWeight:'700'},copy:{fontSize:13,lineHeight:20,color:colors.textMuted},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{borderRadius:18,padding:10,backgroundColor:colors.softGreen},selected:{backgroundColor:colors.primary},sheet:{color:colors.primary,fontWeight:'700'},validation:{padding:12,backgroundColor:colors.background,borderRadius:12,gap:8}});
