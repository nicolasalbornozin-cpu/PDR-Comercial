import type { WorkBook } from 'xlsx';
import { isValidRut, normalizeRut } from '../utils/rut';

export const sheetSources = {
  category: { label: 'Catego', sheet: 'Carga Catego' },
  production_sellers: { label: 'Producción · vendedores', sheet: 'Resumen Vendedores' },
  production_coordinators: { label: 'Producción · coordinadores', sheet: 'Resumen Coordinadores' },
  senior: { label: 'Senior y anulaciones', sheet: 'CARGA Senior' },
  titanes: { label: 'Mora TITANES · Manuel Olmedo', sheet: 'Carga Titanes' },
  rbh: { label: 'Mora RBH · Rodolfo', sheet: 'Carga RBH' },
  msc: { label: 'Mora MSC · Mauricio', sheet: 'Carga MSC' },
  sauce: { label: 'Riesgo Sauce', sheet: 'Ranking Sauce Riesgo' },
  ranking_monthly: { label: 'Ranking mensual · emitidas', sheet: 'Ranking mensual' },
  ranking_annual: { label: 'Ranking anual · emitidas', sheet: 'Ranking anual' },
} as const;
export type SheetSource = keyof typeof sheetSources;
export type SheetMetrics = Record<string, string | number>;
export interface SheetRecord { rut?: string; name: string; role: 'seller' | 'coordinator'; values: SheetMetrics; row: number }
export interface SheetImport { source: SheetSource; sheet: string; records: SheetRecord[]; errors: string[]; warnings: string[]; rules: { label: string; uf: number; smad: number; prize: number }[] }
export function searchName(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\([^)]*\)/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function text(value: unknown): string { return String(value ?? '').trim().replace(/\s+/g, ' '); }
function number(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const s = text(value).replace(/\s/g, '').replace(/UF|\$|%/gi, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return undefined;
  const n = Number(s.includes(',') && s.includes('.') ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')) : s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}
function date(value: unknown): string | undefined {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'number' && value > 20000 && value < 100000) return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString().slice(0, 10);
  const s = text(value); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return undefined;
}

// Only aggregate seller results are published. Category may also derive an emitted/pending
// split from the workbook's CANTO + TRIO companions; no operation or client rows are uploaded.
export function parseIndividualSheet(book: WorkBook, source: SheetSource): SheetImport {
  const sheet = book.SheetNames.find(n => searchName(n) === searchName(sheetSources[source].sheet));
  const result: SheetImport = { source, sheet: sheet ?? sheetSources[source].sheet, records: [], errors: [], warnings: [], rules: [] };
  if (!sheet) { result.errors.push(`Falta la hoja «${result.sheet}».`); return result; }
  const ws = book.Sheets[sheet];
  const cells = Object.entries(ws).filter(([a]) => /^[A-Z]+\d+$/.test(a));
  const maxRow = cells.reduce((max, [a]) => Math.max(max, Number(a.replace(/\D/g, ''))), 1);
  if (maxRow > 100000) { result.errors.push('La hoja excede 100.000 filas.'); return result; }
  const get = (c: string, r: number, optional = false): unknown => {
    const cell = ws[`${c}${r}`];
    if (cell?.t === 'e') { (optional ? result.warnings : result.errors).push(`${sheet}!${c}${r}: error de Excel; dato pendiente, no se convierte en cero.`); return undefined; }
    if (cell?.f && cell.v === undefined) result.errors.push(`${sheet}!${c}${r}: fórmula sin resultado guardado.`);
    return cell?.v;
  };
  const numeric = (values: SheetMetrics, key: string, col: string, r: number, required = true) => {
    const raw = get(col, r, !required); const n = number(raw);
    if (n === undefined) { if (required) result.errors.push(`${sheet}!${col}${r}: falta un número válido para ${key}.`); }
    else values[key] = n;
  };
  const header = (col: string, expected: string[]) => {
    for (let r = 1; r <= 30; r++) if (expected.includes(searchName(ws[`${col}${r}`]?.v))) return r;
    result.errors.push(`No se reconoce el encabezado ${col} de «${sheet}». Conserva las columnas originales.`); return -1;
  };
  const debt = ['titanes', 'rbh', 'msc'].includes(source);
  const first = source === 'category' ? header('G', ['ejecutivo']) : source === 'senior' ? header('D', ['rut vendedor'])
    : source === 'production_sellers' ? header('A', ['rut vendedor']) : source === 'production_coordinators' ? header('A', ['coordinador'])
    : debt ? header('L', ['rut']) : source === 'sauce' ? header('A', ['rut agente']) : header('A', ['puesto']);
  if (first < 0) return result;
  const seen = new Set<string>(); const aggregated = new Map<string, SheetRecord>(); const contracts = new Map<string, string>();
  const categoryEmission = new Map<string, { emittedUf: number; notEmittedUf: number }>();
  if (source === 'category') {
    const cantoName = book.SheetNames.find(n => searchName(n) === 'canto');
    const trioName = book.SheetNames.find(n => ['base trio', 'trio'].includes(searchName(n)));
    const canto = cantoName ? book.Sheets[cantoName] : undefined;
    const trio = trioName ? book.Sheets[trioName] : undefined;
    if (canto && trio) {
      const trioLast = Object.keys(trio).filter(a => /^[A-Z]+\d+$/.test(a)).reduce((max, a) => Math.max(max, Number(a.replace(/\D/g, ''))), 1);
      const cantoLast = Object.keys(canto).filter(a => /^[A-Z]+\d+$/.test(a)).reduce((max, a) => Math.max(max, Number(a.replace(/\D/g, ''))), 1);
      const emittedByOperation = new Map<string, boolean>();
      for (let r = 2; r <= trioLast; r++) {
        const operation = text(trio[`B${r}`]?.v);
        if (operation) emittedByOperation.set(operation, searchName(trio[`P${r}`]?.v) === 'emitida');
      }
      for (let r = 2; r <= cantoLast; r++) {
        const seller = searchName(canto[`E${r}`]?.v);
        const uf = number(canto[`F${r}`]?.v);
        const operation = text(canto[`I${r}`]?.v);
        if (!seller || uf === undefined || uf < 0 || !operation) continue;
        const current = categoryEmission.get(seller) ?? { emittedUf: 0, notEmittedUf: 0 };
        if (emittedByOperation.get(operation)) current.emittedUf += uf;
        else current.notEmittedUf += uf;
        categoryEmission.set(seller, current);
      }
      result.warnings.push('Catego: emitido y sin emitir se agregan por vendedor cruzando Nº operación de CANTO con ESTADO de Base TRIO. No se suben filas de clientes ni contratos.');
    } else {
      result.warnings.push('Catego no incluye CANTO y Base TRIO; el desglose emitido/sin emitir quedará sin dato.');
    }
  }
  for (let r = first + 1; r <= maxRow; r++) {
    const nameCol = source === 'category' ? 'G' : source === 'senior' ? 'C' : source === 'production_coordinators' ? 'A' : debt ? 'M' : source.startsWith('ranking_') ? 'C' : 'B';
    const name = text(get(nameCol, r, true));
    if (!name || /^(total|no vigente|\*|0$)/i.test(name)) continue;
    const rutCol = source === 'category' || source === 'production_coordinators' ? null : source === 'senior' ? 'D' : debt ? 'L' : source.startsWith('ranking_') ? 'B' : 'A';
    const rut = rutCol ? normalizeRut(text(get(rutCol, r))) : undefined;
    if (rutCol && (!rut || !isValidRut(rut))) { result.errors.push(`${sheet}, fila ${r}: RUT inválido de ${name}.`); continue; }
    const values: SheetMetrics = {};
    if (source === 'category') {
      numeric(values, 'smad', 'H', r); numeric(values, 'uf', 'I', r); numeric(values, 'prize', 'K', r);
      values.level = text(get('J', r)); values.remaining = text(get('L', r));
      const emission = categoryEmission.get(searchName(name));
      if (emission) { values.emittedUf = emission.emittedUf; values.notEmittedUf = emission.notEmittedUf; }
    } else if (source === 'senior') {
      const reference = /Resumen Senior'?!\$?([A-Z]+)\$?(\d+)/i.exec(ws[`M${r}`]?.f ?? '');
      const summary = book.Sheets['Resumen Senior'];
      if (reference && summary && searchName(summary[`${reference[1]}3`]?.v) !== 'anulacion') result.errors.push(`${sheet}!M${r}: Anulaciones no apunta a la columna titulada Anulación de Resumen Senior.`);
      numeric(values, 'smad', 'E', r); numeric(values, 'rest', 'F', r); numeric(values, 'ssff', 'G', r);
      numeric(values, 'tenureMonths', 'H', r, false); numeric(values, 'uf', 'I', r); numeric(values, 'cancellationUf', 'M', r);
      values.level = text(get('J', r, true)) || 'Pendiente de corregir en Excel'; values.potentialLevel = text(get('K', r)); values.remaining = text(get('L', r));
    } else if (source === 'production_sellers' || source === 'production_coordinators') {
      const coord = source === 'production_coordinators';
      numeric(values, 'uf', coord ? 'C' : 'J', r); numeric(values, 'businesses', coord ? 'D' : 'K', r);
      numeric(values, 'productivity', coord ? 'G' : 'P', r);
      if (coord) { numeric(values, 'headcount', 'F', r); numeric(values, 'teamProduction', 'O', r); }
      else values.employmentStatus = text(get('F', r));
      const last = date(get(coord ? 'I' : 'L', r, true)); if (last) values.lastSaleDate = last;
      const days = get(coord ? 'K' : 'N', r); if (number(days) !== undefined) values.daysWithoutSale = number(days)!;
      else if (text(days)) values.daysWithoutSaleText = text(days);
    } else if (debt) {
      const contract = text(get('B', r));
      if (!contract) { result.errors.push(`${sheet}, fila ${r}: falta contrato para evitar duplicados.`); continue; }
      const fingerprint = JSON.stringify(['E','F','G','J','K','L'].map(c => get(c,r)));
      if (contracts.has(contract)) { if (contracts.get(contract) !== fingerprint) result.errors.push(`${sheet}, fila ${r}: contrato repetido con valores distintos.`); continue; }
      contracts.set(contract, fingerprint);
      const status = searchName(get('G', r));
      const a = aggregated.get(rut!) ?? { rut, name, role: 'seller' as const, row: r, values: { debtSales: 0, debtUf: 0, debtInstallments: 0, debtUf08: 0, debtSales08: 0 } };
      if (status === 'mora') {
        const uf = number(get('E', r)); if (uf === undefined || uf < 0) { result.errors.push(`${sheet}!E${r}: UF inválida.`); continue; }
        a.values.debtSales = Number(a.values.debtSales) + 1; a.values.debtUf = Number(a.values.debtUf) + uf;
        if (/^0\s*[-–]\s*8\s*%?$/.test(text(get('F',r)))) {
          a.values.debtUf08 = Number(a.values.debtUf08) + uf; a.values.debtSales08 = Number(a.values.debtSales08) + 1;
        } else {
          const q = number(get('F',r)); if (q === undefined || q < 0 || !Number.isInteger(q)) result.errors.push(`${sheet}!F${r}: cuotas morosas inválidas.`);
          else a.values.debtInstallments = Number(a.values.debtInstallments) + q;
        }
      }
      aggregated.set(rut!, a); continue;
    } else if (source === 'sauce') {
      const column = searchName(ws[`G${first}`]?.v).startsWith('actualizado') ? 'G' : 'D';
      numeric(values, 'risk', column, r, column === 'D');
      if (typeof values.risk === 'number' && /%/.test(ws[`${column}${r}`]?.z ?? '') && values.risk <= 1) values.risk *= 100;
      if (Number(values.risk) < 0 || Number(values.risk) > 100) result.errors.push(`${sheet}!${column}${r}: riesgo fuera de 0–100%.`);
    } else {
      numeric(values, 'position', 'A', r); numeric(values, 'emittedUf', 'F', r); numeric(values, 'businesses', 'G', r);
    }
    const id = rut ?? searchName(name);
    if (seen.has(id)) { result.errors.push(`${sheet}, fila ${r}: trabajador repetido.`); continue; }
    seen.add(id); result.records.push({ rut, name, role: source === 'production_coordinators' ? 'coordinator' : 'seller', values, row: r });
  }
  if (debt) {
    result.records = [...aggregated.values()];
    result.warnings.push('Se agrupa por RUT. No se suben contratos, compromisos ni fechas de clientes. UF 0–8% es un único total; no se inventan cuotas para ese grupo.');
  }
  if (source === 'category') {
    for (let r = 1; r < first; r++) {
      const uf = number(get('C',r)), smad = number(get('E',r)), prize = number(get('F',r));
      if (uf !== undefined && smad !== undefined && prize !== undefined) result.rules.push({ label: text(get('B',r)).replace(/^[^A-Za-zÁÉÍÓÚÑ]+/u,''), uf, smad, prize });
    }
  }
  if (!result.records.length) result.errors.push('No hay trabajadores válidos en la hoja seleccionada.');
  if (source === 'sauce' && searchName(ws[`G${first}`]?.v).startsWith('actualizado')) result.warnings.push(`Riesgo tomado de G: ${text(ws[`G${first}`]?.v)}. Los errores quedan pendientes; no se reemplazan por el porcentaje antiguo de D.`);
  if (source.startsWith('production_')) result.warnings.push('Se conserva la productividad calculada en el Excel. Sus UF históricas no se convierten en ventas emitidas anuales.');
  return result;
}
