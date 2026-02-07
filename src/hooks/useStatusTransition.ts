import { useEffect } from 'react';
import { runDueStatusTransition } from '@/services/transactions';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function useStatusTransition(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    const runTransition = async () => {
      try {
        await runDueStatusTransition(timezone);
      } catch {
        // Silent fail here; pages will still load and user can retry later.
      }
    };

    void runTransition();

    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    let intervalId: number | undefined;

    const timeoutId = window.setTimeout(() => {
      void runTransition();
      intervalId = window.setInterval(() => {
        void runTransition();
      }, ONE_DAY_MS);
    }, nextMidnight.getTime() - now.getTime());

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [enabled]);
}
