import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { listJobCardSourcePages } from '../../data/jobCardRepository';
import {
  getVehicleCapacitiesForDate,
  listJobAllocations,
  listJobItems,
  replaceJobAllocations,
  replaceJobItems,
} from '../../data/orderPlanningRepository';
import type { JobCard } from '../../domain/jobCard';
import {
  DELIVERY_VEHICLES,
  type DeliveryAllocation,
  type OrderItem,
  type VehicleCapacity,
} from '../../domain/orderPlanning';
import { parseOrderItemsFromSourcePages } from './orderItemImport';

export interface LoadedOrderPlan {
  items: OrderItem[];
  allocations: DeliveryAllocation[];
  capacities: VehicleCapacity[];
}

const emptyCapacities = (): VehicleCapacity[] =>
  DELIVERY_VEHICLES.map((vehicle) => ({
    vehicleId: vehicle.id,
    bookedPercent: 0,
  }));

export function useOrderPlanning() {
  const db = useSQLiteContext();

  const loadOrderPlan = useCallback(
    async (job: JobCard): Promise<LoadedOrderPlan> => {
      let items = await listJobItems(db, job.id);

      if (!items.length) {
        const sourcePages = await listJobCardSourcePages(db, job.id);

        if (sourcePages.length) {
          const parsedItems = parseOrderItemsFromSourcePages(sourcePages);

          if (parsedItems.length) {
            items = await replaceJobItems(db, job.id, parsedItems);
          }
        }
      }

      const allocations = await listJobAllocations(db, job.id);
      const capacities = job.deliveryDate
        ? await getVehicleCapacitiesForDate(db, job.deliveryDate, job.id)
        : emptyCapacities();

      return {
        items,
        allocations,
        capacities,
      };
    },
    [db],
  );

  const saveAllocations = useCallback(
    async (job: JobCard, allocations: DeliveryAllocation[]) => {
      await replaceJobAllocations(db, job, allocations);

      return job.deliveryDate
        ? getVehicleCapacitiesForDate(db, job.deliveryDate, job.id)
        : emptyCapacities();
    },
    [db],
  );

  return {
    loadOrderPlan,
    saveAllocations,
  };
}
