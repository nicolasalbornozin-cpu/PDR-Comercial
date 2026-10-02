import { internalEmail, isValidRut, normalizeRut } from '../_shared/rut.ts';

export interface RegistrationReservation {
  ok?: boolean;
  error?: string;
  status?: number;
  role?: string;
}

export interface RegistrationDependencies {
  reserve: (rut: string, requestId: string, ipHash: string) => Promise<RegistrationReservation>;
  create: (attributes: { email: string; password: string; email_confirm: true; app_metadata: Record<string, unknown> }) => Promise<{ ok: boolean }>;
  release: (rut: string, requestId: string) => Promise<void>;
}

const passwordMessage = 'Usa 10 o más caracteres con mayúscula, minúscula, número y símbolo (máximo 72 bytes).';
export function strongPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { encodeURIComponent(value); } catch { return false; }
  return value.length >= 10 && new TextEncoder().encode(value).length <= 72
    && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

// Public registration never accepts a name, role, permissions or an existing user ID.
// All authorisation decisions are made by the service-only reservation and Auth trigger.
export async function registerAccount(body: unknown, requestId: string, ipHash: string, dependencies: RegistrationDependencies) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, body: { error: 'Solicitud inválida.' } };
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !['rut', 'password', 'confirmPassword'].includes(key))) return { status: 400, body: { error: 'Solicitud inválida.' } };
  const rut = normalizeRut(input.rut);
  if (!isValidRut(rut)) return { status: 400, body: { error: 'Ingresa un RUT válido.' } };
  if (!strongPassword(input.password)) return { status: 400, body: { error: passwordMessage } };
  if (input.password !== input.confirmPassword) return { status: 400, body: { error: 'Las contraseñas no coinciden.' } };

  const reservation = await dependencies.reserve(rut, requestId, ipHash);
  if (!reservation.ok || !['seller', 'coordinator', 'sales_manager', 'audiovisual'].includes(reservation.role ?? '')) {
    return { status: reservation.status ?? 403, body: { error: reservation.error ?? 'Error al comunicar con el servidor' } };
  }
  try {
    const created = await dependencies.create({
      email: internalEmail(rut), password: input.password, email_confirm: true,
      app_metadata: { role: reservation.role, must_change_password: false, roster_registration: requestId, roster_rut: rut },
    });
    if (!created.ok) return { status: 409, body: { error: 'No fue posible crear la cuenta. Si ya tienes cuenta, inicia sesión o solicita recuperar acceso.' } };
    return { status: 201, body: { ok: true, message: 'Tu cuenta ha sido creada.' } };
  } finally {
    // Token-scoped release cannot remove another attempt or modify an existing account.
    await dependencies.release(rut, requestId);
  }
}
