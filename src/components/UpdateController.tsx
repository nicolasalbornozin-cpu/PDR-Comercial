import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import {checkAppUpdate} from '@/services/appUpdateService';

const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function UpdateController() {
  const {isUpdatePending,downloadedUpdate}=Updates.useUpdates();
  const checking = useRef(false);
  const lastCheckAt = useRef(0);
  const promptedUpdateId = useRef<string | null>(null);

  useEffect(()=>{
    if(!isUpdatePending||__DEV__||Platform.OS==='web'||!Updates.isEnabled)return;
    const id=downloadedUpdate?.updateId??'downloaded-update';
    if(promptedUpdateId.current===id)return;
    promptedUpdateId.current=id;
    Alert.alert('Actualización disponible','La nueva versión ya se descargó. Puedes aplicarla ahora sin reinstalar la aplicación.',[
      {text:'Más tarde',style:'cancel'},
      {text:'Actualizar ahora',onPress:()=>{void Updates.reloadAsync().catch(()=>Alert.alert('No se pudo actualizar','Inténtalo desde Perfil → Buscar actualizaciones.'));}},
    ]);
  },[isUpdatePending,downloadedUpdate?.updateId]);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return undefined;

    async function checkForUpdate() {
      const now = Date.now();
      if (checking.current || now - lastCheckAt.current < MIN_CHECK_INTERVAL_MS) return;
      checking.current = true;
      lastCheckAt.current = now;
      try {
        await checkAppUpdate();
      } catch {
        // La app continúa con la versión instalada y volverá a comprobar más tarde.
      } finally {
        checking.current = false;
      }
    }

    void checkForUpdate();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
