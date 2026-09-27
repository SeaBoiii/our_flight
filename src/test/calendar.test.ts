import { describe, expect, it } from 'vitest';
import { calendarContents, calendarUrl } from '../calendar';
import { day21Full, day21Reception, day22, invitationEvents, calendarEventVariants, presentInvitationEvent } from '../invitationEvents';
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
    expect(calendar).toContain('Wedding Reception');
    expect(calendar).toContain('DTSTART;TZID=Asia/Singapore:20270821T120000');
    expect(calendar).toContain('DTEND;TZID=Asia/Singapore:20270821T160000');
    expect(calendar).not.toMatch(/nikah/i);
  });

  it.each(['/', '/our_flight/', '/our_flight'])('adds six single-day files while preserving every original URL under %s', (base) => {
    const urls = calendarEventVariants.flatMap((event) => ['en', 'ms'].map((locale) => calendarUrl(event, locale as 'en' | 'ms', base)));
    expect(new Set(urls).size).toBe(12);
    for (const event of invitationEvents) {
      for (const locale of ['en', 'ms'] as const) {
        const existingUrl = calendarUrl(event, locale, base);
        expect(existingUrl).toMatch(new RegExp(`aleem-nurulain-${event.calendarKey}-${locale}\\.ics$`));
        expect(urls).toContain(existingUrl);
        expect(urls).toContain(calendarUrl(presentInvitationEvent(event, true), locale, base));
      }
    }
  });

  it('uses neutral summaries and descriptions without changing calendar identities or scheduling', () => {
    for (const source of invitationEvents) {
      for (const locale of ['en', 'ms'] as const) {
        const original = calendarContents(source, locale).replaceAll('\r\n ', '');
        const generic = calendarContents(presentInvitationEvent(source, true), locale).replaceAll('\r\n ', '');
        const withoutTitles = (calendar: string) => calendar.split('\r\n').filter((line) => !/^(SUMMARY|DESCRIPTION):/.test(line));
        expect(withoutTitles(generic)).toEqual(withoutTitles(original));
        expect(generic).toContain(locale === 'en' ? 'Wedding Reception' : 'Resepsi Perkahwinan');
        expect(generic).not.toMatch(/Bride|Groom|Pengantin Perempuan|Walimatul Urus/);
        expect(generic.includes('SUMMARY:Aleem & Nurulain · Nikah')).toBe(source.calendarKey === 'day21-full');
        expect(calendarUrl(presentInvitationEvent(source, true), locale)).toContain(`-${source.calendarKey}-single-day-${locale}.ics`);
      }
    }
  });

  it('provides the matching calendar presentation for every invitation profile in both languages', () => {
    for (const side of ['bride', 'groom'] as const) {
      for (const cabinClass of ['economy', 'premium-economy', 'business', 'first'] as const) {
        const invitation = invitationForClass(cabinClass, side);
        for (const event of invitation.events) {
          for (const locale of ['en', 'ms'] as const) {
            const published = calendarEventVariants.find((variant) => calendarUrl(variant, locale) === calendarUrl(event, locale));
            expect(published).toBeDefined();
            expect(calendarContents(published!, locale)).toBe(calendarContents(event, locale));
            expect(calendarContents(event, locale).replaceAll('\r\n ', '')).toContain(`DESCRIPTION:${event.title[locale]}`);
          }
        }
      }
    }
  });
});
