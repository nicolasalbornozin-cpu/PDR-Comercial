export function normalizeRut(value: unknown): string {
  return String(value ?? '').replace(/[^0-9kK]/g, '').toLowerCase();
}

export function isValidRut(value: unknown): boolean {
  const rut = normalizeRut(value);
  if (!/^\d{7,8}[0-9k]$/.test(rut)) return false;
  const body = rut.slice(0, -1);
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  const expected = result === 11 ? '0' : result === 10 ? 'k' : String(result);
  return rut.slice(-1) === expected;
}

export function internalEmail(rut: string): string {
  return `${normalizeRut(rut)}@pdr.internal`;
}
