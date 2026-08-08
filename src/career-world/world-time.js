const DAY_MS = 86_400_000;

export function addWorldDays(date, number = 1) {
  const [year, month, day] = String(date).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + number * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(left, right) {
  const leftMs = Date.parse(`${left}T00:00:00Z`);
  const rightMs = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return 0;
  return Math.round((rightMs - leftMs) / DAY_MS);
}

export function dateYear(date) {
  return Number(String(date).slice(0, 4)) || 2026;
}

export function monthDay(date) {
  return String(date).slice(5, 10);
}

export function isSameOrBefore(left, right) {
  return String(left) <= String(right);
}

export function isSameOrAfter(left, right) {
  return String(left) >= String(right);
}
