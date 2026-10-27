import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import {useState} from 'react';
import {Platform,StyleSheet,Text,View} from 'react-native';
import {AppButton} from './Buttons';
import {checkAppUpdate} from '@/services/appUpdateService';
import {colors,radii,spacing} from '@/theme';

export const APP_REVISION='2026.10.27.1';
export function AppUpdateStatus(){
 const update=Updates.useUpdates();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[ready,setReady]=useState(false);
 const enabled=Platform.OS!=='web'&&!__DEV__&&Updates.isEnabled;
 const pending=update.isUpdatePending||ready;
 const checking=busy||update.isChecking||update.isDownloading||update.isRestarting;
 async function onCheck(){
  if(checking)return;
  setBusy(true);setMessage('');
  try{
   if(pending){await Updates.reloadAsync();return;}
   const result=await checkAppUpdate(update.isUpdatePending);
   if(result==='ready'){setReady(true);setMessage('Actualización descargada. Pulsa «Aplicar actualización» para abrirla.');}
   else setMessage('No hay otra actualización compatible con esta instalación.');
  }catch{setMessage('No se pudo comprobar o aplicar la actualización. Revisa tu conexión y vuelve a intentarlo.');}
  finally{setBusy(false);}
 }
 return <View style={styles.card}>
  <Text style={styles.title}>Versión y actualizaciones</Text>
  <Text style={styles.copy}>PDR Comercial {Constants.expoConfig?.version??'1.2.0'} · revisión {APP_REVISION}</Text>
  <Text selectable style={styles.copy}>Canal: {Updates.channel??(Platform.OS==='web'?'web':'desarrollo')} · compatibilidad: {Updates.runtimeVersion??'local'}</Text>
  <Text selectable style={styles.copy}>{Updates.updateId?`Actualización: ${Updates.updateId.slice(0,8)}`:'Código incluido en esta versión'}</Text>
  {Updates.isEmergencyLaunch?<Text style={styles.warning}>La app inició en modo de recuperación. Comprueba las actualizaciones antes de cargar archivos.</Text>:null}
  {enabled&&Updates.channel!=='production'?<Text style={styles.warning}>Esta instalación no utiliza el canal de producción. Usa la APK oficial para ver sus cambios.</Text>:null}
  {message?<Text accessibilityRole="alert" style={styles.copy}>{message}</Text>:null}
  {enabled?<AppButton label={pending?'Aplicar actualización':'Buscar actualizaciones'} loading={checking} disabled={checking} variant="secondary" icon="refresh-outline" onPress={()=>{void onCheck();}}/>:<Text style={styles.copy}>{Platform.OS==='web'?'En el navegador, recarga la página para ver la versión publicada.':'Las actualizaciones automáticas no están disponibles en esta instalación.'}</Text>}
 </View>;
}
const styles=StyleSheet.create({card:{backgroundColor:colors.surface,borderRadius:radii.lg,padding:spacing.lg,gap:spacing.sm},title:{color:colors.primary,fontSize:17,fontWeight:'700'},copy:{color:colors.textMuted,fontSize:12,lineHeight:19},warning:{color:colors.danger,fontSize:12,lineHeight:19}});
