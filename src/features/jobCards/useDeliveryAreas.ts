import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import {
  createDeliveryArea,
  listDeliveryAreas,
} from '../../data/deliveryAreaRepository';
import type { DeliveryAreaDefinition } from '../../domain/deliveryAreas';

export function useDeliveryAreas() {
  const db = useSQLiteContext();
  const [deliveryAreas, setDeliveryAreas] = useState<DeliveryAreaDefinition[]>([]);
  const [loadingDeliveryAreas, setLoadingDeliveryAreas] = useState(true);

  const refreshDeliveryAreas = useCallback(async () => {
    const stored = await listDeliveryAreas(db);
    setDeliveryAreas(stored);
  }, [db]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const stored = await listDeliveryAreas(db);
        if (active) setDeliveryAreas(stored);
      } finally {
        if (active) setLoadingDeliveryAreas(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [db]);

  const addDeliveryArea = useCallback(
    async (name: string, color: string) => {
      const created = await createDeliveryArea(db, name, color);
      await refreshDeliveryAreas();
      return created;
    },
    [db, refreshDeliveryAreas],
  );

  return {
    deliveryAreas,
    loadingDeliveryAreas,
    addDeliveryArea,
    refreshDeliveryAreas,
  };
}
