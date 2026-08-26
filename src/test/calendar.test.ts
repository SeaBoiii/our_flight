import { describe, expect, it } from 'vitest';
import { calendarContents } from '../calendar';
import { invitationWith } from './fixtures';

describe('browser calendar files', () => {
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
});
