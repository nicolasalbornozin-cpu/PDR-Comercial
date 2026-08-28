import type { WorkBook } from 'xlsx';

import { CsvParseResult, ParsedSnapshotRow, SnapshotDatabaseColumn } from '@/services/csvImportService';
import { SnapshotKind } from '@/types';
import { isValidRut, normalizeRut } from '@/utils/rut';

type IdentifierColumn = 'rut' | 'name';
type MappedColumn = IdentifierColumn | SnapshotDatabaseColumn;
type CellValue = string | number | boolean | Date | null | undefined;

export interface SnapshotWorkbook {
  workbook: WorkBook;
  safeSheets: string[];
  recommendedSheet: string;
}

const MAX_WORKBOOK_BYTES = 20 * 1024 * 1024;
let spreadsheetUtils: typeof import('xlsx')['utils'] | null = null;
const textColumns = new Set<SnapshotDatabaseColumn>(['category', 'senior_level']);
const nonNegativeColumns = new Set<SnapshotDatabaseColumn>([
  'business_count',
  'smad_count',
  'rest_count',
  'ssff_count',
  'delinquent_clients_count',
  'delinquency_rate',
  'salesforce_records',
  'tenure_months',
  'ranking_position',
  'estimated_prize_clp',
]);
const forbiddenHeaderTokens = [
  'rut_cliente',
  'nombre_cliente',
  'telefono_cliente',
  'correo_cliente',
  'direccion_cliente',
  'nro_contrato',
  'numero_contrato',
  'contrato',
  'folio',
  'ubicacion',
  'cuota',
  'total_pagado',
  'fecha_pago',
];

