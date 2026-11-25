import type { UserRole } from '@/types';

const pilotEnabledByDefault = true;
const pilotOverride = process.env.EXPO_PUBLIC_PDR_PILOT;
const isPilotMode = pilotOverride === undefined ? pilotEnabledByDefault : pilotOverride === '1';

export function hasPilotRestrictions(role: UserRole | undefined, isPreviewing = false): boolean {
  return isPilotMode && role !== 'admin' && !isPreviewing;
}

export function landingTab(role: UserRole, isPreviewing = false) {
  if (role === 'audiovisual') return '/(tabs)/news';
  return hasPilotRestrictions(role, isPreviewing) ? '/(tabs)/ranking' : '/(tabs)/home';
}
