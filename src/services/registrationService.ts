import { supabase } from './supabase';
import { isValidRut, normalizeRut } from '@/utils/rut';
import { UserRole } from '@/types';

export interface RegistrationEntry {
  rut: string;
  name: string;
  role: UserRole;
  enabled: boolean;
  eligible: boolean;
  registered: boolean;
  audiovisual: boolean;
}

async function saveControl(rut: string, enabled: boolean, audiovisualName: string | null) {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Inicia sesión nuevamente.');
  const { error } = await supabase.from('registration_controls').upsert({
    rut: normalizeRut(rut), enabled, audiovisual_name: audiovisualName, updated_by: user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'rut' });
  if (error) throw new Error('No fue posible actualizar la habilitación del registro.');
}

export const registrationService = {
  async list(): Promise<RegistrationEntry[]> {
    if (!supabase) return [];
    const { data, error } = await supabase.rpc('admin_registration_roster');
    if (error) throw new Error('No fue posible cargar la habilitación de cuentas.');
    return data ?? [];
  },
  async setEnabled(entry: RegistrationEntry, enabled: boolean) {
    await saveControl(entry.rut, enabled, entry.audiovisual ? entry.name : null);
  },
  async enableAudiovisual(name: string, rut: string) {
    if (!isValidRut(rut)) throw new Error('Ingresa un RUT válido.');
    if (name.trim().length < 3 || name.trim().length > 120) throw new Error('Ingresa el nombre completo.');
    await saveControl(rut, true, name.trim());
  },
};
