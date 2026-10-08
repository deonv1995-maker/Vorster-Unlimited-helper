/**
 * Versioned, complete backup contract for SQLite schema v5.
 * Keep this independent of React Native so backups can be validated in CI.
 */
export const BACKUP_FORMAT = 'vorster-unlimited-helper/backup-v1';
export const BACKUP_SCHEMA_VERSION = 5;
export const BACKUP_MAX_CHARACTERS = 60_000_000;

type ColumnType = 'text' | 'integer' | 'number' | 'nullableText' | 'nullableNumber';
export type BackupValue = string | number | null;
export type BackupRow = Record<string, BackupValue>;

export const BACKUP_COLUMNS = {
  delivery_areas: {
    name: 'text', color: 'text', text_color: 'text',
    sort_order: 'integer', is_system: 'integer', created_at: 'text',
  },
  job_cards: {
    id: 'text', date_made: 'text', customer_name: 'text',
    reference_number: 'text', fulfilment_type: 'text', delivery_area: 'text',
    location: 'text', amount_cents: 'integer', delivery_date: 'nullableText',
    status: 'text', created_at: 'text', updated_at: 'text',
    delivery_instructions: 'text', delivery_fee_percent: 'nullableNumber',
  },
  job_card_source_pages: {
    id: 'text', job_card_id: 'text', page_number: 'integer',
    raw_text: 'text', captured_at: 'text',
  },
  job_card_items: {
    id: 'text', job_card_id: 'text', position: 'integer',
    product_code: 'text', description: 'text', quantity: 'number',
    source_page: 'integer',
  },
  delivery_allocations: {
    id: 'text', job_card_id: 'text', vehicle_id: 'text',
    load_percent: 'integer', created_at: 'text', updated_at: 'text',
  },
} as const satisfies Record<string, Record<string, ColumnType>>;

export type BackupTable = keyof typeof BACKUP_COLUMNS;
export const BACKUP_TABLES = Object.keys(BACKUP_COLUMNS) as BackupTable[];
export type BackupRecords = Record<BackupTable, BackupRow[]>;

export interface JobBackup {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  counts: Record<BackupTable, number>;
  tables: BackupRecords;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireValid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('Invalid backup: ' + message);
}

function validateValue(value: unknown, type: ColumnType): boolean {
  if (type === 'nullableText' && value === null) return true;
  if (type === 'nullableNumber' && value === null) return true;
  if (type === 'text' || type === 'nullableText') return typeof value === 'string';
  if (type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value);
  return typeof value === 'number' && Number.isFinite(value);
}

const STATUS_VALUES = new Set([
  'Pending', 'Scheduled', 'In Production', 'In Dispatch', 'Ready',
  'Delivered', 'Collected', 'On Hold', 'Canceled',
]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9A-F]{6}$/i;

function uniqueKeySet(rows: BackupRow[], column: string, table: string) {
  const keys = new Set<string>();
  for (const row of rows) {
    const value = String(row[column]);
    requireValid(value.trim().length > 0, table + ' contains a blank ' + column);
    requireValid(!keys.has(value), table + ' contains duplicate ' + column);
    keys.add(value);
  }
  return keys;
}

