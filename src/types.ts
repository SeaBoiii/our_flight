export type Locale = 'en' | 'ms';
export type RsvpStatus = 'preview' | 'open' | 'closed';
export type Attendance = 'attending' | 'not-attending';

export type LocalizedText = {
  en: string;
  ms: string;
};

export type InvitationEvent = {
  id: string;
  flightCode: string;
  dateIso: string;
  dateLabel: LocalizedText;
  title: LocalizedText;
  time: string;
  segments: Array<{ title: LocalizedText; time: string }>;
  calendarHref: string;
};

export type Invitation = {
  cabinClass: 'economy' | 'premium-economy' | 'business' | 'first';
  cabinLabel: LocalizedText;
  flightCode: string;
  events: InvitationEvent[];
  passengerLabel: LocalizedText;
  hotel: string;
  ballroom: string;
  terminal: string;
  rsvpStatus: RsvpStatus;
  rsvpDeadline: LocalizedText;
};

export type EventAnswer = {
  eventId: string;
  attendance: Attendance | '';
  partySize: string;
};

export type RsvpDraft = {
  responseId: string;
  inviteeName: string;
  message: string;
  responses: EventAnswer[];
};

export function localized(value: LocalizedText, locale: Locale): string {
  return value[locale];
}
