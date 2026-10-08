import type { SQLiteDatabase } from 'expo-sqlite';

import type { DeliveryArea } from '../domain/deliveryAreas';
import type {
  FulfilmentType,
  JobCard,
  JobCardSourcePage,
  JobStatus,
} from '../domain/jobCard';

interface JobCardRow {
  id: string;
  date_made: string;
  customer_name: string;
  reference_number: string;
  fulfilment_type: FulfilmentType;
  delivery_area: DeliveryArea;
  location: string;
  delivery_instructions: string;
  delivery_fee_percent: number | null;
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
  deliveryArea: row.delivery_area,
  location: row.location,
  deliveryInstructions: row.delivery_instructions,
  deliveryFeePercent: row.delivery_fee_percent,
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
      delivery_area,
      location,
      delivery_instructions,
      delivery_fee_percent,
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

export async function saveJobCard(
  db: SQLiteDatabase,
  job: JobCard,
  sourcePages?: JobCardSourcePage[],
): Promise<void> {
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const areaName = job.deliveryArea.trim();
    let persistedAreaName = areaName || 'Other';

    if (areaName) {
      const existingArea = await db.getFirstAsync<{ name: string }>(
        'SELECT name FROM delivery_areas WHERE LOWER(name) = LOWER(?) LIMIT 1',
        areaName,
      );

      if (existingArea) {
        persistedAreaName = existingArea.name;
      } else {
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
          areaName,
          now,
        );
      }
    }

    await db.runAsync(
      `
        INSERT INTO job_cards (
          id,
          date_made,
          customer_name,
          reference_number,
          fulfilment_type,
          delivery_area,
          location,
          delivery_instructions,
          delivery_fee_percent,
          amount_cents,
          delivery_date,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          date_made = excluded.date_made,
          customer_name = excluded.customer_name,
          reference_number = excluded.reference_number,
          fulfilment_type = excluded.fulfilment_type,
          delivery_area = excluded.delivery_area,
          location = excluded.location,
          delivery_instructions = excluded.delivery_instructions,
          delivery_fee_percent = excluded.delivery_fee_percent,
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
      persistedAreaName,
      job.location.trim(),
      job.deliveryInstructions.trim(),
      job.deliveryFeePercent,
      job.amountCents,
      job.deliveryDate,
      job.status,
      now,
      now,
    );

    if (sourcePages !== undefined) {
      // Parsed item rows are derived from OCR source pages. Invalidate them
      // whenever a scan is replaced so the next order-load view reparses the
      // newest document rather than showing stale products.
      await db.runAsync(
        'DELETE FROM job_card_items WHERE job_card_id = ?',
        job.id,
      );

      await db.runAsync(
        'DELETE FROM job_card_source_pages WHERE job_card_id = ?',
        job.id,
      );

      for (const page of sourcePages) {
        await db.runAsync(
          `
            INSERT INTO job_card_source_pages (
              id,
              job_card_id,
              page_number,
              raw_text,
              captured_at
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          `${job.id}-page-${page.pageNumber}`,
          job.id,
          page.pageNumber,
          page.rawText,
          page.capturedAt,
        );
      }
    }
  });
}

export async function listJobCardSourcePages(
  db: SQLiteDatabase,
  jobCardId: string,
): Promise<JobCardSourcePage[]> {
  return db.getAllAsync<JobCardSourcePage>(
    `
      SELECT
        page_number AS pageNumber,
        raw_text AS rawText,
        captured_at AS capturedAt
      FROM job_card_source_pages
      WHERE job_card_id = ?
      ORDER BY page_number ASC
    `,
    jobCardId,
  );
}


export async function deleteJobCard(
  db: SQLiteDatabase,
  jobCardId: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM job_card_source_pages WHERE job_card_id = ?',
      jobCardId,
    );
    await db.runAsync('DELETE FROM job_cards WHERE id = ?', jobCardId);
  });
}
