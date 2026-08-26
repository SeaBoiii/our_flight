import type { InvitationEvent, ProgrammeItem } from './types';

/**
 * EDIT YOUR GUEST-FACING PROGRAMME HERE.
 *
 * - Replace `--:--` with a display time such as `12:30` when confirmed.
 * - Edit both the English (`en`) and Malay (`ms`) descriptions.
 * - These entries appear only in the itinerary. Ticket and calendar times are
 *   kept separately in `invitations.ts`, so programme edits cannot change them.
 */
export const programmeByDay = {
  day21: [
    { time: '10:00', title: { en: 'Guest arrival', ms: 'Ketibaan tetamu' } },
    { time: '10:45', title: { en: 'Nikah ceremony', ms: 'Majlis nikah' } },
    { time: '12:00', title: { en: "Bride's reception", ms: 'Resepsi pengantin perempuan' } },
  ],
  day22: [
    { time: '12:00', title: { en: 'Guest arrival', ms: 'Ketibaan tetamu' } },
    { time: '12:30', title: { en: 'Kompang procession', ms: 'Perarakan kompang' } },
    { time: '14:30', title: { en: "Couple march-in", ms: 'Perarakan masuk pengantin lelaki' } },
    { time: '15:00', title: { en: 'Cake cutting', ms: 'Acara memotong kek' } },
  ],
} satisfies Record<InvitationEvent['id'], ProgrammeItem[]>;
