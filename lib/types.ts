export type CabinClass =
  | 'economy'
  | 'premium-economy'
  | 'business'
  | 'first';

export type InvitationScope = 'day22' | 'both-days';
export type Locale = 'en' | 'ms';
export type Attendance = 'attending' | 'not-attending';

export type LocalizedText = {
  en: string;
  ms: string;
};

export type EventSegment = {
  title: LocalizedText;
  time: string;
};

export type InvitationEvent = {
  id: 'day21' | 'day22';
  dateIso: string;
  dateLabel: LocalizedText;
  title: LocalizedText;
  time: string;
  segments: EventSegment[];
  calendarHref: string;
};

export type Invitation = {
  cabinClass: CabinClass;
  cabinLabel: LocalizedText;
  scope: InvitationScope;
  flightCode: string;
  events: InvitationEvent[];
};

export type EventRsvp = {
  attendance: Attendance;
  partySize?: number;
};

export type RsvpSubmissionInput = {
  responseId: string;
  locale: Locale;
  inviteeName: string;
  day21?: EventRsvp;
  day22: EventRsvp;
  message?: string;
};

export type StoredRsvpSubmission = RsvpSubmissionInput & {
  cabinClass: CabinClass;
  scope: InvitationScope;
  submittedAt: string;
};

