import type { UserRole } from '@/types';

const pilotEnabledByDefault = true;
const pilotOverride = process.env.EXPO_PUBLIC_PDR_PILOT;
const isPilotMode = pilotOverride === undefined ? pilotEnabledByDefault : pilotOverride === '1';

export function hasPilotRestrictions(role: UserRole | undefined): boolean {
  return isPilotMode && role !== 'admin';
}

export function landingTab(role: UserRole) {
  if (role === 'audiovisual') return '/(tabs)/news';
  return hasPilotRestrictions(role) ? '/(tabs)/ranking' : '/(tabs)/home';
}
