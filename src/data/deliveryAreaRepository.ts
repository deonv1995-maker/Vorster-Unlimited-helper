import type { SQLiteDatabase } from 'expo-sqlite';

import {
  getContrastTextColor,
  type DeliveryAreaDefinition,
} from '../domain/deliveryAreas';

interface DeliveryAreaRow {
  name: string;
  color: string;
  text_color: string;
  sort_order: number;
  is_system: number;
}

const fromRow = (row: DeliveryAreaRow): DeliveryAreaDefinition => ({
  name: row.name,
  color: row.color,
  textColor: row.text_color,
  sortOrder: row.sort_order,
  isSystem: row.is_system === 1,
});

export async function listDeliveryAreas(
  db: SQLiteDatabase,
): Promise<DeliveryAreaDefinition[]> {
  const rows = await db.getAllAsync<DeliveryAreaRow>(`
    SELECT
      name,
      color,
      text_color,
      sort_order,
      is_system
    FROM delivery_areas
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC
  `);

  return rows.map(fromRow);
}

export async function createDeliveryArea(
  db: SQLiteDatabase,
  name: string,
  color: string,
): Promise<DeliveryAreaDefinition> {
  const trimmedName = name.replace(/\s+/g, ' ').trim();

  if (!trimmedName) {
    throw new Error('Enter a delivery area name.');
  }

  if (trimmedName.length > 40) {
    throw new Error('Delivery area names can be up to 40 characters.');
  }

  if (!/^#[0-9A-F]{6}$/i.test(color)) {
    throw new Error('Choose a valid delivery area colour.');
  }

  const duplicate = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM delivery_areas WHERE LOWER(name) = LOWER(?) LIMIT 1',
    trimmedName,
  );

  if (duplicate) {
    throw new Error(`${duplicate.name} already exists.`);
  }

  const maxSort = await db.getFirstAsync<{ max_sort: number | null }>(
    "SELECT MAX(sort_order) AS max_sort FROM delivery_areas WHERE name <> 'Other'",
  );
  const nextSortOrder = Math.min((maxSort?.max_sort ?? 0) + 10, 890);
  const textColor = getContrastTextColor(color);

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
      VALUES (?, ?, ?, ?, 0, ?)
    `,
    trimmedName,
    color.toUpperCase(),
    textColor,
    nextSortOrder,
    new Date().toISOString(),
  );

  return {
    name: trimmedName,
    color: color.toUpperCase(),
    textColor,
    sortOrder: nextSortOrder,
    isSystem: false,
  };
}


export async function removeDeliveryArea(
  db: SQLiteDatabase,
  name: string,
): Promise<number> {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Choose a delivery area to remove.');
  }

  if (trimmedName.toLocaleLowerCase('en-ZA') === 'other') {
    throw new Error('Other is the fallback area and cannot be removed.');
  }

  const existing = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM delivery_areas WHERE LOWER(name) = LOWER(?) LIMIT 1',
    trimmedName,
  );

  if (!existing) {
    throw new Error('That delivery area no longer exists.');
  }

  const countRow = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM job_cards WHERE LOWER(delivery_area) = LOWER(?)',
    existing.name,
  );
  const affectedJobs = Number(countRow?.count ?? 0);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "UPDATE job_cards SET delivery_area = 'Other' WHERE LOWER(delivery_area) = LOWER(?)",
      existing.name,
    );

    await db.runAsync(
      'DELETE FROM delivery_areas WHERE LOWER(name) = LOWER(?)',
      existing.name,
    );
  });

  return affectedJobs;
}
