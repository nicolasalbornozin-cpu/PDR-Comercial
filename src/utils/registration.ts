import { isValidRut } from './rut';

export function isStrongRegistrationPassword(password: string): boolean {
  try {
    const bytes = encodeURIComponent(password).replace(/%[A-F\d]{2}/gi, 'x').length;
    return password.length >= 10 && bytes <= 72 && /[a-z]/.test(password)
      && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
  } catch {
    return false;
  }
}

export function registrationValidation(rut: string, password: string, confirmation: string): string | null {
  if (!isValidRut(rut)) return 'Ingresa un RUT válido.';
  if (!isStrongRegistrationPassword(password)) return 'Usa 10 o más caracteres con mayúscula, minúscula, número y símbolo (máximo 72 bytes).';
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}
