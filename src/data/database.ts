import type { SQLiteDatabase } from 'expo-sqlite';

import {
  DEFAULT_DELIVERY_AREAS,
  inferDeliveryAreaFromAddress,
} from '../domain/deliveryAreas';

export const DATABASE_NAME = 'vorster-unlimited-helper.db';

interface UserVersionRow {
  user_version: number;
}

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS job_cards (
      id TEXT PRIMARY KEY NOT NULL,
      date_made TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      fulfilment_type TEXT NOT NULL CHECK (fulfilment_type IN ('Delivery', 'Collection')),
      delivery_area TEXT NOT NULL DEFAULT 'Other',
      location TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      delivery_date TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_job_cards_reference
      ON job_cards(reference_number);

    CREATE INDEX IF NOT EXISTS idx_job_cards_customer
      ON job_cards(customer_name);

    CREATE INDEX IF NOT EXISTS idx_job_cards_delivery_date
      ON job_cards(delivery_date);

    CREATE INDEX IF NOT EXISTS idx_job_cards_status
      ON job_cards(status);
  `);

  const versionRow = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 2) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(job_cards)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('delivery_instructions')) {
      await db.execAsync(
        "ALTER TABLE job_cards ADD COLUMN delivery_instructions TEXT NOT NULL DEFAULT '';",
      );
    }

    if (!columnNames.has('delivery_fee_percent')) {
      await db.execAsync(
        'ALTER TABLE job_cards ADD COLUMN delivery_fee_percent REAL;',
      );
    }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS job_card_source_pages (
        id TEXT PRIMARY KEY NOT NULL,
        job_card_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        raw_text TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
        UNIQUE (job_card_id, page_number)
      );

      CREATE INDEX IF NOT EXISTS idx_job_card_source_pages_job
        ON job_card_source_pages(job_card_id);

      PRAGMA user_version = 2;
    `);
  }

  if (currentVersion < 3) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(job_cards)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('delivery_area')) {
      await db.execAsync(
        "ALTER TABLE job_cards ADD COLUMN delivery_area TEXT NOT NULL DEFAULT 'Other';",
      );
    }

    const existingJobs = await db.getAllAsync<{ id: string; location: string }>(
      'SELECT id, location FROM job_cards',
    );

    for (const job of existingJobs) {
      await db.runAsync(
        'UPDATE job_cards SET delivery_area = ? WHERE id = ?',
        inferDeliveryAreaFromAddress(job.location),
        job.id,
      );
    }

    await db.execAsync('PRAGMA user_version = 3;');
  }

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS job_card_items (
        id TEXT PRIMARY KEY NOT NULL,
        job_card_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        product_code TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL,
        source_page INTEGER NOT NULL,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
        UNIQUE (job_card_id, position)
      );

      CREATE INDEX IF NOT EXISTS idx_job_card_items_job
        ON job_card_items(job_card_id);

      CREATE TABLE IF NOT EXISTS delivery_allocations (
        id TEXT PRIMARY KEY NOT NULL,
        job_card_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        load_percent INTEGER NOT NULL CHECK (load_percent >= 0 AND load_percent <= 100),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_card_id) REFERENCES job_cards(id) ON DELETE CASCADE,
        UNIQUE (job_card_id, vehicle_id)
      );

      CREATE INDEX IF NOT EXISTS idx_delivery_allocations_job
        ON delivery_allocations(job_card_id);

      CREATE INDEX IF NOT EXISTS idx_delivery_allocations_vehicle
        ON delivery_allocations(vehicle_id);

      PRAGMA user_version = 4;
    `);
  }

  if (currentVersion < 5) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS delivery_areas (
        name TEXT PRIMARY KEY NOT NULL,
        color TEXT NOT NULL,
        text_color TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_delivery_areas_sort
        ON delivery_areas(sort_order, name);

      UPDATE job_cards
      SET status = 'Canceled'
      WHERE status = 'Cancelled';
    `);

    const now = new Date().toISOString();

    for (const area of DEFAULT_DELIVERY_AREAS) {
      await db.runAsync(
        `
          INSERT OR IGNORE INTO delivery_areas (
            name,
            color,
            text_color,
            sort_order,
            is_system,
            created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        area.name,
        area.color,
        area.textColor,
        area.sortOrder,
        area.isSystem ? 1 : 0,
        now,
      );
    }

    const existingAreaNames = await db.getAllAsync<{ delivery_area: string }>(
      `
        SELECT DISTINCT delivery_area
        FROM job_cards
        WHERE TRIM(delivery_area) <> ''
      `,
    );

    for (const row of existingAreaNames) {
      const exists = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM delivery_areas WHERE LOWER(name) = LOWER(?) LIMIT 1',
        row.delivery_area,
      );

      if (!exists) {
        await db.runAsync(
          `
            INSERT INTO delivery_areas (
              name,
              color,
              text_color,
              sort_order,
              is_system,
              created_at
            )
            VALUES (?, '#98A2B3', '#FFFFFF', 900, 0, ?)
          `,
          row.delivery_area,
          now,
        );
      }
    }

    await db.execAsync('PRAGMA user_version = 5;');
  }
}
