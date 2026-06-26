import type { Schedule } from '../types';

/**
 * Returns true when every future schedule has zero available spots.
 *
 * - "Future" means startTime > now.
 * - If there are no future schedules at all, returns false (that case is handled
 *   by the inline "no schedules available" message, not by the sold-out modal).
 */
export function isAllSoldOut(schedules: Schedule[], now: number = Date.now()): boolean {
  const futureSchedules = schedules.filter(
    (schedule) => new Date(schedule.startTime).getTime() > now,
  );
  if (futureSchedules.length === 0) return false;
  return futureSchedules.every((schedule) => schedule.availableSpots <= 0);
}
