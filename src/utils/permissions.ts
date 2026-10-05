import { UserRole } from '@/types';

export function canEditNews(role?: UserRole): boolean {
  return role === 'admin' || role === 'audiovisual';
}

export function isNewsOnly(role?: UserRole): boolean {
  return role === 'audiovisual';
}
