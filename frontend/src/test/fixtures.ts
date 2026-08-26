import type { Invitation } from '../types';

export function invitationWith(eventCount = 1): Invitation {
  const events = Array.from({ length: eventCount }, (_, index) => ({
    id: `event-${index + 1}`,
    flightCode: `AN-${index + 1}`,
    dateIso: `2027-08-${String(index + 1).padStart(2, '0')}`,
    dateLabel: { en: `Celebration date ${index + 1}`, ms: `Tarikh majlis ${index + 1}` },
    title: { en: `Celebration ${index + 1}`, ms: `Majlis ${index + 1}` },
    time: '12:00 - 16:00',
    segments: [{ title: { en: 'Reception', ms: 'Resepsi' }, time: '12:00 - 16:00' }],
    calendarHref: `/api/v1/calendar/event-${index + 1}`,
  }));

  return {
    cabinClass: 'business',
    cabinLabel: { en: 'Business', ms: 'Kelas Perniagaan' },
    flightCode: events.map((event) => event.flightCode).join(' / '),
    events,
    passengerLabel: { en: 'Honoured Guest', ms: 'Tetamu Yang Dihormati' },
    hotel: 'Crowne Plaza at Changi Airport',
    ballroom: 'Chengal',
    terminal: '3',
    rsvpStatus: 'preview',
    rsvpDeadline: { en: 'Please respond by the deadline.', ms: 'Sila jawab sebelum tarikh akhir.' },
  };
}
