import { describe, expect, it } from 'vitest';
import { calendarContents, calendarUrl } from '../calendar';
import { day21Full, day21Reception, day22, invitationEvents } from '../invitationEvents';
import { invitationForClass } from '../invitations';
import { invitationWith } from './fixtures';

describe('browser calendar files', () => {
  it('keeps established ceremony UIDs consistent across invitation scopes and languages', () => {
    const uids = (value: string) => Array.from(value.matchAll(/^UID:(.+)\r$/gm), ([, uid]) => uid);
    for (const locale of ['en', 'ms'] as const) {
      expect(uids(calendarContents(day21Full, locale))).toEqual(['an2108-1@aleem-nurulain', 'an2108-2@aleem-nurulain']);
      expect(uids(calendarContents(day21Reception, locale))).toEqual(['an2108-2@aleem-nurulain']);
      expect(uids(calendarContents(day22, locale))).toEqual(['an2208-1@aleem-nurulain']);
    }
  });

  it.each(['/', '/our_flight/', '/our_flight'])('provides six distinct hosted calendar URLs under %s', (base) => {
    const urls = invitationEvents.flatMap((event) => ['en', 'ms'].map((locale) => calendarUrl(event, locale as 'en' | 'ms', base)));
    const prefix = base === '/' ? '/calendar/' : '/our_flight/calendar/';
    expect(new Set(urls).size).toBe(6);
    expect(urls.every((url) => url.startsWith(prefix) && url.endsWith('.ics'))).toBe(true);
    expect(calendarUrl(day21Reception, 'ms', base)).toBe(`${prefix}aleem-nurulain-day21-reception-ms.ics`);
  });

  it('uses the Singapore timezone and includes both 21 August programme segments', () => {
    const [event] = invitationWith(2).events;
    const calendar = calendarContents(event, 'en');
    expect(calendar).toContain('DTSTART;TZID=Asia/Singapore:20270821T100000');
    expect(calendar).toContain('DTEND;TZID=Asia/Singapore:20270821T160000');
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(calendar).toContain('Chengal Ballroom');
    expect(calendar.endsWith('\r\n')).toBe(true);
  });

  it("uses Groom's Reception in English and Walimatul Urus in Malay for 22 August", () => {
    const [event] = invitationWith().events;
    const englishCalendar = calendarContents(event, 'en');
    const malayCalendar = calendarContents(event, 'ms');
    expect(englishCalendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(englishCalendar).toContain("Groom's Reception");
    expect(malayCalendar).toContain('Walimatul Urus');
    expect(englishCalendar).toContain('DTSTART;TZID=Asia/Singapore:20270822T120000');
    expect(englishCalendar).toContain('DTEND;TZID=Asia/Singapore:20270822T160000');
  });

  it('creates a reception-only 21 August calendar without Nikah details', () => {
    const [event] = invitationForClass('economy', 'bride').events;
    const calendar = calendarContents(event, 'en');

    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(calendar).toContain("Bride's Reception");
    expect(calendar).toContain('DTSTART;TZID=Asia/Singapore:20270821T120000');
    expect(calendar).toContain('DTEND;TZID=Asia/Singapore:20270821T160000');
    expect(calendar).not.toMatch(/nikah/i);
  });
});
