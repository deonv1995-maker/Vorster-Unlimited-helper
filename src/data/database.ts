import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'vorster-unlimited-helper.db';

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS job_cards (
      id TEXT PRIMARY KEY NOT NULL,
      date_made TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      fulfilment_type TEXT NOT NULL CHECK (fulfilment_type IN ('Delivery', 'Collection')),
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

    PRAGMA user_version = 1;
  `);
}
