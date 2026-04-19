import { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import type { QueueItem } from '../components/ProcessingQueue';

export const useQueue = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchQueue = async () => {
      try {
        const data = await api.getQueue();
        if (isMounted) setQueue(data);
      } catch (err) {
        console.error("Queue poll error:", err);
      }
    };

    // Fetch immediately on mount
    fetchQueue();

    // Poll every 3 seconds
    const interval = setInterval(fetchQueue, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { queue };
};
