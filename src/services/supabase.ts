import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { createSecureSessionStorage } from '@/utils/secureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
export const supabaseMediaOrigin = supabaseUrl;
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const serverStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

const nativeStorage = createSecureSessionStorage({
  getItem: key => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  removeItem: key => SecureStore.deleteItemAsync(key),
}, AsyncStorage, () => Crypto.randomUUID());

const authStorage = Platform.OS === 'web'
  ? (typeof window === 'undefined' ? serverStorage : {
    getItem: async (key: string) => { await AsyncStorage.removeItem(key); return window.sessionStorage.getItem(key); },
    setItem: async (key: string, value: string) => { window.sessionStorage.setItem(key, value); await AsyncStorage.removeItem(key); },
    removeItem: async (key: string) => { window.sessionStorage.removeItem(key); await AsyncStorage.removeItem(key); },
  }) : nativeStorage;

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        storage: authStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
