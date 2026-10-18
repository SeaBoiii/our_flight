import { useEffect, useState } from 'react';
import { clockNow } from './weddingDay';

/**
 * The guest-facing time, re-read on each minute boundary and whenever the tab
 * returns to view. Uses clockNow(), so demo builds can preview any day with ?now=.
 */
export function useMinuteClock(): Date {
  const [now, setNow] = useState(clockNow);
  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { setNow(clockNow()); schedule(); }, 60_000 - (clockNow().getTime() % 60_000) + 50);
    };
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      setNow(clockNow());
      schedule();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return now;
}
