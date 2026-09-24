import { useEffect, useState } from 'react';

const DAY = 86_400_000;

/** Milliseconds until the next UTC midnight (the day boundary used by all date math). */
export function msUntilNextUtcDay(now: number): number {
  return DAY - (now % DAY);
}

/** Current date, re-rendering the caller when the UTC day changes. */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const t = setTimeout(() => setToday(new Date()), msUntilNextUtcDay(Date.now()) + 1000);
    return () => clearTimeout(t);
  }, [today]);
  return today;
}
