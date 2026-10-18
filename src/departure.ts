import type { InvitationEvent } from './types';

export type DeparturePhase = 'countdown' | 'today' | 'boarding' | 'between' | 'landed';

export type DepartureStatus = {
  phase: DeparturePhase;
  event: InvitationEvent | null;
  target: Date | null;
  days: number;
  hours: number;
  minutes: number;
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const SINGAPORE_OFFSET_MS = 8 * 60 * MINUTE_MS;

function singaporeLocalTime(value: string): number {
  return Date.UTC(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8)),
    Number(value.slice(9, 11)),
    Number(value.slice(11, 13)),
    Number(value.slice(13, 15)),
  ) - SINGAPORE_OFFSET_MS;
}

function singaporeDay(time: number): number {
  return Math.floor((time + SINGAPORE_OFFSET_MS) / DAY_MS);
}

/** Singapore uses UTC+8 throughout the year, independently of the host timezone. */
export function eventWindow(event: InvitationEvent): { start: Date; end: Date } {
  return {
    start: new Date(Math.min(...event.calendarSegments.map((segment) => singaporeLocalTime(segment.startLocal)))),
    end: new Date(Math.max(...event.calendarSegments.map((segment) => singaporeLocalTime(segment.endLocal)))),
  };
}

export function departureStatus(events: readonly InvitationEvent[], now: Date): DepartureStatus {
  const windows = events.map((event) => ({ event, ...eventWindow(event) }))
    .sort((left, right) => left.start.getTime() - right.start.getTime());
  const nowMs = now.getTime();

  for (const [index, { event, start, end }] of windows.entries()) {
    // An event boards at its start and finishes at its end, without a negative countdown.
    if (nowMs >= end.getTime()) continue;
    const boarding = nowMs >= start.getTime();
    const phase: DeparturePhase = boarding
      ? 'boarding'
      : singaporeDay(nowMs) === singaporeDay(start.getTime())
        ? 'today'
        : index > 0 ? 'between' : 'countdown';
    const target = boarding ? end : start;
    const remainingMinutes = Math.max(0, Math.floor((target.getTime() - nowMs) / MINUTE_MS));

    return {
      phase,
      event,
      target,
      days: Math.floor(remainingMinutes / (24 * 60)),
      hours: Math.floor(remainingMinutes / 60) % 24,
      minutes: remainingMinutes % 60,
    };
  }

  return { phase: 'landed', event: null, target: null, days: 0, hours: 0, minutes: 0 };
}

export function seatForEvent(event: InvitationEvent): '21A' | '22A' {
  return event.id === 'day21' ? '21A' : '22A';
}

export function seatsForEvents(events: readonly InvitationEvent[]): string[] {
  const ordered = [...events].sort((left, right) => eventWindow(left).start.getTime() - eventWindow(right).start.getTime());
  return [...new Set(ordered.map(seatForEvent))];
}
