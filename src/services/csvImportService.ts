import { SnapshotKind } from '@/types';
import { isValidRut, normalizeRut } from '@/utils/rut';

export type SnapshotDatabaseColumn =
  | 'production_uf'
  | 'gross_uf'
  | 'sepultura_uf'
  | 'ssff_uf'
  | 'cinerario_uf'
  | 'ssaa_uf'
  | 'emitted_uf'
  | 'not_emitted_uf'
  | 'not_uploaded_uf'
  | 'cancellation_uf'
  | 'quarter_total_uf'
  | 'eligible_total_uf'
  | 'business_count'
  | 'smad_count'
  | 'rest_count'
  | 'ssff_count'
  | 'delinquent_clients_count'
  | 'delinquency_rate'
  | 'salesforce_records'
  | 'tenure_months'
  | 'ranking_position'
  | 'category'
  | 'senior_level'
  | 'estimated_prize_clp';

export interface ParsedSnapshotRow {
  rowNumber: number;
  rut: string;
  values: Partial<Record<SnapshotDatabaseColumn, string | number>>;
}

export interface CsvParseResult {
  rows: ParsedSnapshotRow[];
  errors: string[];
  unknownHeaders: string[];
}

const headerAliases: Record<string, 'rut' | 'name' | SnapshotDatabaseColumn> = {
  rut: 'rut',
  rut_trabajador: 'rut',
  nombre: 'name',
  nombre_trabajador: 'name',
  vendedor: 'name',
  monto_vendido_uf: 'production_uf',
  venta_uf: 'production_uf',
  produccion_uf: 'production_uf',
  uf: 'production_uf',
  bruto_uf: 'gross_uf',
  produccion_bruta_uf: 'gross_uf',
  sepultura_uf: 'sepultura_uf',
  ssff_uf: 'ssff_uf',
  cinerario_uf: 'cinerario_uf',
  ssaa_uf: 'ssaa_uf',
  emitido_uf: 'emitted_uf',
  no_emitido_uf: 'not_emitted_uf',
  no_subido_uf: 'not_uploaded_uf',
  caida_uf: 'cancellation_uf',
  caidas_uf: 'cancellation_uf',
  anulacion_uf: 'cancellation_uf',
  total_trimestre_uf: 'quarter_total_uf',
  total_valido_uf: 'eligible_total_uf',
  total_computable_uf: 'eligible_total_uf',
  negocios: 'business_count',
  cantidad_negocios: 'business_count',
  smad: 'smad_count',
  cantidad_smad: 'smad_count',
  resto: 'rest_count',
  cantidad_resto: 'rest_count',
  cantidad_ssff: 'ssff_count',
  ssff_cantidad: 'ssff_count',
  mora_clientes: 'delinquent_clients_count',
  clientes_mora: 'delinquent_clients_count',
  sauce_clientes: 'delinquent_clients_count',
  porcentaje_mora: 'delinquency_rate',
  mora_porcentaje: 'delinquency_rate',
  registros_salesforce: 'salesforce_records',
  datos_salesforce: 'salesforce_records',
  antiguedad_meses: 'tenure_months',
  posicion: 'ranking_position',
  posicion_ranking: 'ranking_position',
  categoria: 'category',
  nivel_senior: 'senior_level',
  senior: 'senior_level',
  premio_estimado_clp: 'estimated_prize_clp',
  premio_clp: 'estimated_prize_clp',
};

const allowedByKind: Record<SnapshotKind, Set<SnapshotDatabaseColumn>> = {
  commercial: new Set(['production_uf', 'gross_uf', 'sepultura_uf', 'ssff_uf', 'cinerario_uf', 'ssaa_uf', 'emitted_uf', 'not_emitted_uf', 'not_uploaded_uf', 'business_count']),
  senior: new Set(['quarter_total_uf', 'cancellation_uf', 'eligible_total_uf', 'smad_count', 'rest_count', 'ssff_count', 'tenure_months', 'senior_level', 'estimated_prize_clp']),
  category: new Set(['production_uf', 'smad_count', 'category', 'estimated_prize_clp']),
  delinquency: new Set(['delinquent_clients_count', 'delinquency_rate']),
  salesforce: new Set(['salesforce_records']),
  ranking: new Set(['ranking_position', 'production_uf']),
};

const textColumns = new Set<SnapshotDatabaseColumn>(['category', 'senior_level']);

function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function parseDelimitedLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === separator && !quoted) {
      fields.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/\s/g, '').replace(/[$%UFuf]/g, '');
  if (!cleaned) return null;
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

export function parseSnapshotCsv(text: string, kind: SnapshotKind): CsvParseResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { rows: [], errors: ['El archivo debe contener encabezados y al menos una fila.'], unknownHeaders: [] };

  const separator = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const originalHeaders = parseDelimitedLine(lines[0], separator);
  const mappedHeaders = originalHeaders.map((header) => headerAliases[normalizeHeader(header)]);
  const unknownHeaders = originalHeaders.filter((header, index) => header.trim() && !mappedHeaders[index]);
  const forbiddenForKind = originalHeaders.filter((header, index) => {
    const mapped = mappedHeaders[index];
    return mapped && mapped !== 'rut' && mapped !== 'name' && !allowedByKind[kind].has(mapped);
  });
  const errors: string[] = [];

  if (unknownHeaders.length) errors.push(`Columnas no autorizadas: ${unknownHeaders.join(', ')}.`);
  if (forbiddenForKind.length) errors.push(`Columnas que no corresponden a esta foto: ${forbiddenForKind.join(', ')}.`);
  if (!mappedHeaders.includes('rut')) errors.push('Falta la columna RUT.');
  if (errors.length) return { rows: [], errors, unknownHeaders };

  const rows: ParsedSnapshotRow[] = [];
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const fields = parseDelimitedLine(lines[lineIndex], separator);
    const rutIndex = mappedHeaders.indexOf('rut');
    const rut = normalizeRut(fields[rutIndex] ?? '');
    if (!isValidRut(rut)) {
      errors.push(`Fila ${lineIndex + 1}: RUT inválido.`);
      continue;
    }

    const values: ParsedSnapshotRow['values'] = {};
    let invalidValue = false;
    mappedHeaders.forEach((mapped, fieldIndex) => {
      if (!mapped || mapped === 'rut' || mapped === 'name') return;
      const raw = fields[fieldIndex]?.trim() ?? '';
      if (!raw) return;
      if (textColumns.has(mapped)) {
        values[mapped] = raw.slice(0, 80);
        return;
      }
      const numeric = parseNumber(raw);
      if (numeric === null || numeric < 0) {
        errors.push(`Fila ${lineIndex + 1}: valor inválido en ${originalHeaders[fieldIndex]}.`);
        invalidValue = true;
      } else {
        values[mapped] = numeric;
      }
    });

    if (!invalidValue && Object.keys(values).length) rows.push({ rowNumber: lineIndex + 1, rut, values });
    else if (!invalidValue) errors.push(`Fila ${lineIndex + 1}: no contiene totales para importar.`);
  }

  return { rows, errors, unknownHeaders };
}
