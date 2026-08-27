import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.112.3';

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { isValidRut, normalizeRut } from '../_shared/rut.ts';

const genericMessage = 'Si el RUT tiene una cuenta activa, la solicitud quedó registrada.';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Método no permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: 'Servicio no disponible.' }, 503);

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch { /* Respuesta genérica para evitar enumeración. */ }
  const rut = normalizeRut(body.rut);
  if (!isValidRut(rut)) return jsonResponse({ ok: true, message: genericMessage });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile } = await admin.from('profiles').select('id').eq('rut', rut).eq('active', true).maybeSingle();
  if (!profile) return jsonResponse({ ok: true, message: genericMessage });

  const { data: pending } = await admin
    .from('password_reset_requests')
    .select('id,request_count,last_requested_at')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .maybeSingle();
  const now = new Date();
  if (pending) {
    const elapsed = now.getTime() - new Date(pending.last_requested_at).getTime();
    if (elapsed >= 5 * 60 * 1000) {
      await admin.from('password_reset_requests').update({
        request_count: pending.request_count + 1,
        last_requested_at: now.toISOString(),
      }).eq('id', pending.id);
    }
  } else {
    await admin.from('password_reset_requests').insert({ user_id: profile.id });
  }

  return jsonResponse({ ok: true, message: genericMessage });
});
