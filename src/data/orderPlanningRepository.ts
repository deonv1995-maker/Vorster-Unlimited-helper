import type { SQLiteDatabase } from 'expo-sqlite';

import type { JobCard } from '../domain/jobCard';
import {
  DELIVERY_VEHICLES,
  type DeliveryAllocation,
  type OrderItem,
  type ParsedOrderItem,
  type VehicleCapacity,
  type VehicleId,
} from '../domain/orderPlanning';

interface OrderItemRow {
  id: string;
  job_card_id: string;
  position: number;
  product_code: string;
  description: string;
  quantity: number;
  source_page: number;
}

interface AllocationRow {
  job_card_id: string;
  vehicle_id: VehicleId;
  load_percent: number;
}

interface CapacityRow {
  vehicle_id: VehicleId;
  booked_percent: number;
}

export class VehicleCapacityError extends Error {
  constructor(
    public readonly vehicleId: VehicleId,
    public readonly bookedPercent: number,
    public readonly requestedPercent: number,
  ) {
    super(
      `${vehicleId} would be ${bookedPercent + requestedPercent}% full, which exceeds 100%.`,
    );
    this.name = 'VehicleCapacityError';
  }
}

export async function listJobItems(
  db: SQLiteDatabase,
  jobCardId: string,
): Promise<OrderItem[]> {
  const rows = await db.getAllAsync<OrderItemRow>(
    `
      SELECT
        id,
        job_card_id,
        position,
        product_code,
        description,
        quantity,
        source_page
      FROM job_card_items
      WHERE job_card_id = ?
      ORDER BY position ASC
    `,
    jobCardId,
  );

  return rows.map((row) => ({
    id: row.id,
    jobCardId: row.job_card_id,
    position: row.position,
    productCode: row.product_code,
    description: row.description,
    quantity: row.quantity,
    sourcePage: row.source_page,
  }));
}

export async function replaceJobItems(
  db: SQLiteDatabase,
  jobCardId: string,
  items: ParsedOrderItem[],
): Promise<OrderItem[]> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM job_card_items WHERE job_card_id = ?', jobCardId);

    for (const item of items) {
      await db.runAsync(
        `
          INSERT INTO job_card_items (
            id,
            job_card_id,
            position,
            product_code,
            description,
            quantity,
            source_page
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        `${jobCardId}-item-${item.position}`,
        jobCardId,
        item.position,
        item.productCode,
        item.description,
        item.quantity,
        item.sourcePage,
      );
    }
  });

  return listJobItems(db, jobCardId);
}

export async function listJobAllocations(
  db: SQLiteDatabase,
  jobCardId: string,
): Promise<DeliveryAllocation[]> {
  const rows = await db.getAllAsync<AllocationRow>(
    `
      SELECT
        job_card_id,
        vehicle_id,
        load_percent
      FROM delivery_allocations
      WHERE job_card_id = ?
      ORDER BY vehicle_id ASC
    `,
    jobCardId,
  );

  return rows.map((row) => ({
    jobCardId: row.job_card_id,
    vehicleId: row.vehicle_id,
    loadPercent: row.load_percent,
  }));
}

export async function getVehicleCapacitiesForDate(
  db: SQLiteDatabase,
  deliveryDate: string,
  excludeJobCardId?: string,
): Promise<VehicleCapacity[]> {
  const rows = await db.getAllAsync<CapacityRow>(
    `
      SELECT
        da.vehicle_id,
        COALESCE(SUM(da.load_percent), 0) AS booked_percent
      FROM delivery_allocations da
      INNER JOIN job_cards jc ON jc.id = da.job_card_id
      WHERE jc.delivery_date = ?
        AND jc.fulfilment_type = 'Delivery'
        AND jc.status NOT IN ('Delivered', 'Collected', 'Canceled')
        AND (? IS NULL OR jc.id <> ?)
      GROUP BY da.vehicle_id
    `,
    deliveryDate,
    excludeJobCardId ?? null,
    excludeJobCardId ?? null,
  );

  const byVehicle = new Map(
    rows.map((row) => [row.vehicle_id, Number(row.booked_percent)]),
  );

  return DELIVERY_VEHICLES.map((vehicle) => ({
    vehicleId: vehicle.id,
    bookedPercent: byVehicle.get(vehicle.id) ?? 0,
  }));
}

const validateRequestedAllocations = async (
  db: SQLiteDatabase,
  job: JobCard,
  allocations: DeliveryAllocation[],
) => {
  if (!allocations.length) return;

  if (!job.deliveryDate) {
    throw new Error('Choose a delivery date before assigning vehicle space.');
  }

  const capacities = await getVehicleCapacitiesForDate(
    db,
    job.deliveryDate,
    job.id,
  );

  for (const allocation of allocations) {
    const booked =
      capacities.find((capacity) => capacity.vehicleId === allocation.vehicleId)
        ?.bookedPercent ?? 0;

    if (booked + allocation.loadPercent > 100) {
      throw new VehicleCapacityError(
        allocation.vehicleId,
        booked,
        allocation.loadPercent,
      );
    }
  }
};

export async function replaceJobAllocations(
  db: SQLiteDatabase,
  job: JobCard,
  allocations: DeliveryAllocation[],
): Promise<void> {
  await validateRequestedAllocations(db, job, allocations);

  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'DELETE FROM delivery_allocations WHERE job_card_id = ?',
      job.id,
    );

    for (const allocation of allocations) {
      if (allocation.loadPercent <= 0) continue;

      await db.runAsync(
        `
          INSERT INTO delivery_allocations (
            id,
            job_card_id,
            vehicle_id,
            load_percent,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        `${job.id}-${allocation.vehicleId}`,
        job.id,
        allocation.vehicleId,
        Math.round(allocation.loadPercent),
        now,
        now,
      );
    }
  });
}

export async function validateJobCapacityAfterDateChange(
  db: SQLiteDatabase,
  job: JobCard,
): Promise<void> {
  const allocations = await listJobAllocations(db, job.id);
  await validateRequestedAllocations(db, job, allocations);
}

