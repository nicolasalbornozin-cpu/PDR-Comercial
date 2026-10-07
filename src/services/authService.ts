import { currentUser, demoAdminUser } from '@/data/mockData';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { EmploymentStatus, User, UserRole } from '@/types';
import { isEmploymentBlocked } from '@/utils/commercialRules';
import { isValidRut, normalizeRut, rutToInternalEmail } from '@/utils/rut';
import { registrationValidation } from '@/utils/registration';
import { WorkerRow, workerUser } from './individualSheetService';

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
  const access=await supabase.rpc('session_access_allowed');
  if(access.error)throw new Error('No fue posible comprobar el acceso. Inténtalo nuevamente.');
  if(access.data!==true){await supabase.auth.signOut();throw new Error('Error 444');}
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw new Error('Error al comunicar con el servidor');
  const user = mapProfile(data as ProfileRow);
  if (isEmploymentBlocked(user.employmentStatus, user.active)) {
    await supabase.auth.signOut();
    throw new Error('Error 444');
  }
  if (user.role !== 'admin' && user.role !== 'audiovisual') {
    const roster = await supabase.from('commercial_workers').select('*').eq('rut', normalizeRut(user.rut)).maybeSingle();
    if (roster.error || !roster.data || !roster.data.active || roster.data.status !== 'active') {
      await supabase.auth.signOut();
      throw new Error('Error 444');
    }
    // Login UUID and account settings remain intact; role/status come from the authoritative roster.
    const worker = workerUser(roster.data as WorkerRow);
    return {...user, name:worker.name, role:worker.role, employmentStatus:worker.employmentStatus, active:worker.active,
      supervisorId:worker.supervisorId, salesManagerId:worker.salesManagerId, teamId:worker.teamId,
      joinDate:worker.joinDate, birthDate:worker.birthDate};
  }
  return user;
}

export const authService = {
  mode: authMode,

  async register(rut: string, password: string, confirmPassword: string): Promise<void> {
    const validation = registrationValidation(rut, password, confirmPassword);
    if (validation) throw new Error(validation);
    if (!supabase) throw new Error('Crear cuenta requiere conexión con la plataforma.');
    const { data, error } = await supabase.functions.invoke('register-account', {
      body: { rut: normalizeRut(rut), password, confirmPassword },
    });
    if (error) {
      let message = 'No fue posible crear la cuenta. Inténtalo nuevamente.';
      try {
        const response = 'context' in error ? error.context : null;
        if (response && typeof response.json === 'function') {
          const payload = await response.json();
          if (typeof payload.error === 'string') message = payload.error;
        }
      } catch { /* Do not expose transport details or credentials. */ }
      throw new Error(message==='Error al comunicar con el servidor'?'Error 444':message);
    }
    if (!data?.ok) throw new Error(data?.error ?? 'No fue posible crear la cuenta.');
  },

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
