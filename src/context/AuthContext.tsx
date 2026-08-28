import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { authService } from '@/services/authService';
import { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  authenticatedUser: User | null;
  isLoading: boolean;
  isPreviewing: boolean;
  authMode: 'demo' | 'supabase';
  signIn: (rut: string, password: string) => Promise<void>;
  requestPasswordReset: (rut: string) => Promise<void>;
  signOut: () => Promise<void>;
  startPreview: (previewUser: User) => void;
  stopPreview: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [authenticatedUser, setAuthenticatedUser] = useState<User | null>(null);
  const [previewUser, setPreviewUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    authService
      .restoreSession()
      .then((restoredUser) => {
        if (mounted) setAuthenticatedUser(restoredUser);
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
      setPreviewUser(null);
      setAuthenticatedUser(await authService.signIn(rut, password));
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
      setPreviewUser(null);
      setAuthenticatedUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const startPreview = useCallback((targetUser: User) => {
    if (authenticatedUser?.role !== 'admin') throw new Error('Solo el administrador puede iniciar una vista previa.');
    if (targetUser.role === 'admin') throw new Error('Selecciona un perfil operativo para la vista previa.');
    setPreviewUser(targetUser);
  }, [authenticatedUser]);

  const stopPreview = useCallback(() => {
    setPreviewUser(null);
  }, []);

  const user = previewUser ?? authenticatedUser;
  const isPreviewing = Boolean(previewUser && authenticatedUser?.role === 'admin');

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authenticatedUser,
      isLoading,
      isPreviewing,
      authMode: authService.mode,
      signIn,
      requestPasswordReset,
      signOut,
      startPreview,
      stopPreview,
    }),
    [authenticatedUser, isLoading, isPreviewing, requestPasswordReset, signIn, signOut, startPreview, stopPreview, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
