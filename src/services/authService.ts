import { currentUser } from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { User, UserRole } from '@/types';

export interface RegistrationInput {
  name: string;
  email: string;
  rut: string;
  password: string;
  role: UserRole;
}

const authMode: 'demo' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'demo';

function mapSupabaseUser(user: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  const metadata = user.user_metadata ?? {};
  return {
    ...currentUser,
    id: user.id,
    name: typeof metadata.name === 'string' ? metadata.name : currentUser.name,
    email: user.email ?? currentUser.email,
    rut: typeof metadata.rut === 'string' ? metadata.rut : currentUser.rut,
    role: (typeof metadata.role === 'string' ? metadata.role : currentUser.role) as UserRole,
  };
}

export const authService = {
  mode: authMode,

  async restoreSession(): Promise<User | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user ? mapSupabaseUser(data.session.user) : null;
  },

  async signIn(email: string, password: string): Promise<User> {
    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return { ...currentUser, email: email.trim() || currentUser.email };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return mapSupabaseUser(data.user);
  },

  async signUp(input: RegistrationInput): Promise<User> {
    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      return { ...currentUser, name: input.name, email: input.email, rut: input.rut, role: input.role };
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name, rut: input.rut, role: input.role } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('No fue posible crear la cuenta.');
    return mapSupabaseUser(data.user);
  },

  async signOut(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  },
};
