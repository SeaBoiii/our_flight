import { departureStatus, eventWindow } from './departure';
import type { InvitationEvent, ProgrammeItem } from './types';

export type WeddingDayStage = 'before' | 'during' | 'after';
export type WeddingDay = { event: InvitationEvent; stage: WeddingDayStage } | null;

const DAY_MS = 24 * 60 * 60 * 1_000;

function isEventDay(event: InvitationEvent, now: Date): boolean {
  const midnight = Date.parse(`${event.dateIso}T00:00:00+08:00`);
  return now.getTime() >= midnight && now.getTime() < midnight + DAY_MS;
}

/** Non-null only on the SGT calendar day of one of the guest's events (00:00-23:59:59 SGT). */
export function weddingDay(events: readonly InvitationEvent[], now: Date): WeddingDay {
  const event = events.find((candidate) => isEventDay(candidate, now));
  if (!event) return null;

  const { phase } = departureStatus([event], now);
  return {
    event,
    stage: phase === 'boarding' ? 'during' : phase === 'landed' ? 'after' : 'before',
  };
}

export type ProgrammeMoment = {
  current: ProgrammeItem | null;
  next: ProgrammeItem | null;
  nextAt: Date | null;
};

/**
 * For an event's programme on its SGT date, current is the last timed item at or
 * before now and next is the first item after now. Ignore non-HH:MM times and
 * clear both items once the event window ends.
 */
export function programmeMoment(event: InvitationEvent, now: Date): ProgrammeMoment {
  const moment: ProgrammeMoment = { current: null, next: null, nextAt: null };
  if (!isEventDay(event, now) || now.getTime() >= eventWindow(event).end.getTime()) return moment;

  const timedItems = event.programme
    .filter((item) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.time))
    .map((item) => ({ item, at: Date.parse(`${event.dateIso}T${item.time}:00+08:00`) }))
    .sort((left, right) => left.at - right.at);

  for (const { item, at } of timedItems) {
    if (at > now.getTime()) {
      moment.next = item;
      moment.nextAt = new Date(at);
      break;
    }
    moment.current = item;
  }
  return moment;
}

const clockOffset = (() => {
  if (!(import.meta.env.DEV === true || import.meta.env.MODE === 'demo') || typeof window === 'undefined') {
    return 0;
  }

  const value = new URLSearchParams(window.location.search).get('now');
  // Require an explicit timezone so preview time is independent of the host.
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    return 0;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return 0;
  // Date.parse otherwise normalizes impossible dates such as February 30.
  const date = value.slice(0, 10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return 0;
  return parsed - Date.now();
})();

/** Guest-facing real time, shifted once at module load by ?now=<ISO 8601> in dev or demo builds. */
export function clockNow(): Date {
  return new Date(Date.now() + clockOffset);
}

/** Optional HTTPS gallery link from VITE_GALLERY_URL; invalid or non-HTTPS values are ignored. */
export function galleryUrl(): string {
  try {
    const url = new URL(import.meta.env.VITE_GALLERY_URL);
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}
