import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { Alert, AppState, Platform } from 'react-native';

const MIN_CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function UpdateController() {
  const checking = useRef(false);
  const lastCheckAt = useRef(0);
  const promptedUpdateId = useRef<string | null>(null);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return undefined;

    async function checkForUpdate() {
      const now = Date.now();
      if (checking.current || now - lastCheckAt.current < MIN_CHECK_INTERVAL_MS) return;
      checking.current = true;
      lastCheckAt.current = now;
      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) return;
        const downloaded = await Updates.fetchUpdateAsync();
        const updateId = downloaded.manifest?.id ?? 'downloaded-update';
        if (promptedUpdateId.current === updateId) return;
        promptedUpdateId.current = updateId;
        Alert.alert(
          'Actualización disponible',
          'La nueva versión ya se descargó. Puedes aplicarla ahora sin reinstalar la aplicación.',
          [
            { text: 'Más tarde', style: 'cancel' },
            { text: 'Actualizar ahora', onPress: () => { void Updates.reloadAsync(); } },
          ],
        );
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
