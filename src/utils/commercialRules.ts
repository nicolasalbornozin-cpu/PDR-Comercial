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
  if (seniorOpen) return Number(metric.sungUf ?? metric.quarterTotalUf ?? 0);
  return Number(metric.emittedUf ?? metric.eligibleTotalUf ?? 0);
}

function localDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

export function daysWithoutSale(lastSaleDate?: string, now = new Date()): number | null {
  if (!lastSaleDate) return null;
  const last = localDate(lastSaleDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const difference = Math.floor((today.getTime() - last.getTime()) / 86_400_000);
  return Math.max(difference, 0);
}

export function isBirthdayToday(birthDate?: string, now = new Date()): boolean {
  if (!birthDate) return false;
  const birth = localDate(birthDate);
  return birth.getMonth() === now.getMonth() && birth.getDate() === now.getDate();
}
