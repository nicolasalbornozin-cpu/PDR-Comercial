import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { authService } from '@/services/authService';
import { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  authMode: 'demo' | 'supabase';
  signIn: (rut: string, password: string) => Promise<void>;
  requestPasswordReset: (rut: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    authService
      .restoreSession()
      .then((restoredUser) => {
        if (mounted) setUser(restoredUser);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (rut: string, password: string) => {
    setIsLoading(true);
    try {
      setUser(await authService.signIn(rut, password));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (rut: string) => {
    await authService.requestPasswordReset(rut);
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.signOut();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, authMode: authService.mode, signIn, requestPasswordReset, signOut }),
    [isLoading, requestPasswordReset, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
