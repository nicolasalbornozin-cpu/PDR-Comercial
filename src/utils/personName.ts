import { UserRole } from '@/types';

function titleCase(value: string): string {
  return value.toLocaleLowerCase('es-CL').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('es-CL'));
}

// Dotación always contains two surnames, followed by the given name(s).
// Separately provisioned management/editor accounts retain their original order.
export function displayPersonName(person: string | {name: string; role?: UserRole; displayName?: string}, role?: UserRole): string {
  // An explicitly confirmed name is already in given-name-first order. Never
  // apply Dotación's surname heuristic a second time or discard middle names.
  const name = typeof person === 'string' ? person : person.name;
  if (typeof person !== 'string') {
    if (person.displayName?.trim()) return person.displayName.trim().replace(/\s+/g, ' ');
    role = person.role ?? role;
  }
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length <= 2 || ['admin', 'audiovisual', 'commercial_manager', 'sales_director'].includes(role ?? '')) return titleCase(parts.join(' '));
  return titleCase(`${parts[2]} ${parts[0]}`);
}
