export function normalizeRut(value: string): string {
  return value.replace(/[^0-9kK]/g, '').toLowerCase();
}

export function isValidRut(value: string): boolean {
  const rut = normalizeRut(value);
  if (!/^\d{7,8}[0-9k]$/.test(rut)) return false;

  const body = rut.slice(0, -1);
  const suppliedDigit = rut.slice(-1);
  let sum = 0;
  let multiplier = 2;

  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  const expectedDigit = result === 11 ? '0' : result === 10 ? 'k' : String(result);
  return suppliedDigit === expectedDigit;
}

export function formatRut(value: string): string {
  const rut = normalizeRut(value);
  if (rut.length < 2) return rut;
  const body = rut.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${rut.slice(-1).toUpperCase()}`;
}

export function rutToInternalEmail(value: string): string {
  return `${normalizeRut(value)}@pdr.internal`;
}
