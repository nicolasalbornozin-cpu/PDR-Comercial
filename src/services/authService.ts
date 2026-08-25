import { currentUser } from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { User, UserRole } from '@/types';

export interface RegistrationInput {
  name: string;
  email: string;
  rut: string;
  password: string;
}

const authMode: 'demo' | 'supabase' = isSupabaseConfigured ? 'supabase' : 'demo';

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  rut: string | null;
  role: UserRole;
  avatar_url: string | null;
  team_id: number | null;
  supervisor_id: string | null;
  sales_manager_id: string | null;
  join_date: string;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function mapProfile(profile: ProfileRow): User {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    rut: profile.rut ?? '',
    role: profile.role,
    avatar: profile.avatar_url ?? initials(profile.full_name),
    teamId: profile.team_id?.toString() ?? '',
    supervisorId: profile.supervisor_id ?? '',
    salesManagerId: profile.sales_manager_id ?? '',
    joinDate: profile.join_date,
  };
}

async function getProfile(userId: string): Promise<User> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw new Error(`No fue posible cargar tu perfil: ${error.message}`);
  return mapProfile(data as ProfileRow);
}

export const authService = {
  mode: authMode,

  async restoreSession(): Promise<User | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user ? getProfile(data.session.user.id) : null;
  },

  async signIn(email: string, password: string): Promise<User> {
    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      return { ...currentUser, email: email.trim() || currentUser.email };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return getProfile(data.user.id);
  },

  async signUp(input: RegistrationInput): Promise<User> {
    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 550));
      return { ...currentUser, name: input.name, email: input.email, rut: input.rut };
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { name: input.name, rut: input.rut } },
    });
    if (error) throw error;
    if (!data.user) throw new Error('No fue posible crear la cuenta.');
    if (!data.session) {
      throw new Error('Cuenta creada. Confirma tu correo y luego inicia sesión.');
    }
    return getProfile(data.user.id);
  },

  async signOut(): Promise<void> {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  },
};
