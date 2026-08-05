export function fiscalYearUrgency(value: string | null): string {
  if (!value) return "Fiscal year end not provided";
  const target = new Date(`${value}T00:00:00Z`);
  const today = new Date();
  const startToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const days = Math.round((target.getTime() - startToday) / 86_400_000);
  if (days === 0) return "Year end today";
  if (days > 0) return `Year end in ${days} day${days === 1 ? "" : "s"}`;
  const elapsed = Math.abs(days);
  return `Year end passed ${elapsed} day${elapsed === 1 ? "" : "s"} ago`;
}
