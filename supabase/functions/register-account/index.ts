import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { registerAccount } from './handler.ts';
import { CONDITIONS_VERSION } from '../_shared/platformConditions.ts';

async function findAuthUserIdByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const existingId = data.users.find((user) => user.email?.toLowerCase() === email)?.id;
    if (existingId) return existingId;
    if (data.users.length < 1000) break;
  }
  return '';
}

async function activateExistingRosterUser(admin: ReturnType<typeof createClient>, rut: string, password: string, role: string) {
  const email = `${rut}@pdr.internal`;
  const existingId = await findAuthUserIdByEmail(admin, email);
  if (!existingId) return { ok: false };

  // A completed or differently-linked profile must never be claimable again.
  const { data: conflictingProfile, error: profileLookupError } = await admin
    .from('profiles').select('id').or(`id.eq.${existingId},rut.eq.${rut}`).limit(1).maybeSingle();
  if (profileLookupError || conflictingProfile) return { ok: false };

  let identity: { name: string; joinDate: string | null; birthDate: string | null; coordinatorId: string | null; managerId: string | null } | null = null;
  if (role === 'audiovisual') {
    const { data, error } = await admin.from('registration_controls').select('audiovisual_name,enabled').eq('rut', rut).maybeSingle();
    if (error || !data?.enabled || !data.audiovisual_name) return { ok: false };
    identity = { name: data.audiovisual_name.trim(), joinDate: null, birthDate: null, coordinatorId: null, managerId: null };
  } else {
    const { data, error } = await admin.from('commercial_workers')
      .select('name,role,active,status,join_date,birth_date,coordinator_id,manager_id').eq('rut', rut).maybeSingle();
    if (error || !data || !data.active || data.status !== 'active' || data.role !== role) return { ok: false };
    identity = { name: data.name, joinDate: data.join_date, birthDate: data.birth_date, coordinatorId: data.coordinator_id, managerId: data.manager_id };
  }

  let supervisorId: string | null = null;
  let salesManagerId: string | null = null;
  const parentIds = [identity.coordinatorId, identity.managerId].filter((value): value is string => Boolean(value));
  if (parentIds.length) {
    const { data: parents, error: parentError } = await admin.from('commercial_workers').select('id,rut').in('id', parentIds);
    if (parentError) return { ok: false };
    const parentRuts = (parents ?? []).map((parent) => parent.rut).filter((value): value is string => Boolean(value));
    if (parentRuts.length) {
      const { data: profiles, error: parentProfileError } = await admin.from('profiles').select('id,rut').in('rut', parentRuts);
      if (parentProfileError) return { ok: false };
      const profileByRut = new Map((profiles ?? []).map((profile) => [profile.rut, profile.id]));
      const coordinatorRut = parents?.find((parent) => parent.id === identity?.coordinatorId)?.rut;
      const managerRut = parents?.find((parent) => parent.id === identity?.managerId)?.rut;
      supervisorId = coordinatorRut ? profileByRut.get(coordinatorRut) ?? null : null;
      salesManagerId = managerRut ? profileByRut.get(managerRut) ?? null : null;
    }
  }

  const { error: authError } = await admin.auth.admin.updateUserById(existingId, {
    password,
    email_confirm: true,
    app_metadata: { role, must_change_password: false, conditions_version:CONDITIONS_VERSION },
  });
  if (authError) return { ok: false };

  const { error: insertError } = await admin.from('profiles').insert({
    id: existingId,
    full_name: identity.name,
    email,
    rut,
    role,
    must_change_password: false,
    join_date: identity.joinDate ?? new Date().toISOString().slice(0, 10),
    supervisor_id: supervisorId,
    sales_manager_id: salesManagerId,
    employment_status: 'active',
    active: true,
  });
  if (insertError) return { ok: false };
  if (role === 'seller') {
    const { error } = await admin.from('executive_metrics').insert({ user_id: existingId });
    if (error) console.error('register-account: executive_metrics_repair_failed');
  }
  return { ok: true };
}

// Separate from admin-users: no list, reset, update, activate or role-change action.
// This new pre-login endpoint accepts the publishable-key client (not a user JWT).
// Authorisation is the service-only roster gate; admin-users is unchanged.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405);
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return jsonResponse({ error: 'Solicitud inválida.' }, 413);
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) return jsonResponse({ error: 'Servicio no disponible.' }, 503);
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 4096) return jsonResponse({ error: 'Solicitud inválida.' }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return jsonResponse({ error: 'Solicitud inválida.' }, 400); }
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const requestId = crypto.randomUUID();
    const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
    const ipHash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
    const result = await registerAccount(body, requestId, ipHash, {
      reserve: async (rut, token, hash) => {
        const { data, error } = await admin.rpc('reserve_roster_registration', { p_rut: rut, p_request_id: token, p_ip_hash: hash });
        if (error) throw new Error('reservation_failed');
        return data;
      },
      create: async (attributes) => {
        // Some Auth versions hide the duplicate-account code. Detect the
        // pre-associated identity before create instead of trusting error text.
        const existingId = await findAuthUserIdByEmail(admin, attributes.email);
        if (existingId) return { ok: false, duplicate: true };
        const { data, error } = await admin.auth.admin.createUser(attributes);
        if (!error && data.user) return { ok: true };
        const appearedAfterCreate = await findAuthUserIdByEmail(admin, attributes.email);
        const reason = error?.code === 'weak_password'
          ? 'weak_password'
          : error?.status === 429
            ? 'rate_limited'
            : 'unknown';
        console.error(`register-account: auth_create_failed:${error?.code ?? 'unknown'}`);
        return { ok: false, duplicate: Boolean(appearedAfterCreate), reason };
      },
      activateExisting: (rut, password, role) => activateExistingRosterUser(admin, rut, password, role),
      release: async (rut, token) => {
        const { error } = await admin.rpc('release_roster_registration', { p_rut: rut, p_request_id: token });
        if (error) console.error('register-account: release_failed');
      },
    });
    return jsonResponse(result.body, result.status);
  } catch {
    // Never log request bodies, passwords, RUTs or Auth errors containing identifiers.
    console.error('register-account: request_failed');
    return jsonResponse({ error: 'No fue posible crear la cuenta. Inténtalo nuevamente.' }, 500);
  }
});
