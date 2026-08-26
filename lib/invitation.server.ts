import type {
  CabinClass,
  Invitation,
  InvitationEvent,
  InvitationScope,
  LocalizedText,
  RsvpStatus,
} from './types';

const labels: Record<CabinClass, LocalizedText> = {
  economy: { en: 'Economy', ms: 'Kelas Ekonomi' },
  'premium-economy': { en: 'Premium Economy', ms: 'Kelas Ekonomi Premium' },
  business: { en: 'Business', ms: 'Kelas Perniagaan' },
  first: { en: 'First Class', ms: 'Kelas Pertama' },
};

const day21: InvitationEvent = {
  id: 'day21',
  flightCode: 'AN2108',
  dateIso: '2027-08-21',
  dateLabel: { en: 'Saturday, 21 August 2027', ms: 'Sabtu, 21 Ogos 2027' },
  title: {
    en: "Nikah & Bride's Reception",
    ms: 'Majlis Akad Nikah & Resepsi Pengantin Perempuan',
  },
  time: '10:00 – 16:00',
  segments: [
    { title: { en: 'Nikah', ms: 'Majlis Akad Nikah' }, time: '10:00 – 12:00' },
    {
      title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' },
      time: '12:00 – 16:00',
    },
  ],
  calendarHref: '/api/v1/calendar/day21',
};

const day22: InvitationEvent = {
  id: 'day22',
  flightCode: 'AN2208',
  dateIso: '2027-08-22',
  dateLabel: { en: 'Sunday, 22 August 2027', ms: 'Ahad, 22 Ogos 2027' },
  title: { en: 'Walimatul Urus', ms: 'Walimatul Urus' },
  time: '12:00 – 16:00',
  segments: [
    { title: { en: 'Wedding Reception', ms: 'Majlis Walimatul Urus' }, time: '12:00 – 16:00' },
  ],
  calendarHref: '/api/v1/calendar/day22',
};

export function scopeForClass(cabinClass: CabinClass): InvitationScope {
  return cabinClass === 'business' || cabinClass === 'first' ? 'both-days' : 'day22';
}

export function resolveRsvpStatus(): RsvpStatus {
  const configured = process.env.RSVP_STATUS;
  if (configured === 'closed') return 'closed';
  if (configured === 'open' && process.env.APPS_SCRIPT_URL && process.env.APPS_SCRIPT_SHARED_SECRET) {
    return 'open';
  }
  return 'preview';
}

export function getInvitation(cabinClass: CabinClass): Invitation {
  const scope = scopeForClass(cabinClass);
  return {
    cabinClass,
    cabinLabel: labels[cabinClass],
    scope,
    flightCode: scope === 'both-days' ? 'AN2108 · AN2208' : 'AN2208',
    events: scope === 'both-days' ? [day21, day22] : [day22],
    passengerLabel: { en: 'Honoured Guest', ms: 'Tetamu Yang Dihormati' },
    hotel: 'Crowne Plaza at Changi Airport',
    ballroom: 'Chengal',
    terminal: '3',
    rsvpStatus: resolveRsvpStatus(),
    rsvpDeadline: {
      en: 'Kindly respond by Sunday, 8 August 2027.',
      ms: 'Sila sahkan kehadiran selewat-lewatnya Ahad, 8 Ogos 2027.',
    },
  };
}

export const venue = {
  name: 'Chengal Ballroom, Crowne Plaza Changi Airport',
  address: '75 Airport Boulevard, Singapore 819664',
  mapUrl:
    'https://www.google.com/maps/search/?api=1&query=Crowne+Plaza+Changi+Airport%2C+75+Airport+Boulevard%2C+Singapore+819664',
};
