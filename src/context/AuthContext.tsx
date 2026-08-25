import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';

import { authService, RegistrationInput } from '@/services/authService';
import { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  authMode: 'demo' | 'supabase';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: RegistrationInput) => Promise<void>;
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

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      setUser(await authService.signIn(email, password));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (input: RegistrationInput) => {
    setIsLoading(true);
    try {
      setUser(await authService.signUp(input));
    } finally {
      setIsLoading(false);
    }
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
    () => ({ user, isLoading, authMode: authService.mode, signIn, signUp, signOut }),
    [isLoading, signIn, signOut, signUp, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
