import type { SQLiteDatabase } from 'expo-sqlite';

import type { FulfilmentType, JobCard, JobStatus } from '../domain/jobCard';

interface JobCardRow {
  id: string;
  date_made: string;
  customer_name: string;
  reference_number: string;
  fulfilment_type: FulfilmentType;
  location: string;
  amount_cents: number;
  delivery_date: string | null;
  status: JobStatus;
}

const fromRow = (row: JobCardRow): JobCard => ({
  id: row.id,
  dateMade: row.date_made,
  customerName: row.customer_name,
  referenceNumber: row.reference_number,
  fulfilmentType: row.fulfilment_type,
  location: row.location,
  amountCents: row.amount_cents,
  deliveryDate: row.delivery_date,
  status: row.status,
});

export async function listJobCards(db: SQLiteDatabase): Promise<JobCard[]> {
  const rows = await db.getAllAsync<JobCardRow>(`
    SELECT
      id,
      date_made,
      customer_name,
      reference_number,
      fulfilment_type,
      location,
      amount_cents,
      delivery_date,
      status
    FROM job_cards
    ORDER BY
      CASE WHEN delivery_date IS NULL THEN 1 ELSE 0 END,
      delivery_date ASC,
      date_made DESC
  `);

  return rows.map(fromRow);
}

export async function saveJobCard(db: SQLiteDatabase, job: JobCard): Promise<void> {
  const now = new Date().toISOString();

  await db.runAsync(
    `
      INSERT INTO job_cards (
        id,
        date_made,
        customer_name,
        reference_number,
        fulfilment_type,
        location,
        amount_cents,
        delivery_date,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date_made = excluded.date_made,
        customer_name = excluded.customer_name,
        reference_number = excluded.reference_number,
        fulfilment_type = excluded.fulfilment_type,
        location = excluded.location,
        amount_cents = excluded.amount_cents,
        delivery_date = excluded.delivery_date,
        status = excluded.status,
        updated_at = excluded.updated_at
    `,
    job.id,
    job.dateMade,
    job.customerName.trim(),
    job.referenceNumber.trim(),
    job.fulfilmentType,
    job.location.trim(),
    job.amountCents,
    job.deliveryDate,
    job.status,
    now,
    now,
  );
}
