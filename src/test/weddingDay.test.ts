import { afterEach, describe, expect, it, vi } from 'vitest';
import { day21Full, day21Reception, day22 } from '../invitationEvents';
import type { InvitationEvent, ProgrammeItem } from '../types';
import { galleryUrl, programmeMoment, weddingDay } from '../weddingDay';
import type { WeddingDayStage } from '../weddingDay';

const originalLocation = window.location.href;
const emptyMoment = { current: null, next: null, nextAt: null };

afterEach(() => {
  window.history.replaceState(null, '', originalLocation);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('weddingDay', () => {
  it.each(['2027-08-21T04:00:00Z', '2027-08-23T04:00:00Z'])(
    'returns null on a different SGT calendar day at %s',
    (instant) => {
      expect(weddingDay([day22], new Date(instant))).toBeNull();
    },
  );

  it.each([
    { event: day21Reception, date: '2027-08-21', start: '04:00:00' },
    { event: day21Full, date: '2027-08-21', start: '02:00:00' },
    { event: day22, date: '2027-08-22', start: '04:00:00' },
  ])('uses the full event window for $event.calendarKey stages', ({ event, date, start }) => {
    const cases: Array<[string, WeddingDayStage]> = [
      [`${date}T00:00:00Z`, 'before'],
      [`${date}T${start}Z`, 'during'],
      [`${date}T07:59:59.999Z`, 'during'],
      [`${date}T08:00:00Z`, 'after'],
      [`${date}T15:59:59.999Z`, 'after'],
    ];

    for (const [instant, stage] of cases) {
      expect(weddingDay([event], new Date(instant))).toEqual({ event, stage });
    }
  });

  it.each([
    ['2027-08-21T15:59:59.999Z', null],
    ['2027-08-21T16:00:00.000Z', 'before'],
    ['2027-08-22T15:59:59.999Z', 'after'],
    ['2027-08-22T16:00:00.000Z', null],
  ] as const)('respects the SGT midnight boundary at %s', (instant, stage) => {
    expect(weddingDay([day22], new Date(instant))).toEqual(stage ? { event: day22, stage } : null);
  });

  it.each([
    ['2027-08-20T16:00:00Z', day21Full, 'before'],
    ['2027-08-21T06:00:00Z', day21Full, 'during'],
    ['2027-08-21T15:59:59.999Z', day21Full, 'after'],
    ['2027-08-21T16:00:00Z', day22, 'before'],
    ['2027-08-22T06:00:00Z', day22, 'during'],
    ['2027-08-22T08:00:00Z', day22, 'after'],
  ] as const)('selects the current SGT day from a both-days invitation at %s', (instant, event, stage) => {
    const events = Object.freeze([day22, day21Full]);
    expect(weddingDay(events, new Date(instant))).toEqual({ event, stage });
    expect(events).toEqual([day22, day21Full]);
  });

  it('returns null when the invitation has no events', () => {
    expect(weddingDay([], new Date('2027-08-22T04:00:00Z'))).toBeNull();
  });
});

describe('programmeMoment', () => {
  const programme = day22.programme;

  it.each(['2027-08-21T16:00:00Z', '2027-08-22T03:59:59.999Z'])(
    'shows the first real day22 item as next before it starts at %s',
    (instant) => {
      expect(programmeMoment(day22, new Date(instant))).toEqual({
        current: null,
        next: programme[0],
        nextAt: new Date('2027-08-22T04:00:00Z'),
      });
    },
  );

  it.each([
    ['2027-08-22T04:00:00Z', 0, 1, '2027-08-22T04:30:00Z'],
    ['2027-08-22T04:30:00Z', 1, 2, '2027-08-22T06:30:00Z'],
    ['2027-08-22T06:30:00Z', 2, 3, '2027-08-22T07:00:00Z'],
    ['2027-08-22T07:00:00Z', 3, null, null],
    ['2027-08-22T04:15:00Z', 0, 1, '2027-08-22T04:30:00Z'],
    ['2027-08-22T05:00:00Z', 1, 2, '2027-08-22T06:30:00Z'],
    ['2027-08-22T06:45:00Z', 2, 3, '2027-08-22T07:00:00Z'],
    ['2027-08-22T07:59:59.999Z', 3, null, null],
  ] as const)('tracks the real day22 programme at %s', (instant, current, next, nextAt) => {
    expect(programmeMoment(day22, new Date(instant))).toEqual({
      current: programme[current],
      next: next === null ? null : programme[next],
      nextAt: nextAt ? new Date(nextAt) : null,
    });
  });

  it.each(['2027-08-22T08:00:00Z', '2027-08-22T09:00:00Z'])(
    'clears the current and next items once the event ends at %s',
    (instant) => {
      expect(programmeMoment(day22, new Date(instant))).toEqual(emptyMoment);
    },
  );

  it.each(['2027-08-21T15:59:59.999Z', '2027-08-22T16:00:00Z'])(
    'has no programme moment outside the event SGT date at %s',
    (instant) => {
      expect(programmeMoment(day22, new Date(instant))).toEqual(emptyMoment);
    },
  );

  it('ignores placeholders and invalid times, and finds chronological items without reordering the input', () => {
    const item = (time: string): ProgrammeItem => ({ time, title: { en: time, ms: time } });
    const first = item('12:00');
    const second = item('12:30');
    const last = item('15:00');
    const event: InvitationEvent = {
      ...day22,
      programme: [
        item('--:--'), last, item('9:00'), item('24:00'), item('12:60'),
        first, item('--:--'), item('12:30 trailing'), second, item('--:--'),
      ],
    };
    const originalOrder = [...event.programme];
    Object.freeze(event.programme);

    expect(programmeMoment(event, new Date('2027-08-22T03:59:59Z'))).toEqual({
      current: null, next: first, nextAt: new Date('2027-08-22T04:00:00Z'),
    });
    expect(programmeMoment(event, new Date('2027-08-22T04:15:00Z'))).toEqual({
      current: first, next: second, nextAt: new Date('2027-08-22T04:30:00Z'),
    });
    expect(programmeMoment(event, new Date('2027-08-22T07:30:00Z'))).toEqual({
      current: last, next: null, nextAt: null,
    });
    expect(event.programme).toEqual(originalOrder);
  });

  it.each([
    { items: [] },
    { items: [{ time: '--:--', title: { en: 'To be confirmed', ms: 'Akan disahkan' } }] },
  ])(
    'returns an empty moment without timed programme items',
    ({ items }) => {
      expect(programmeMoment({ ...day22, programme: items }, new Date('2027-08-22T05:00:00Z')))
        .toEqual(emptyMoment);
    },
  );
});

describe('clockNow', () => {
  const realInstant = new Date('2026-10-18T03:04:05.000Z');
  const previewInstant = new Date('2027-08-22T04:30:00.000Z');

  async function loadClock(dev: boolean, mode: string, override?: string) {
    vi.useFakeTimers();
    vi.setSystemTime(realInstant);
    vi.stubEnv('DEV', dev);
    vi.stubEnv('MODE', mode);
    const query = override === undefined ? '' : `?${new URLSearchParams({ now: override })}`;
    window.history.replaceState(null, '', `${window.location.pathname}${query}`);
    vi.resetModules();
    return (await import('../weddingDay')).clockNow;
  }

  it.each([[false, 'production'], [true, 'development'], [false, 'demo']] as const)(
    'uses the real advancing clock without an override in DEV=%s MODE=%s',
    async (dev, mode) => {
      const clockNow = await loadClock(dev, mode);
      expect(clockNow()).toEqual(realInstant);
      vi.advanceTimersByTime(5_000);
      expect(clockNow()).toEqual(new Date(realInstant.getTime() + 5_000));
    },
  );

  it.each([
    [true, 'development', '2027-08-22T04:30:00.000Z'],
    [false, 'demo', '2027-08-22T12:30:00.000+08:00'],
  ] as const)('allows an explicit ISO override in DEV=%s MODE=%s', async (dev, mode, override) => {
    const clockNow = await loadClock(dev, mode, override);
    expect(clockNow()).toEqual(previewInstant);
    vi.advanceTimersByTime(65_000);
    expect(clockNow()).toEqual(new Date(previewInstant.getTime() + 65_000));
  });

  it('computes the offset at module load and keeps it when the query changes', async () => {
    const clockNow = await loadClock(true, 'development', previewInstant.toISOString());
    vi.advanceTimersByTime(45_000);
    expect(clockNow()).toEqual(new Date(previewInstant.getTime() + 45_000));
    window.history.replaceState(null, '', '?now=2030-01-01T00%3A00%3A00Z');
    vi.advanceTimersByTime(1_000);
    expect(clockNow()).toEqual(new Date(previewInstant.getTime() + 46_000));
  });

  it.each(['', 'not-a-date', '2027-13-22T12:00:00Z', '2027-02-30T12:00:00Z', '2027-08-22T12:00:00'])(
    'ignores an invalid clock override %j',
    async (override) => {
      const clockNow = await loadClock(true, 'development', override);
      expect(clockNow()).toEqual(realInstant);
      vi.advanceTimersByTime(1_000);
      expect(clockNow()).toEqual(new Date(realInstant.getTime() + 1_000));
    },
  );

  it('ignores a valid override in production', async () => {
    const clockNow = await loadClock(false, 'production', previewInstant.toISOString());
    expect(clockNow()).toEqual(realInstant);
    vi.advanceTimersByTime(1_000);
    expect(clockNow()).toEqual(new Date(realInstant.getTime() + 1_000));
  });
});

describe('galleryUrl', () => {
  it('accepts an HTTPS gallery URL', () => {
    const url = 'https://gallery.example.test/our-flight?album=wedding#photos';
    vi.stubEnv('VITE_GALLERY_URL', url);
    expect(galleryUrl()).toBe(url);
  });

  it.each(['http://gallery.example.test/wedding', 'garbage', '', 'javascript:alert(1)'])(
    'rejects an invalid or non-HTTPS gallery URL %j',
    (url) => {
      vi.stubEnv('VITE_GALLERY_URL', url);
      expect(galleryUrl()).toBe('');
    },
  );
});
