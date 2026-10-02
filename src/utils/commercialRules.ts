import { EmploymentStatus, MetricSnapshot } from '@/types';

export type IndicatorTone = 'green' | 'gold' | 'red';

export function delinquencyTone(rate: number): IndicatorTone {
  if (rate >= 30) return 'red';
  if (rate >= 20) return 'gold';
  return 'green';
}

export function productivityTone(productivity: number): IndicatorTone {
  return productivity < 1 ? 'red' : 'green';
}

export function isEmploymentBlocked(status: EmploymentStatus, active: boolean): boolean {
  return !active || status !== 'active';
}

export function emittedUf(metric?: Partial<MetricSnapshot>): number {
  return Number(metric?.emittedUf ?? 0);
}

export function seniorEligibleUf(metric: Partial<MetricSnapshot> | undefined, seniorOpen: boolean): number {
  if (!metric) return 0;
  if (seniorOpen) return Number(metric.eligibleTotalUf ?? metric.sungUf ?? metric.quarterTotalUf ?? 0);
  return Number(metric.emittedUf ?? metric.eligibleTotalUf ?? 0);
}

function localDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function daysWithoutSale(lastSaleDate?: string, now = new Date()): number | null {
  if (!lastSaleDate || !/^\d{4}-\d{2}-\d{2}$/.test(lastSaleDate)) return null;
  // UTC date-only arithmetic avoids an extra/missing day at Chile's DST change.
  const last = Date.parse(`${lastSaleDate}T00:00:00Z`);
  const today = Date.parse(`${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}T00:00:00Z`);
  if (!Number.isFinite(last) || !Number.isFinite(today)) return null;
  const difference = Math.floor((today - last) / 86_400_000);
  return Math.max(difference, 0);
}

// A calendar month without sales, measured against today's date in Chile.
// Explicit "Sin ventas" in Production also includes workers with no first sale.
export function hasMonthWithoutSale(metric?: Partial<MetricSnapshot>, now = new Date()): boolean {
  if (!metric) return false;
  if (!metric.lastSaleDate) return metric.daysWithoutSaleText?.toLowerCase().includes('sin ventas') ?? false;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const year = part('year'), month = part('month') - 1, day = part('day');
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cutoff = new Date(Date.UTC(year, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(metric.lastSaleDate) && metric.lastSaleDate <= cutoff;
}

export function hasGoalLevel(level?: string): boolean {
  return Boolean(level?.trim() && !/^(no|sin|pendiente|en carrera|faltan|0$)/i.test(level.trim()));
}

export function hasQualifiedSenior(goal?: Partial<MetricSnapshot>): boolean {
  // Q3's Tramos sheet: every base Senior tier needs 10 SMAD and >= 1,350 UF.
  // The extra 13-SMAD/rest/SSFF conditions are bonuses, not loss of the base tier.
  return hasGoalLevel(goal?.seniorLevel) && (goal?.smadCount ?? 0) >= 10 && (goal?.eligibleTotalUf ?? 0) >= 1350;
}

export function latestGoal(data: { snapshots: MetricSnapshot[] }, userId: string, kind: 'category' | 'senior'): MetricSnapshot | undefined {
  return data.snapshots.filter(s => s.userId === userId && s.kind === kind)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.publishedAt.localeCompare(a.publishedAt))[0];
}

export function isBirthdayToday(birthDate?: string, now = new Date()): boolean {
  if (!birthDate) return false;
  const birth = localDate(birthDate);
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}
