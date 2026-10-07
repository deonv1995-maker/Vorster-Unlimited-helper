import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import type { JobCard } from '../../domain/jobCard';
import { listJobCards, saveJobCard } from '../../data/jobCardRepository';

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
    async (job: JobCard) => {
      await saveJobCard(db, job);
      await refresh();
    },
    [db, refresh],
  );

  return {
    jobs,
    loading,
    saveJob: save,
    refresh,
  };
}
