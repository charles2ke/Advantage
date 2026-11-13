export const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Midnight UTC on the day of the given date, so dates compare at day granularity. */
export function startOfDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

/** Whole days from one date to another, ignoring the time of day. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY)
}
