export type Rating = "again" | "unsure" | "got";

export interface SrsState {
  ease: number;
  interval: number; // minutes
  reps: number;
  lapses: number;
}

export const initialSrs: SrsState = { ease: 2.5, interval: 0, reps: 0, lapses: 0 };

/**
 * Simple SM-2-inspired scheduler, expressed in minutes so the effect
 * is visible during a session: hard cards come back quickly, mastered
 * cards are pushed further out.
 */
export function schedule(rating: Rating, prev: SrsState): SrsState {
  let { ease, interval, reps, lapses } = prev;

  if (rating === "again") {
    lapses += 1;
    reps = 0;
    interval = 2;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === "unsure") {
    reps += 1;
    interval = interval === 0 ? 15 : Math.max(10, Math.round(interval * 1.6));
    ease = Math.max(1.3, ease - 0.05);
  } else {
    reps += 1;
    if (interval === 0) interval = 60;
    else if (interval < 24 * 60) interval = Math.round(interval * ease);
    else interval = Math.round(interval * 1.3);
    interval = Math.min(interval, 60 * 24 * 14);
    ease = Math.min(2.9, ease + 0.1);
  }
  return { ease, interval, reps, lapses };
}

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / (60 * 24))} d`;
}
