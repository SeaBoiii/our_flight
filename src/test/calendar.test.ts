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

  it('creates one event for the 22 August Walimatul Urus', () => {
    const [event] = invitationWith().events;
    const calendar = calendarContents(event, 'ms');
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(calendar).toContain('DTSTART;TZID=Asia/Singapore:20270822T120000');
    expect(calendar).toContain('DTEND;TZID=Asia/Singapore:20270822T160000');
  });
});
