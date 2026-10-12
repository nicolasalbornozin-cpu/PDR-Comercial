import { UserRole } from '@/types';

function titleCase(value: string): string {
  return value.toLocaleLowerCase('es-CL').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('es-CL'));
}

// Dotación always contains two surnames, followed by the given name(s).
// Separately provisioned management/editor accounts retain their original order.
export function displayPersonName(name: string, role?: UserRole): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length <= 2 || ['admin', 'audiovisual', 'commercial_manager', 'sales_director'].includes(role ?? '')) return titleCase(parts.join(' '));
  return titleCase(`${parts[2]} ${parts[0]}`);
}
