import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.112.3';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { internalEmail, isValidRut, normalizeRut } from '../_shared/rut.ts';

const allowedRoles = new Set(['seller', 'coordinator', 'sales_manager', 'admin']);

function hasStrongPassword(password: unknown): password is string {
  return typeof password === 'string'
    && password.length >= 10
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

async function profileIdForRut(admin: SupabaseClient, rutValue: unknown): Promise<string | null> {
  const rut = normalizeRut(rutValue);
  if (!rut) return null;
  const { data } = await admin.from('profiles').select('id').eq('rut', rut).maybeSingle();
  return data?.id ?? null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !authorization) {
    return jsonResponse({ error: 'No autorizado.' }, 401);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return jsonResponse({ error: 'Sesión no válida.' }, 401);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('id,role,active')
    .eq('id', authData.user.id)
    .maybeSingle();
  if (!callerProfile?.active || callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Esta operación requiere un perfil administrador.' }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Solicitud inválida.' }, 400);
  }

  try {
    if (body.action === 'list') {
      const [usersResult, resetsResult] = await Promise.all([
        admin.from('profiles').select('id,full_name,rut,role,active,team_id,supervisor_id,sales_manager_id,created_at').order('full_name'),
        admin.from('password_reset_requests').select('id,user_id,status,request_count,requested_at,last_requested_at').eq('status', 'pending').order('last_requested_at', { ascending: false }),
      ]);
      if (usersResult.error) throw usersResult.error;
      if (resetsResult.error) throw resetsResult.error;
      return jsonResponse({
        users: (usersResult.data ?? []).map((user) => ({
          id: user.id,
          name: user.full_name,
          rut: user.rut ?? '',
          role: user.role,
          active: user.active,
          teamId: user.team_id?.toString() ?? '',
          supervisorId: user.supervisor_id ?? '',
          salesManagerId: user.sales_manager_id ?? '',
          createdAt: user.created_at,
        })),
        resetRequests: (resetsResult.data ?? []).map((reset) => ({
          id: reset.id,
          userId: reset.user_id,
          status: reset.status,
          requestCount: reset.request_count,
          requestedAt: reset.requested_at,
          lastRequestedAt: reset.last_requested_at,
        })),
      });
    }

    if (body.action === 'create') {
      const rut = normalizeRut(body.rut);
      const name = String(body.name ?? '').trim();
      const role = String(body.role ?? 'seller');
      if (!isValidRut(rut)) return jsonResponse({ error: 'El RUT no es válido.' }, 400);
      if (name.length < 3 || name.length > 120) return jsonResponse({ error: 'Ingresa el nombre completo.' }, 400);
      if (!allowedRoles.has(role)) return jsonResponse({ error: 'El rol no es válido.' }, 400);
      if (!hasStrongPassword(body.password)) {
        return jsonResponse({ error: 'La contraseña debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' }, 400);
      }

      const supervisorId = await profileIdForRut(admin, body.supervisorRut);
      const salesManagerId = await profileIdForRut(admin, body.salesManagerRut);
      if (body.supervisorRut && !supervisorId) return jsonResponse({ error: 'No existe el RUT del coordinador indicado.' }, 400);
      if (body.salesManagerRut && !salesManagerId) return jsonResponse({ error: 'No existe el RUT del jefe de ventas indicado.' }, 400);

      let teamId: number | null = null;
      const teamName = String(body.teamName ?? '').trim();
      if (teamName) {
        const { data: existingTeam } = await admin.from('teams').select('id').eq('name', teamName).maybeSingle();
        if (existingTeam) teamId = existingTeam.id;
        else {
          const { data: createdTeam, error: teamError } = await admin.from('teams').insert({ name: teamName, sales_manager_id: salesManagerId }).select('id').single();
          if (teamError) throw teamError;
          teamId = createdTeam.id;
        }
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: internalEmail(rut),
        password: body.password,
        email_confirm: true,
        user_metadata: { name, rut },
        app_metadata: { role, must_change_password: false },
      });
      if (createError || !created.user) {
        return jsonResponse({ error: createError?.message.includes('already') ? 'Ya existe una cuenta para ese RUT.' : createError?.message ?? 'No fue posible crear la cuenta.' }, 400);
      }

      const { error: profileError } = await admin.from('profiles').update({
        full_name: name,
        rut,
        role,
        team_id: teamId,
        supervisor_id: supervisorId,
        sales_manager_id: salesManagerId,
        active: true,
      }).eq('id', created.user.id);
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }

      if (role === 'coordinator' && teamId) {
        await admin.from('teams').update({ coordinator_id: created.user.id, sales_manager_id: salesManagerId }).eq('id', teamId);
      }
      await admin.from('admin_audit_logs').insert({
        admin_id: callerProfile.id,
        action: 'user_created',
        target_user_id: created.user.id,
        details: { role, teamId },
      });
      return jsonResponse({ ok: true, userId: created.user.id });
    }

    if (body.action === 'resetPassword') {
      const userId = String(body.userId ?? '');
      if (!hasStrongPassword(body.password)) {
        return jsonResponse({ error: 'La contraseña debe tener 10 caracteres e incluir mayúscula, minúscula, número y símbolo.' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
      if (error) throw error;
      await admin.from('profiles').update({ must_change_password: false }).eq('id', userId);
      await admin.from('password_reset_requests').update({
        status: 'resolved',
        handled_by: callerProfile.id,
        handled_at: new Date().toISOString(),
      }).eq('user_id', userId).eq('status', 'pending');
      await admin.from('admin_audit_logs').insert({ admin_id: callerProfile.id, action: 'password_reset', target_user_id: userId });
      return jsonResponse({ ok: true });
    }

    if (body.action === 'setActive') {
      const userId = String(body.userId ?? '');
      const active = body.active === true;
      if (userId === callerProfile.id && !active) return jsonResponse({ error: 'No puedes desactivar tu propia cuenta.' }, 400);
      const { error } = await admin.from('profiles').update({ active }).eq('id', userId);
      if (error) throw error;
      await admin.from('admin_audit_logs').insert({ admin_id: callerProfile.id, action: active ? 'user_activated' : 'user_deactivated', target_user_id: userId });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Acción no reconocida.' }, 400);
  } catch (error) {
    console.error('admin-users', error);
    return jsonResponse({ error: 'La operación no pudo completarse.' }, 500);
  }
});
