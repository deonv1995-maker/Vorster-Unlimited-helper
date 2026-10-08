import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import type { JobCard, JobCardSourcePage } from '../../domain/jobCard';
import { deleteJobCard, listJobCards, saveJobCard } from '../../data/jobCardRepository';
import { validateJobCapacityAfterDateChange } from '../../data/orderPlanningRepository';

export function useJobCards() {
  const db = useSQLiteContext();
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const storedJobs = await listJobCards(db);
    setJobs(storedJobs);
  }, [db]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const storedJobs = await listJobCards(db);
        if (active) setJobs(storedJobs);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [db]);

  const save = useCallback(
    async (job: JobCard, sourcePages?: JobCardSourcePage[]) => {
      await validateJobCapacityAfterDateChange(db, job);
      await saveJobCard(db, job, sourcePages);
      await refresh();
    },
    [db, refresh],
  );

  const remove = useCallback(
    async (jobCardId: string) => {
      await deleteJobCard(db, jobCardId);
      await refresh();
    },
    [db, refresh],
  );

  return {
    jobs,
    loading,
    saveJob: save,
    removeJob: remove,
    refresh,
  };
}
