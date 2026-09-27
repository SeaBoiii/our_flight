import type { InvitationEvent, LocalizedText } from './types';
import {
  day21BrideReception,
  day21NikahAndReception,
  day22GroomReception,
} from './programme';

export const day21Reception: InvitationEvent = {
  calendarKey: 'day21-reception',
  id: 'day21',
  flightCode: 'AN2108',
  dateIso: '2027-08-21',
  dateLabel: { en: 'Saturday, 21 August 2027', ms: 'Sabtu, 21 Ogos 2027' },
  title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' },
  time: '12:00–16:00',
  segments: [
    { kind: 'reception', title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, time: '12:00–16:00' },
  ],
  programme: day21BrideReception,
  calendarSegments: [
    { kind: 'reception', title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, startLocal: '20270821T120000', endLocal: '20270821T160000' },
  ],
};

export const day21Full: InvitationEvent = {
  calendarKey: 'day21-full',
  id: 'day21',
  flightCode: 'AN2108',
  dateIso: '2027-08-21',
  dateLabel: { en: 'Saturday, 21 August 2027', ms: 'Sabtu, 21 Ogos 2027' },
  title: { en: "Nikah & Bride's Reception", ms: 'Nikah & Resepsi Pengantin Perempuan' },
  time: '10:00–16:00',
  segments: [
    { title: { en: 'Nikah', ms: 'Nikah' }, time: '10:00–12:00' },
    { kind: 'reception', title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, time: '12:00–16:00' },
  ],
  programme: day21NikahAndReception,
  calendarSegments: [
    { title: { en: 'Nikah', ms: 'Nikah' }, startLocal: '20270821T100000', endLocal: '20270821T120000' },
    { kind: 'reception', title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, startLocal: '20270821T120000', endLocal: '20270821T160000' },
  ],
};

export const day22: InvitationEvent = {
  calendarKey: 'day22',
  id: 'day22',
  flightCode: 'AN2208',
  dateIso: '2027-08-22',
  dateLabel: { en: 'Sunday, 22 August 2027', ms: 'Ahad, 22 Ogos 2027' },
  title: { en: "Groom's Reception", ms: 'Walimatul Urus' },
  time: '12:00–16:00',
  segments: [
    { kind: 'reception', title: { en: "Groom's Reception", ms: 'Walimatul Urus' }, time: '12:00–16:00' },
  ],
  programme: day22GroomReception,
  calendarSegments: [
    { kind: 'reception', title: { en: "Groom's Reception", ms: 'Walimatul Urus' }, startLocal: '20270822T120000', endLocal: '20270822T160000' },
  ],
};

export const invitationEvents: InvitationEvent[] = [day21Reception, day21Full, day22];

const weddingReception: LocalizedText = { en: 'Wedding Reception', ms: 'Resepsi Perkahwinan' };
const nikahAndWeddingReception: LocalizedText = { en: 'Nikah & Wedding Reception', ms: 'Nikah & Resepsi Perkahwinan' };

/** Change presentation only. Shared source events, eligibility and calendar identity stay intact. */
export function presentInvitationEvent(event: InvitationEvent, singleDay: boolean): InvitationEvent {
  const presentItem = <T extends { kind?: 'reception'; title: LocalizedText }>(item: T): T => ({
    ...item,
    title: { ...(singleDay && item.kind === 'reception' ? weddingReception : item.title) },
  });
  return {
    ...event,
    calendarVariant: singleDay ? 'single-day' : undefined,
    dateLabel: { ...event.dateLabel },
    title: { ...(singleDay
      ? event.calendarKey === 'day21-full' ? nikahAndWeddingReception : weddingReception
      : event.title) },
    segments: event.segments.map(presentItem),
    programme: event.programme.map(presentItem),
    calendarSegments: event.calendarSegments.map(presentItem),
  };
}

// Preserve every previously published URL alongside the neutral single-day variants.
export const calendarEventVariants: InvitationEvent[] = [
  ...invitationEvents,
  ...invitationEvents.map((event) => presentInvitationEvent(event, true)),
];
