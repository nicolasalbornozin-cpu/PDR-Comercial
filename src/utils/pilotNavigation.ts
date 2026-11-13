import type { UserRole } from '@/types';

export const isPilotMode = process.env.EXPO_PUBLIC_PDR_PILOT === '1';

export function landingTab(role: UserRole) {
  if (role === 'audiovisual') return '/(tabs)/news';
  return isPilotMode ? '/(tabs)/ranking' : '/(tabs)/home';
}
