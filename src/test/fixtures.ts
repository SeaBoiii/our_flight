import type { Invitation, InvitationEvent, RsvpStatus } from '../types';

const day21: InvitationEvent = {
  id: 'day21',
  flightCode: 'AN2108',
  dateIso: '2027-08-21',
  dateLabel: { en: 'Saturday, 21 August 2027', ms: 'Sabtu, 21 Ogos 2027' },
  title: { en: "Nikah & Bride's Reception", ms: 'Nikah & Resepsi Pengantin Perempuan' },
  time: '10:00-16:00',
  segments: [
    { title: { en: 'Nikah', ms: 'Nikah' }, time: '10:00-12:00' },
    { title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, time: '12:00-16:00' },
  ],
  programme: [
    { time: '--:--', title: { en: 'Guest arrival', ms: 'Ketibaan tetamu' } },
    { time: '--:--', title: { en: 'Nikah ceremony', ms: 'Majlis nikah' } },
  ],
  calendarSegments: [
    { title: { en: 'Nikah', ms: 'Nikah' }, startLocal: '20270821T100000', endLocal: '20270821T120000' },
    { title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, startLocal: '20270821T120000', endLocal: '20270821T160000' },
  ],
};

const day22: InvitationEvent = {
  id: 'day22',
  flightCode: 'AN2208',
  dateIso: '2027-08-22',
  dateLabel: { en: 'Sunday, 22 August 2027', ms: 'Ahad, 22 Ogos 2027' },
  title: { en: "Groom's Reception", ms: 'Walimatul Urus' },
  time: '12:00-16:00',
  segments: [{ title: { en: "Groom's Reception", ms: 'Walimatul Urus' }, time: '12:00-16:00' }],
  programme: [
    { time: '--:--', title: { en: "Groom's march-in", ms: 'Perarakan masuk pengantin lelaki' } },
    { time: '--:--', title: { en: 'Kompang procession', ms: 'Perarakan kompang' } },
    { time: '--:--', title: { en: 'Cake cutting', ms: 'Acara memotong kek' } },
  ],
  calendarSegments: [
    { title: { en: "Groom's Reception", ms: 'Walimatul Urus' }, startLocal: '20270822T120000', endLocal: '20270822T160000' },
  ],
};

export function invitationWith(eventCount = 1, rsvpStatus: RsvpStatus = 'preview'): Invitation {
  const events = eventCount === 2 ? [structuredClone(day21), structuredClone(day22)] : [structuredClone(day22)];
  const cabinClass = eventCount === 2 ? 'business' : 'economy';

  return {
    cabinClass,
    cabinLabel: cabinClass === 'business'
      ? { en: 'Business', ms: 'Kelas Perniagaan' }
      : { en: 'Economy', ms: 'Kelas Ekonomi' },
    scope: eventCount === 2 ? 'both-days' : 'day22',
    flightCode: events.map((event) => event.flightCode).join(' / '),
    events,
    passengerLabel: { en: 'Honoured Guest', ms: 'Tetamu Yang Dihormati' },
    hotel: 'Crowne Plaza at Changi Airport',
    ballroom: 'Chengal',
    terminal: '3',
    rsvpStatus,
    rsvpDeadline: { en: 'Please respond by the deadline.', ms: 'Sila jawab sebelum tarikh akhir.' },
  };
}
