import { describe, expect, it } from 'vitest';
import { departureStatus, eventWindow, seatForEvent, seatsForEvents } from '../departure';
import { day21Full, day21Reception, day22 } from '../invitationEvents';
import { invitationForClass } from '../invitations';
import type { DeparturePhase } from '../departure';
import type { InvitationEvent } from '../types';

const landed = { phase: 'landed', event: null, target: null, days: 0, hours: 0, minutes: 0 };

describe('eventWindow', () => {
  it.each([
    [day21Reception, '2027-08-21T04:00:00.000Z', '2027-08-21T08:00:00.000Z'],
    [day21Full, '2027-08-21T02:00:00.000Z', '2027-08-21T08:00:00.000Z'],
    [day22, '2027-08-22T04:00:00.000Z', '2027-08-22T08:00:00.000Z'],
  ] as const)('converts %s from Singapore local time to UTC', (event, start, end) => {
    expect(eventWindow(event)).toEqual({ start: new Date(start), end: new Date(end) });
  });

  it('uses the earliest start and latest end regardless of segment order', () => {
    const event = { ...day21Full, calendarSegments: [...day21Full.calendarSegments].reverse() };
    expect(eventWindow(event)).toEqual(eventWindow(day21Full));
    expect(event.calendarSegments[0].startLocal).toBe('20270821T120000');
  });
});

