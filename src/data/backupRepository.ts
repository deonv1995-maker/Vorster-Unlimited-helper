import type { SQLiteDatabase } from 'expo-sqlite';

import {
  BACKUP_COLUMNS,
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  createBackup,
  validateBackup,
  type BackupRecords,
  type BackupRow,
  type BackupTable,
  type JobBackup,
} from '../domain/backup';
import { DEFAULT_DELIVERY_AREAS } from '../domain/deliveryAreas';

async function checkDatabaseVersion(db: SQLiteDatabase) {
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (version?.user_version !== BACKUP_SCHEMA_VERSION) {
    throw new Error('Backup requires database schema v' + BACKUP_SCHEMA_VERSION + '. Update the app first.');
  }
}

/** Export a complete consistent snapshot, including scanned OCR and vehicle allocations. */
export async function exportDatabaseBackup(db: SQLiteDatabase): Promise<JobBackup> {
  const tables = {} as BackupRecords;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await checkDatabaseVersion(txn);
    for (const table of BACKUP_TABLES) {
      tables[table] = await txn.getAllAsync<BackupRow>('SELECT * FROM ' + table);
    }
  });
  return createBackup(tables);
}

function assertFreshDatabase(areas: BackupRow[]) {
  if (areas.length !== DEFAULT_DELIVERY_AREAS.length) {
    throw new Error('Restore is only allowed on a fresh, empty installation. Export your current data first.');
  }

  for (const expected of DEFAULT_DELIVERY_AREAS) {
    const stored = areas.find((area) => area.name === expected.name);
    if (!stored ||
      stored.color !== expected.color ||
      stored.text_color !== expected.textColor ||
      stored.sort_order !== expected.sortOrder ||
      stored.is_system !== (expected.isSystem ? 1 : 0)
    ) {
      throw new Error('This installation has modified delivery areas. Restore only to a fresh installation.');
    }
  }
}

async function insertBackupRows(
  db: SQLiteDatabase,
  table: BackupTable,
  rows: BackupRow[],
) {
  // Table/column names are compile-time constants. Values are SQL-bound parameters.
  const columns = Object.keys(BACKUP_COLUMNS[table]);
  const sql = 'INSERT INTO ' + table + ' (' + columns.join(', ') +
    ') VALUES (' + columns.map(() => '?').join(', ') + ')';
  for (const row of rows) {
    await db.runAsync(sql, columns.map((column) => row[column] ?? null));
  }
}

/**
 * Restoration cannot overwrite user data. It is one atomic transaction, so
 * errors (including constraint failures) roll back all imported rows.
 */
export async function restoreDatabaseBackup(
  db: SQLiteDatabase,
  rawBackup: JobBackup,
): Promise<number> {
  const backup = validateBackup(rawBackup);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await checkDatabaseVersion(txn);

    for (const table of BACKUP_TABLES) {
      if (table === 'delivery_areas') continue;
      const count = await txn.getFirstAsync<{ total: number }>(
        'SELECT COUNT(*) AS total FROM ' + table,
      );
      if ((count?.total ?? 0) !== 0) {
        throw new Error('This app already contains saved order data. Restore will not overwrite it.');
      }
    }

    const currentAreas = await txn.getAllAsync<BackupRow>(
      'SELECT name, color, text_color, sort_order, is_system FROM delivery_areas',
    );
    assertFreshDatabase(currentAreas);

    await txn.runAsync('DELETE FROM delivery_areas');

    // Dependency order matters: parent records first, then child tables.
    for (const table of BACKUP_TABLES) {
      await insertBackupRows(txn, table, backup.tables[table]);
    }

    const integrity = await txn.getFirstAsync<{ table: string }>('PRAGMA foreign_key_check');
    if (integrity) {
      throw new Error('Backup has invalid table references. No orders were restored.');
    }

    const overbooked = await txn.getFirstAsync<{ vehicle_id: string }>(`
      SELECT da.vehicle_id
      FROM delivery_allocations da
      INNER JOIN job_cards jc ON jc.id = da.job_card_id
      WHERE jc.delivery_date IS NOT NULL
        AND jc.fulfilment_type = 'Delivery'
        AND jc.status NOT IN ('Delivered', 'Collected', 'Canceled')
      GROUP BY da.vehicle_id, jc.delivery_date
      HAVING SUM(da.load_percent) > 100
      LIMIT 1
    `);
    if (overbooked) {
      throw new Error('Backup has overbooked vehicle capacity. No orders were restored.');
    }
  });
  return backup.tables.job_cards.length;
}