export function validateBackup(raw: unknown): JobBackup {
  requireValid(isObject(raw), 'root must be an object');
  requireValid(raw.format === BACKUP_FORMAT, 'unrecognized file format');
  requireValid(raw.schemaVersion === BACKUP_SCHEMA_VERSION, 'unsupported database version');
  requireValid(typeof raw.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)), 'invalid export date');
  requireValid(isObject(raw.tables) && isObject(raw.counts), 'missing tables or counts');

  const tables = raw.tables;
  const counts = raw.counts;

  for (const table of BACKUP_TABLES) {
    const columns: Record<string, ColumnType> = BACKUP_COLUMNS[table];
    const names = Object.keys(columns);
    const rows = tables[table];
    requireValid(Array.isArray(rows), 'missing ' + table);
    requireValid(Number.isSafeInteger(counts[table]) && counts[table] === rows.length, 'incorrect ' + table + ' count');
    for (const row of rows) {
      requireValid(isObject(row), table + ' contains an invalid row');
      requireValid(Object.keys(row).length === names.length, table + ' contains incompatible columns');
      for (const name of names) {
        requireValid(Object.prototype.hasOwnProperty.call(row, name) && validateValue(row[name], columns[name]), table + '.' + name + ' has an invalid value');
      }
    }
  }

  const areas = tables.delivery_areas as BackupRow[];
  const names = new Set<string>();
  for (const row of areas) {
    const name = String(row.name);
    requireValid(name.trim() === name && name.length > 0 && name.length <= 40, 'invalid area name');
    requireValid(!names.has(name.toLowerCase()), 'duplicate area name');
    names.add(name.toLowerCase());
    requireValid(COLOR_PATTERN.test(String(row.color)) && COLOR_PATTERN.test(String(row.text_color)), 'invalid area colour');
    requireValid(row.is_system === 0 || row.is_system === 1, 'invalid system-area flag');
  }
  requireValid(names.has('other'), 'missing fallback Other area');

  const jobs = tables.job_cards as BackupRow[];
  const jobIds = uniqueKeySet(jobs, 'id', 'job_cards');
  for (const row of jobs) {
    requireValid(names.has(String(row.delivery_area).toLowerCase()), 'job references an unknown area');
    requireValid(row.fulfilment_type === 'Delivery' || row.fulfilment_type === 'Collection', 'unknown fulfilment type');
    requireValid(STATUS_VALUES.has(String(row.status)), 'unknown job status');
    requireValid(DATE_PATTERN.test(String(row.date_made)), 'invalid date made');
    requireValid(row.delivery_date === null || DATE_PATTERN.test(String(row.delivery_date)), 'invalid delivery date');
    requireValid(typeof row.amount_cents === 'number' && row.amount_cents >= 0, 'invalid order amount');
    requireValid(row.delivery_fee_percent === null ||
      (typeof row.delivery_fee_percent === 'number' && row.delivery_fee_percent >= 0 && row.delivery_fee_percent <= 100), 'invalid delivery fee');
  }

  const sourcePages = tables.job_card_source_pages as BackupRow[];
  const items = tables.job_card_items as BackupRow[];
  const allocations = tables.delivery_allocations as BackupRow[];
  for (const [name, rows] of [
    ['job_card_source_pages', sourcePages],
    ['job_card_items', items],
    ['delivery_allocations', allocations],
  ] as const) {
    uniqueKeySet(rows, 'id', name);
    for (const row of rows) {
      requireValid(jobIds.has(String(row.job_card_id)), name + ' contains orphaned records');
    }
  }

  for (const [table, columns] of [
    ['job_card_source_pages', ['job_card_id', 'page_number']],
    ['job_card_items', ['job_card_id', 'position']],
    ['delivery_allocations', ['job_card_id', 'vehicle_id']],
  ] as const) {
    const combinations = new Set<string>();
    for (const row of tables[table]) {
      const key = columns.map((column) => JSON.stringify(row[column])).join('|');
      requireValid(!combinations.has(key), table + ' contains duplicate job entries');
      combinations.add(key);
    }
  }
  for (const row of sourcePages) {
    requireValid(typeof row.page_number === 'number' && row.page_number >= 1, 'invalid scanned-page number');
  }
  for (const row of items) {
    requireValid(typeof row.position === 'number' && row.position >= 0, 'invalid item position');
    requireValid(typeof row.source_page === 'number' && row.source_page >= 0, 'invalid item source page');
    requireValid(typeof row.quantity === 'number' && row.quantity >= 0, 'invalid item quantity');
  }
  for (const row of allocations) {
    requireValid(typeof row.load_percent === 'number' && row.load_percent >= 0 && row.load_percent <= 100, 'invalid vehicle load percentage');
  }

  return raw as unknown as JobBackup;
}

export function createBackup(records: BackupRecords, exportedAt = new Date().toISOString()): JobBackup {
  const counts = {} as Record<BackupTable, number>;
  for (const table of BACKUP_TABLES) counts[table] = records[table].length;
  return validateBackup({
    format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt, counts, tables: records,
  });
}

export function parseBackup(text: string): JobBackup {
  requireValid(text.length <= BACKUP_MAX_CHARACTERS, 'backup file is too large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Invalid backup: file is not valid JSON');
  }
  return validateBackup(parsed);
}
