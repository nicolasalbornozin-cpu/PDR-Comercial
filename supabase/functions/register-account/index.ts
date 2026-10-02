import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { registerAccount } from './handler.ts';

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
        const { data, error } = await admin.auth.admin.createUser(attributes);
        return { ok: !error && Boolean(data.user) };
      },
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