describe('departureStatus', () => {
  const singleDays = [
    { event: day21Reception, day: '2027-08-21', previous: '2027-08-20', start: '04:00:00', boarding: '05:00:00' },
    { event: day21Full, day: '2027-08-21', previous: '2027-08-20', start: '02:00:00', boarding: '03:00:00' },
    { event: day22, day: '2027-08-22', previous: '2027-08-21', start: '04:00:00', boarding: '05:00:00' },
  ];

  it.each(singleDays)('covers every applicable phase for $event.calendarKey alone', ({ event, day, previous, start, boarding }) => {
    const events = [event];
    const cases: Array<[string, DeparturePhase, string | null]> = [
      [`${previous}T15:59:59Z`, 'countdown', `${day}T${start}Z`],
      [`${previous}T16:00:00Z`, 'today', `${day}T${start}Z`],
      [`${day}T${start}Z`, 'boarding', `${day}T08:00:00Z`],
      [`${day}T${boarding}Z`, 'boarding', `${day}T08:00:00Z`],
      [`${day}T08:00:00Z`, 'landed', null],
      [`${day}T09:00:00Z`, 'landed', null],
    ];

    for (const [instant, phase, target] of cases) {
      const status = departureStatus(events, new Date(instant));
      expect(status).toMatchObject({ phase, event: target ? event : null, target: target ? new Date(target) : null });
      if (phase === 'landed') expect(status).toEqual(landed);
    }
  });

  it.each([
    ['2027-08-20T15:59:59Z', 'countdown', day21Full, '2027-08-21T02:00:00Z'],
    ['2027-08-20T16:00:00Z', 'today', day21Full, '2027-08-21T02:00:00Z'],
    ['2027-08-21T02:00:00Z', 'boarding', day21Full, '2027-08-21T08:00:00Z'],
    ['2027-08-21T07:59:59Z', 'boarding', day21Full, '2027-08-21T08:00:00Z'],
    ['2027-08-21T08:00:00Z', 'between', day22, '2027-08-22T04:00:00Z'],
    ['2027-08-21T15:59:59Z', 'between', day22, '2027-08-22T04:00:00Z'],
    ['2027-08-21T16:00:00Z', 'today', day22, '2027-08-22T04:00:00Z'],
    ['2027-08-22T04:00:00Z', 'boarding', day22, '2027-08-22T08:00:00Z'],
    ['2027-08-22T08:00:00Z', 'landed', null, null],
    ['2027-08-23T00:00:00Z', 'landed', null, null],
  ] as const)('handles both days at %s as %s', (instant, phase, event, target) => {
    const status = departureStatus([day21Full, day22], new Date(instant));
    expect(status.phase).toBe(phase);
    expect(status.event).toBe(event);
    expect(status.target).toEqual(target ? new Date(target) : null);
  });

  it('floors whole remaining days, hours and minutes', () => {
    expect(departureStatus([day21Full], new Date('2027-08-18T23:57:00.001Z'))).toMatchObject({
      phase: 'countdown', days: 2, hours: 2, minutes: 2,
    });
    expect(departureStatus([day21Full, day22], new Date('2027-08-21T08:00:00.001Z'))).toMatchObject({
      phase: 'between', days: 0, hours: 19, minutes: 59,
    });
    expect(departureStatus([day21Full], new Date('2027-08-21T02:00:00Z'))).toMatchObject({
      phase: 'boarding', days: 0, hours: 6, minutes: 0,
    });
  });

  it.each([
    '2027-08-21T01:59:59.999Z',
    '2027-08-21T07:59:59.999Z',
    '2027-08-21T08:00:00.000Z',
    '2028-01-01T00:00:00.000Z',
  ])('never returns negative units, including sub-minute remainders at %s', (instant) => {
    const status = departureStatus([day21Full], new Date(instant));
    expect([status.days, status.hours, status.minutes]).toEqual([0, 0, 0]);
  });

  it('sorts readonly inputs without changing their order or events', () => {
    const events = Object.freeze([day22, day21Full]);
    const snapshot = JSON.stringify(events);
    expect(departureStatus(events, new Date('2027-08-20T00:00:00Z')).event).toBe(day21Full);
    expect(JSON.stringify(events)).toBe(snapshot);
    expect(events[0]).toBe(day22);
  });

  it('is landed when no events remain or the invitation has no events', () => {
    expect(departureStatus([], new Date('2027-08-20T00:00:00Z'))).toEqual(landed);
    expect(departureStatus([day22, day21Full], new Date('2027-08-22T08:00:00Z'))).toEqual(landed);
  });

  it('uses the event window across a gap between calendar segments', () => {
    const event: InvitationEvent = {
      ...day21Full,
      calendarSegments: day21Full.calendarSegments.map((segment, index) => ({
        ...segment, endLocal: index === 0 ? '20270821T110000' : segment.endLocal,
      })),
    };
    expect(departureStatus([event], new Date('2027-08-21T03:30:00Z'))).toMatchObject({
      phase: 'boarding', target: new Date('2027-08-21T08:00:00Z'),
    });
  });

  it('works with presentation events returned by invitationForClass', () => {
    for (const [side, cabinClass, expected] of [
      ['bride', 'economy', '2027-08-21T04:00:00Z'],
      ['bride', 'business', '2027-08-21T02:00:00Z'],
      ['groom', 'economy', '2027-08-22T04:00:00Z'],
      ['groom', 'first', '2027-08-21T02:00:00Z'],
    ] as const) {
      const invitation = invitationForClass(cabinClass, side);
      const status = departureStatus(invitation.events, new Date('2027-08-20T00:00:00Z'));
      expect(status.event).toBe(invitation.events[0]);
      expect(status.target).toEqual(new Date(expected));
    }
  });
});

describe('seats', () => {
  it.each([
    [day21Reception, '21A'], [day21Full, '21A'], [day22, '22A'],
  ] as const)('assigns $calendarKey by event id', (event, seat) => {
    expect(seatForEvent(event)).toBe(seat);
  });

  it.each([
    [[day21Reception], ['21A']],
    [[day21Full], ['21A']],
    [[day22], ['22A']],
    [[day21Full, day22], ['21A', '22A']],
    [[day22, day21Reception, day21Full, day22], ['21A', '22A']],
    [[], []],
  ])('returns unique seats in event date order', (events, expected) => {
    expect(seatsForEvents(Object.freeze(events))).toEqual(expected);
  });
});
