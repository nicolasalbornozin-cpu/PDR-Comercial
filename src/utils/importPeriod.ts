import type { SheetSource } from '../services/individualSheetParser';

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

export function needsPeriod(source: SheetSource): boolean {
  return ['category', 'senior', 'ranking_monthly'].includes(source);
}

export function importPeriod(source: SheetSource, label: string, start: string, end: string, year: string, today: string) {
  if (source === 'ranking_annual') {
    if (!/^20\d{2}$/.test(year)) throw Error('Indica el año de los resultados (AAAA).');
    return { label: `Ranking anual ${year}`, start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (!needsPeriod(source)) return { label: `Actualización ${today}`, start: today, end: today };
  if (!validDate(start) || !validDate(end) || end < start) throw Error('Indica fechas válidas de inicio y cierre.');

  return { label: label.trim() || `${source === 'category' ? 'Catego' : source === 'senior' ? 'Senior' : 'Ranking mensual'} ${start} – ${end}`, start, end };
}