const preferredSheetNames: Record<SnapshotKind, string[]> = {
  commercial: ['avance comercial', 'resumen', 'ranking ddp'],
  senior: ['resumen senior'],
  category: ['categorizacion'],
  delinquency: ['sauce riesgo', '% riesgo', 'sauce'],
  salesforce: ['salesforce', 'resumen salesforce'],
  ranking: ['ranking ddp', 'ranking'],
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseNumeric(value: CellValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean' || value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/\s/g, '').replace(/[$%UFuf]/g, '');
  if (!cleaned || cleaned === '-') return null;
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapHeader(header: unknown, kind: SnapshotKind): MappedColumn | undefined {
  const normalized = normalizeText(header);
  const identifiers: Record<string, IdentifierColumn> = {
    rut: 'rut',
    rut_trabajador: 'rut',
    rut_vendedor: 'rut',
    rut_agente: 'rut',
    nombre: 'name',
    nombre_trabajador: 'name',
    nombre_vendedor: 'name',
    nombre_agente: 'name',
    vendedor: 'name',
    ejecutivo: 'name',
  };
  if (identifiers[normalized]) return identifiers[normalized];

  const common: Record<string, SnapshotDatabaseColumn> = {
    produccion: 'production_uf',
    produccion_uf: 'production_uf',
    monto_vendido_uf: 'production_uf',
    uf: 'production_uf',
    uf_bruta: 'gross_uf',
    produccion_bruta: 'gross_uf',
    produccion_bruta_uf: 'gross_uf',
    sepultura: 'sepultura_uf',
    sepultura_uf: 'sepultura_uf',
    ssff_uf: 'ssff_uf',
    cinerario: 'cinerario_uf',
    cinerario_uf: 'cinerario_uf',
    cin: 'cinerario_uf',
    ssaa: 'ssaa_uf',
    ssaa_uf: 'ssaa_uf',
    emitido: 'emitted_uf',
    emitido_uf: 'emitted_uf',
    no_emitido: 'not_emitted_uf',
    no_emitido_uf: 'not_emitted_uf',
    no_subido: 'not_uploaded_uf',
    no_subido_uf: 'not_uploaded_uf',
    cantidad_negocios: 'business_count',
    negocios: 'business_count',
    q_smad: 'smad_count',
    cantidad_smad: 'smad_count',
    smad: 'smad_count',
    posicion: 'ranking_position',
    lugar: 'ranking_position',
    posicion_ranking: 'ranking_position',
    registros_salesforce: 'salesforce_records',
    datos_salesforce: 'salesforce_records',
  };

  if (kind === 'delinquency') {
    const delinquency: Record<string, SnapshotDatabaseColumn> = {
      clientes_mora: 'delinquent_clients_count',
      mora_clientes: 'delinquent_clients_count',
      sauce_clientes: 'delinquent_clients_count',
      porcentaje_mora: 'delinquency_rate',
      mora_porcentaje: 'delinquency_rate',
      porcentaje_riesgo: 'delinquency_rate',
      porc_riesgo: 'delinquency_rate',
      riesgo: 'delinquency_rate',
      '%_riesgo': 'delinquency_rate',
    };
    return delinquency[normalized];
  }

  if (kind === 'senior') {
    const senior: Record<string, SnapshotDatabaseColumn> = {
      antiguedad: 'tenure_months',
      total_trimestre: 'quarter_total_uf',
      total_trimestre_uf: 'quarter_total_uf',
      anulacion: 'cancellation_uf',
      anulacion_uf: 'cancellation_uf',
      descanso: 'rest_count',
      resto: 'rest_count',
      ssff: 'ssff_count',
      total: 'eligible_total_uf',
      total_valido_uf: 'eligible_total_uf',
      premio: 'estimated_prize_clp',
      premio_estimado_clp: 'estimated_prize_clp',
      categoria: 'senior_level',
      nivel_senior: 'senior_level',
    };
    return senior[normalized] ?? common[normalized];
  }

  if (kind === 'category') {
    const category: Record<string, SnapshotDatabaseColumn> = {
      categoria: 'category',
      premio: 'estimated_prize_clp',
      premio_estimado_clp: 'estimated_prize_clp',
    };
    return category[normalized] ?? common[normalized];
  }

  if (kind === 'ranking') return common[normalized];
  if (kind === 'salesforce') return common[normalized];
  return common[normalized];
}

function worksheetRows(workbook: WorkBook, sheetName: string): CellValue[][] {
  if (!spreadsheetUtils) throw new Error('El lector de Excel aún no está disponible.');
  const sheet = workbook.Sheets[sheetName];
  return spreadsheetUtils.sheet_to_json<CellValue[]>(sheet, { header: 1, raw: true, defval: null, blankrows: false });
}

function hasForbiddenHeaders(rows: CellValue[][]): boolean {
  return rows.slice(0, 20).some((row) => row.some((cell) => {
    const normalized = normalizeText(cell);
    return forbiddenHeaderTokens.some((token) => normalized === token || normalized.startsWith(`${token}_`));
  }));
}

function sheetScore(sheetName: string, kind: SnapshotKind, rows: CellValue[][]): number {
  if (hasForbiddenHeaders(rows)) return -1000;
  const preferred = preferredSheetNames[kind];
  const normalizedName = normalizeText(sheetName).replace(/_/g, ' ');
  const nameScore = preferred.findIndex((name) => normalizedName === name);
  let score = nameScore >= 0 ? 100 - nameScore : 0;
  for (const row of rows.slice(0, 30)) {
    const mapped = row.map((cell) => mapHeader(cell, kind)).filter(Boolean);
    const identifier = mapped.includes('rut') || mapped.includes('name');
    const metrics = mapped.filter((value) => value !== 'rut' && value !== 'name').length;
    if (identifier && metrics) score = Math.max(score, 30 + metrics);
  }
  if (kind === 'ranking' && rows.some((row) => normalizeText(row[0]) === 'etiquetas_de_fila')) score += 20;
  return score;
}

export async function openSnapshotWorkbook(buffer: ArrayBuffer, kind: SnapshotKind, byteLength = buffer.byteLength): Promise<SnapshotWorkbook> {
  if (byteLength > MAX_WORKBOOK_BYTES) throw new Error('El Excel supera el límite seguro de 20 MB. Usa una copia resumida.');
  const { read, utils } = await import('xlsx');
  spreadsheetUtils = utils;
  const workbook = read(buffer, { type: 'array', cellDates: true });
  const scored = workbook.SheetNames
    .map((sheetName) => ({ sheetName, score: sheetScore(sheetName, kind, worksheetRows(workbook, sheetName)) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
  if (!scored.length) throw new Error('El libro no contiene hojas seguras: todas incluyen columnas de detalle de clientes.');
  return { workbook, safeSheets: scored.map((entry) => entry.sheetName), recommendedSheet: scored[0].sheetName };
}

function cleanWorkerName(value: CellValue): string | undefined {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!name || /^(total|etiquetas|suma de)/i.test(name)) return undefined;
  return name.slice(0, 120);
}

function parseRankingSheet(workbook: WorkBook, sheetName: string): CsvParseResult | null {
  const rows = worksheetRows(workbook, sheetName);
  const headerRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => normalizeText(row[0]) === 'etiquetas_de_fila');
  if (!headerRows.length) return null;
  const blocks = headerRows.map(({ row: header, index: headerIndex }) => {
    const totalIndex = header.findIndex((cell) => ['total', 'total_general', 'produccion'].includes(normalizeText(cell)));
    const candidates: { name: string; production: number; rowNumber: number }[] = [];
    if (totalIndex < 0) return candidates;
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const name = cleanWorkerName(rows[index][0]);
      if (!name) {
        if (normalizeText(rows[index][0]).startsWith('total')) break;
        continue;
      }
      const production = parseNumeric(rows[index][totalIndex]);
      if (production === null) continue;
      candidates.push({ name, production, rowNumber: index + 1 });
    }
    return candidates;
  });
  const merged = new Map<string, { name: string; production: number; rowNumber: number }>();
  blocks.flat().forEach((entry) => {
    const key = normalizeText(entry.name);
    const current = merged.get(key);
    merged.set(key, current
      ? { ...current, production: current.production + entry.production }
      : entry);
  });
  const candidates = [...merged.values()];
  if (!candidates.length) return null;

  const ordered = [...candidates].sort((left, right) => right.production - left.production);
  const positionByName = new Map(ordered.map((entry, index) => [entry.name, index + 1]));
  return {
    rows: candidates.map((entry) => ({
      rowNumber: entry.rowNumber,
      name: entry.name,
      values: { production_uf: entry.production, ranking_position: positionByName.get(entry.name) },
    })),
    errors: [],
    unknownHeaders: [],
    warnings: ['Se combinaron los bloques de vendedores de la hoja; los rankings paralelos de equipos fueron descartados.'],
    sheetName,
  };
}

interface CategoryRule {
  category: string;
  from: number;
  smad: number;
  prize: number;
}

function categoryRules(workbook: WorkBook): CategoryRule[] {
  const sheetName = workbook.SheetNames.find((name) => normalizeText(name) === 'tramos');
  if (!sheetName) return [];
  return worksheetRows(workbook, sheetName)
    .slice(1)
    .map((row) => {
      const from = parseNumeric(row[1]);
      const smad = parseNumeric(row[3]);
      const prize = parseNumeric(row[4]);
      const category = String(row[0] ?? '').replace(/^[^A-Za-zÁÉÍÓÚÑ]+/u, '').trim();
      return from === null || smad === null || prize === null || !category ? null : { category, from, smad, prize };
    })
    .filter((rule): rule is CategoryRule => Boolean(rule))
    .sort((left, right) => right.from - left.from);
}

function convertNumeric(kind: SnapshotKind, column: SnapshotDatabaseColumn, value: number): number {
  if (column === 'delinquency_rate' && value >= 0 && value <= 1) return Math.round(value * 10000) / 100;
  if (kind === 'senior' && column === 'tenure_months' && value >= 0 && value <= 30) return Math.round(value * 12);
  return value;
}

function delinquentClientCounts(workbook: WorkBook): Map<string, number> {
  const clientIdsByWorker = new Map<string, Set<string>>();
  workbook.SheetNames
    .filter((sheetName) => normalizeText(sheetName).startsWith('detalle_vtas_vend'))
    .forEach((sheetName) => {
      const rows = worksheetRows(workbook, sheetName);
      const headerIndex = rows.slice(0, 10).findIndex((row) => {
        const normalized = row.map(normalizeText);
        return normalized.includes('rut_vendedor') && normalized.includes('ind_mora');
      });
      if (headerIndex < 0) return;
      const headers = rows[headerIndex].map(normalizeText);
      const workerIndex = headers.indexOf('rut_vendedor');
      const clientIndex = headers.indexOf('rut_cliente');
      const delinquencyIndex = headers.indexOf('ind_mora');
      rows.slice(headerIndex + 1).forEach((row, rowOffset) => {
        if (!normalizeText(row[delinquencyIndex]).includes('mora')) return;
        const workerRut = normalizeRut(String(row[workerIndex] ?? ''));
        if (!isValidRut(workerRut)) return;
        const clientKey = clientIndex >= 0 && row[clientIndex]
          ? normalizeText(row[clientIndex])
          : `${sheetName}:${rowOffset}`;
        if (!clientKey) return;
        const clients = clientIdsByWorker.get(workerRut) ?? new Set<string>();
        clients.add(clientKey);
        clientIdsByWorker.set(workerRut, clients);
      });
    });
  return new Map([...clientIdsByWorker.entries()].map(([rut, clients]) => [rut, clients.size]));
}

function addDelinquencyCounts(workbook: WorkBook, parsed: CsvParseResult): CsvParseResult {
  const counts = delinquentClientCounts(workbook);
  if (!counts.size) return parsed;
  return {
    ...parsed,
    rows: parsed.rows.map((row) => row.rut && counts.has(row.rut)
      ? { ...row, values: { ...row.values, delinquent_clients_count: counts.get(row.rut) } }
      : row),
    warnings: [
      ...(parsed.warnings ?? []),
      'La cantidad de clientes en mora se calculó localmente desde las hojas de detalle; ningún identificador de cliente se incluyó en la publicación.',
    ],
  };
}

function parseGenericSheet(workbook: WorkBook, sheetName: string, kind: SnapshotKind): CsvParseResult {
  const rows = worksheetRows(workbook, sheetName);
  if (hasForbiddenHeaders(rows)) {
    return { rows: [], errors: ['La hoja contiene columnas de clientes o contratos y fue bloqueada.'], unknownHeaders: [], sheetName };
  }

  let bestIndex = -1;
  let bestScore = -1;
  let bestMapped: (MappedColumn | undefined)[] = [];
  const candidateRows = rows.slice(0, 40);
  for (let index = 0; index < candidateRows.length; index += 1) {
    const row = candidateRows[index];
    const mapped = row.map((cell) => mapHeader(cell, kind));
    const hasIdentifier = mapped.includes('rut') || mapped.includes('name');
    const metricCount = mapped.filter((value) => value && value !== 'rut' && value !== 'name').length;
    const score = hasIdentifier ? metricCount : -1;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
      bestMapped = mapped;
    }
  }
  if (bestIndex < 0 || bestScore < 1) {
    return { rows: [], errors: ['No encontré una tabla con trabajador y totales compatibles en esta hoja.'], unknownHeaders: [], sheetName };
  }

  const headerRowIndex = bestIndex;
  const mappedHeaders = bestMapped;
  const originalHeaders = rows[headerRowIndex];
  const rutIndex = mappedHeaders.indexOf('rut');
  const nameIndex = mappedHeaders.indexOf('name');
  const parsedRows: ParsedSnapshotRow[] = [];
  const errors: string[] = [];
  const rules = kind === 'category' ? categoryRules(workbook) : [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const rawRut = rutIndex >= 0 ? normalizeRut(String(row[rutIndex] ?? '')) : '';
    const rut = rawRut && isValidRut(rawRut) ? rawRut : undefined;
    const name = nameIndex >= 0 ? cleanWorkerName(row[nameIndex]) : undefined;
    if (!rut && !name) continue;
    if (rawRut && !rut) {
      errors.push(`Fila ${index + 1}: RUT de trabajador inválido.`);
      continue;
    }

    const values: ParsedSnapshotRow['values'] = {};
    let invalid = false;
    mappedHeaders.forEach((mapped, columnIndex) => {
      if (!mapped || mapped === 'rut' || mapped === 'name') return;
      const databaseColumn: SnapshotDatabaseColumn = mapped;
      const raw = row[columnIndex];
      if (raw === null || raw === undefined || raw === '') return;
      if (textColumns.has(databaseColumn)) {
        const text = String(raw).trim();
        if (text && text !== '$-') values[databaseColumn] = text.slice(0, 80);
        return;
      }
      const numeric = parseNumeric(raw);
      if (numeric === null || (numeric < 0 && nonNegativeColumns.has(databaseColumn))) {
        if (databaseColumn === 'estimated_prize_clp' && String(raw).includes('-')) return;
        errors.push(`Fila ${index + 1}: valor inválido en ${String(originalHeaders[columnIndex] ?? 'columna')}.`);
        invalid = true;
      } else {
        values[databaseColumn] = convertNumeric(kind, databaseColumn, numeric);
      }
    });

    if (kind === 'category' && rules.length) {
      const production = Number(values.production_uf ?? 0);
      const smad = Number(values.smad_count ?? 0);
      const matched = rules.find((rule) => production >= rule.from && smad >= rule.smad);
      if (matched) {
        values.category = matched.category;
        values.estimated_prize_clp = matched.prize;
      } else {
        values.category = 'Sin categoría';
        values.estimated_prize_clp = 0;
      }
    }

    if (!invalid && Object.keys(values).length) parsedRows.push({ rowNumber: index + 1, rut, name, values });
  }

  const ignoredHeaders = originalHeaders.filter((header, index) => header && !mappedHeaders[index]).length;
  const warnings = ignoredHeaders
    ? [`${ignoredHeaders} columnas administrativas o de formato se descartaron localmente.`]
    : [];
  return { rows: parsedRows, errors, unknownHeaders: [], warnings, sheetName };
}

export function parseSnapshotWorkbookSheet(source: SnapshotWorkbook, sheetName: string, kind: SnapshotKind): CsvParseResult {
  if (!source.safeSheets.includes(sheetName)) {
    return { rows: [], errors: ['La hoja seleccionada no pasó el filtro de privacidad.'], unknownHeaders: [], sheetName };
  }
  if (kind === 'ranking') {
    const ranking = parseRankingSheet(source.workbook, sheetName);
    if (ranking) return ranking;
  }
  const parsed = parseGenericSheet(source.workbook, sheetName, kind);
  return kind === 'delinquency' ? addDelinquencyCounts(source.workbook, parsed) : parsed;
}
