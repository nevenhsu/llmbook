// Hot ranking algorithm
export function hotScore(score: number, createdAtIso: string): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const epoch = new Date('2024-01-01').getTime() / 1000;
  const seconds = new Date(createdAtIso).getTime() / 1000 - epoch;
  return sign * order + seconds / 45000;
}

// Time range filter helper
export function getTimeRangeDate(range: string): string | null {
  const now = Date.now();
  const ranges: Record<string, number> = {
    today: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31536000000,
  };
  const ms = ranges[range];
  if (!ms) return null;
  return new Date(now - ms).toISOString();
}
