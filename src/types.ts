export type Locale = 'en' | 'ms';
export type RsvpStatus = 'preview' | 'open' | 'closed';
export type Attendance = 'attending' | 'not-attending';
export type CabinClass = 'economy' | 'premium-economy' | 'business' | 'first';
export type InvitationSide = 'groom' | 'bride';
export type InvitationScope = 'day21-reception' | 'day21-full' | 'day22' | 'both-days';

export type InvitationAccess = {
  side: InvitationSide;
  cabinClass: CabinClass;
};

export type AccessCredential =
  | { kind: 'class-code'; value: string }
  | { kind: 'legacy-token'; value: string };

export type LocalizedText = {
  en: string;
  ms: string;
};

export type CalendarSegment = {
  title: LocalizedText;
  startLocal: string;
  endLocal: string;
};

export type ProgrammeItem = {
  time: string;
  title: LocalizedText;
};

export type InvitationEvent = {
  id: 'day21' | 'day22';
  flightCode: 'AN2108' | 'AN2208';
  dateIso: '2027-08-21' | '2027-08-22';
  dateLabel: LocalizedText;
  title: LocalizedText;
  time: string;
  segments: Array<{ title: LocalizedText; time: string }>;
  programme: ProgrammeItem[];
  calendarSegments: CalendarSegment[];
};

export type Invitation = {
  side: InvitationSide;
  cabinClass: CabinClass;
  cabinLabel: LocalizedText;
  scope: InvitationScope;
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
  eventId: InvitationEvent['id'];
  attendance: Attendance | '';
  partySize: string;
};

export type RsvpDraft = {
  responseId: string;
  inviteeName: string;
  message: string;
  responses: EventAnswer[];
};

export type RsvpReceipt = {
  ok: boolean;
  duplicate?: boolean;
  error?: string;
  fields?: string[];
};

export function localized(value: LocalizedText, locale: Locale): string {
  return value[locale];
}
