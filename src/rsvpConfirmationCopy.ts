import type { Locale } from './types';

type ConfirmationCopy = {
  attendingTitle: string;
  attendingBody: string;
  decliningTitle: string;
  decliningBody: string;
  mixedTitle: string;
  mixedBody: string;
  received: string;
  cabinClass: string;
  attending: string;
  declining: string;
};

export const rsvpConfirmationCopy: Record<Locale, ConfirmationCopy> = {
  en: {
    attendingTitle: 'Your seat is confirmed',
    attendingBody: 'We look forward to having you on board as we celebrate our wedding.',
    decliningTitle: "We'll miss having you on board",
    decliningBody: 'Thank you for responding and for being part of our story. You will be in our thoughts on our special day.',
    mixedTitle: 'Your itinerary is confirmed',
    mixedBody: 'Thank you for letting us know your plans. We look forward to celebrating with you at the events below.',
    received: 'RSVP received',
    cabinClass: 'Cabin class',
    attending: 'Attending',
    declining: 'Unable to attend',
  },
  ms: {
    attendingTitle: 'Tempat anda telah disahkan',
    attendingBody: 'Kami menantikan kehadiran anda untuk bersama-sama meraikan perkahwinan kami.',
    decliningTitle: 'Kami akan merindui kehadiran anda',
    decliningBody: 'Terima kasih atas maklum balas anda dan kerana menjadi sebahagian daripada kisah kami. Anda tetap dalam ingatan pada hari istimewa kami.',
    mixedTitle: 'Itinerari anda telah disahkan',
    mixedBody: 'Terima kasih kerana memaklumkan rancangan anda. Kami menantikan kehadiran anda di majlis yang disahkan di bawah.',
    received: 'RSVP diterima',
    cabinClass: 'Kelas kabin',
    attending: 'Akan hadir',
    declining: 'Tidak dapat hadir',
  },
};
