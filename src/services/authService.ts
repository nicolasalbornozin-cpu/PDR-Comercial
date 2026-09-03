import { currentUser, demoAdminUser } from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { EmploymentStatus, User, UserRole } from '@/types';
import { isEmploymentBlocked } from '@/utils/commercialRules';
import { isValidRut, normalizeRut, rutToInternalEmail } from '@/utils/rut';

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
  birth_date?: string | null;
  employment_status?: EmploymentStatus | null;
  active: boolean;
  must_change_password: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
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
    birthDate: profile.birth_date ?? undefined,
    employmentStatus: profile.employment_status ?? 'active',
    active: profile.active,
    mustChangePassword: profile.must_change_password,
  };
}

async function getProfile(userId: string): Promise<User> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw new Error('Error al comunicar con el servidor');
  const user = mapProfile(data as ProfileRow);
  if (isEmploymentBlocked(user.employmentStatus, user.active)) {
    await supabase.auth.signOut();
    throw new Error('Error al comunicar con el servidor');
  }
  return user;
}

export const authService = {
  mode: authMode,

  async restoreSession(): Promise<User | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return null;
    try {
      return await getProfile(data.session.user.id);
    } catch {
      await supabase.auth.signOut();
      return null;
    }
  },

  async signIn(rut: string, password: string): Promise<User> {
    if (!isValidRut(rut)) throw new Error('Ingresa un RUT válido.');

    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (normalizeRut(rut) === normalizeRut(demoAdminUser.rut)) return demoAdminUser;
      return { ...currentUser, rut: normalizeRut(rut) };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: rutToInternalEmail(rut),
      password,
    });
    if (error) throw new Error('RUT o contraseña incorrectos.');
    return getProfile(data.user.id);
  },

  async requestPasswordReset(rut: string): Promise<void> {
    if (!isValidRut(rut)) throw new Error('Ingresa un RUT válido.');
    if (!supabase) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return;
    }
    const { error } = await supabase.functions.invoke('password-reset-request', {
      body: { rut: normalizeRut(rut) },
    });
    if (error) throw new Error('No fue posible registrar la solicitud. Inténtalo nuevamente.');
  },

  async signOut(): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
};
