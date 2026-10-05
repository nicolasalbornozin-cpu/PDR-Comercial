import { UserRole } from '@/types';

function titleCase(value: string): string {
  return value.toLocaleLowerCase('es-CL').replace(/(^|[\s-])\p{L}/gu, letter => letter.toLocaleUpperCase('es-CL'));
}

// Dotación stores surnames first. Three-word entries such as FONTALVO FAIRUZ
// MARINA have one surname; separately provisioned management/editor names do not.
export function displayPersonName(name: string, role?: UserRole): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length <= 2 || ['admin', 'audiovisual', 'commercial_manager', 'sales_director'].includes(role ?? '')) return titleCase(parts.join(' '));
  return titleCase(`${parts[parts.length >= 4 ? 2 : 1]} ${parts[0]}`);
}
