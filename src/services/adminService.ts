import { CsvParseResult, ParsedSnapshotRow } from '@/services/csvImportService';
import { demoManagedUsers } from '@/data/mockData';
import { supabase } from '@/services/supabase';
import { AdminUser, PasswordResetRequest, SnapshotKind, UserRole } from '@/types';
import { normalizeRut } from '@/utils/rut';

export interface CreateManagedUserInput {
  name: string;
  rut: string;
  password: string;
  role: UserRole;
  teamName?: string;
  supervisorRut?: string;
  salesManagerRut?: string;
}

export interface ImportSnapshotInput {
  kind: SnapshotKind;
  periodStart: string;
  periodEnd: string;
  sourceName: string;
  parsed: CsvParseResult;
  adminId: string;
}

interface AdminListResponse {
  users: AdminUser[];
  resetRequests: PasswordResetRequest[];
}

async function invokeAdmin<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw new Error(error.message || 'La operación administrativa falló.');
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const adminService = {
  async list(): Promise<AdminListResponse> {
    if (!supabase) return { users: demoManagedUsers, resetRequests: [] };
    return invokeAdmin<AdminListResponse>({ action: 'list' });
  },

  async createUser(input: CreateManagedUserInput): Promise<void> {
    await invokeAdmin({
      action: 'create',
      name: input.name.trim(),
      rut: normalizeRut(input.rut),
      password: input.password,
      role: input.role,
      teamName: input.teamName?.trim() || null,
      supervisorRut: input.supervisorRut ? normalizeRut(input.supervisorRut) : null,
      salesManagerRut: input.salesManagerRut ? normalizeRut(input.salesManagerRut) : null,
    });
  },

  async resetPassword(userId: string, password: string): Promise<void> {
    await invokeAdmin({ action: 'resetPassword', userId, password });
  },

  async setActive(userId: string, active: boolean): Promise<void> {
    await invokeAdmin({ action: 'setActive', userId, active });
  },

  async importSnapshot(input: ImportSnapshotInput): Promise<number> {
    if (!supabase) throw new Error('Supabase no está configurado.');
    if (input.parsed.errors.length) throw new Error('Corrige los errores del archivo antes de publicarlo.');
    if (!input.parsed.rows.length) throw new Error('No hay filas válidas para publicar.');

    const ruts = [...new Set(input.parsed.rows.map((row) => row.rut).filter((rut): rut is string => Boolean(rut)))];
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id,rut,full_name,active')
      .eq('active', true);
    if (profilesError) throw new Error(`No fue posible validar los RUT: ${profilesError.message}`);

    const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const profileByRut = new Map((profiles ?? []).map((profile) => [profile.rut, profile.id]));
    const missingRuts = ruts.filter((rut) => !profileByRut.has(rut));
    if (missingRuts.length) throw new Error(`RUT sin cuenta activa: ${missingRuts.join(', ')}.`);

    const idsByName = new Map<string, string[]>();
    (profiles ?? []).forEach((profile) => {
      const key = normalizeName(profile.full_name);
      idsByName.set(key, [...(idsByName.get(key) ?? []), profile.id]);
    });
    const resolvedRows: (ParsedSnapshotRow & { userId?: string; nameMatches: number })[] = input.parsed.rows.map((row) => {
      if (row.rut) return { ...row, userId: profileByRut.get(row.rut), nameMatches: 0 };
      const matches = row.name ? idsByName.get(normalizeName(row.name)) ?? [] : [];
      return { ...row, userId: matches.length === 1 ? matches[0] : undefined, nameMatches: matches.length };
    });
    const unresolved = resolvedRows.filter((row) => !row.userId);
    if (unresolved.length) {
      const details = unresolved.slice(0, 8).map((row) => row.nameMatches && row.nameMatches > 1
        ? `${row.name} (nombre repetido)`
        : row.name ?? `fila ${row.rowNumber}`);
      throw new Error(`Trabajadores sin coincidencia única: ${details.join(', ')}. Crea/corrige sus cuentas o agrega el RUT al Excel.`);
    }
    const duplicateIds = resolvedRows.map((row) => row.userId).filter((id, index, all) => all.indexOf(id) !== index);
    if (duplicateIds.length) throw new Error('El archivo contiene más de una fila para el mismo trabajador. Usa una sola hoja resumen.');

    const { data: batch, error: batchError } = await supabase
      .from('upload_batches')
      .insert({
        kind: input.kind,
        period_start: input.periodStart,
        period_end: input.periodEnd,
        source_name: input.sourceName.slice(0, 180),
        uploaded_by: input.adminId,
        validation_summary: { validRows: input.parsed.rows.length, rejectedRows: 0 },
      })
      .select('id')
      .single();
    if (batchError) throw new Error(`No fue posible crear el lote: ${batchError.message}`);

    const payload = resolvedRows.map((row) => ({
      batch_id: batch.id,
      user_id: row.userId,
      ...row.values,
    }));

    const { error: rowsError } = await supabase.from('metric_snapshots').insert(payload);
    if (rowsError) {
      await supabase.from('upload_batches').update({ status: 'failed', validation_summary: { error: rowsError.message } }).eq('id', batch.id);
      throw new Error(`No fue posible guardar las filas: ${rowsError.message}`);
    }

    const { error: publishError } = await supabase.rpc('publish_upload_batch', { target_batch_id: batch.id });
    if (publishError) {
      await supabase.from('upload_batches').update({ status: 'failed', validation_summary: { error: publishError.message } }).eq('id', batch.id);
      throw new Error(`No fue posible publicar la foto: ${publishError.message}`);
    }

    return payload.length;
  },
};
