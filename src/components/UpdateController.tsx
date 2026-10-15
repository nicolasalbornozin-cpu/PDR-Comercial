import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {checkAppUpdate} from '@/services/appUpdateService';
import {AppButton} from './Buttons';
import {colors,radii,spacing} from '@/theme';

export function UpdateController() {
  const {isUpdatePending,isRestarting}=Updates.useUpdates();
  const checking = useRef(false);
  const pendingRef=useRef(isUpdatePending);
  pendingRef.current=isUpdatePending;
  const [downloadReady,setDownloadReady]=useState(false);
  const [deferred,setDeferred]=useState(false);
  const [restarting,setRestarting]=useState(false);
  const [error,setError]=useState('');
  const enabled=!__DEV__&&Platform.OS!=='web'&&Updates.isEnabled;
  const pending=isUpdatePending||downloadReady;
  const busy=restarting||isRestarting;

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return undefined;
    let active=true;

    async function checkForUpdate() {
      if (checking.current) return;
      checking.current = true;
      try {
        const result=await checkAppUpdate(pendingRef.current);
        if(active&&result==='ready')setDownloadReady(true);
      } catch {
        // La app continúa con la versión instalada y volverá a comprobar más tarde.
      } finally {
        checking.current = false;
      }
    }

    void checkForUpdate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {setDeferred(false);void checkForUpdate();}
    });
    return () => {active=false;subscription.remove();};
  }, []);

  async function applyUpdate(){
    if(busy)return;
    setRestarting(true);setError('');
    try{await Updates.reloadAsync();}
    catch{setError('No se pudo aplicar la actualización. Pulsa «Actualizar ahora» para volver a intentarlo.');}
    finally{setRestarting(false);}
  }

  if(!enabled||!pending)return null;
  return <>
    <Modal transparent visible={!deferred} animationType="fade" onRequestClose={()=>{if(!busy)setDeferred(true);}}>
      <View style={styles.backdrop}><View accessibilityViewIsModal style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>Actualización disponible</Text>
        <Text style={styles.copy}>Hay una nueva versión de PDR Comercial lista para abrir. Actualiza para ver los últimos cambios. No se borrarán tus datos.</Text>
        {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
        <AppButton label="Actualizar ahora" icon="refresh-outline" loading={busy} disabled={busy} onPress={()=>{void applyUpdate();}}/>
        <AppButton label="Más tarde" variant="ghost" disabled={busy} onPress={()=>setDeferred(true)}/>
      </View></View>
    </Modal>
    {deferred?<View pointerEvents="box-none" style={styles.bannerPosition}><Pressable accessibilityRole="button" accessibilityLabel="Actualización disponible. Actualizar ahora" onPress={()=>setDeferred(false)} style={styles.banner}><Text style={styles.bannerText}>Actualización disponible · Actualizar ahora</Text></Pressable></View>:null}
  </>;
}

const styles=StyleSheet.create({backdrop:{flex:1,backgroundColor:'rgba(0,0,0,0.52)',alignItems:'center',justifyContent:'center',padding:spacing.xl},card:{width:'100%',maxWidth:420,borderRadius:radii.xl,backgroundColor:colors.surface,padding:spacing.xl,gap:spacing.lg},title:{fontSize:23,fontWeight:'700',color:colors.primary},copy:{fontSize:15,lineHeight:23,color:colors.textMuted},error:{fontSize:13,lineHeight:20,color:colors.danger},bannerPosition:{position:'absolute',left:spacing.lg,right:spacing.lg,bottom:94},banner:{minHeight:48,alignItems:'center',justifyContent:'center',backgroundColor:colors.primary,borderRadius:radii.lg,padding:spacing.md},bannerText:{color:colors.surface,fontWeight:'700',fontSize:13,textAlign:'center'}});
