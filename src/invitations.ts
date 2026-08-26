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
  title: { en: "Nikah & Bride's Reception", ms: 'Nikah & Resepsi Pengantin Perempuan' },
  time: '10:00–16:00',
  segments: [
    { title: { en: 'Nikah', ms: 'Nikah' }, time: '10:00–12:00' },
    { title: { en: "Bride's Reception", ms: 'Resepsi Pengantin Perempuan' }, time: '12:00–16:00' },
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
  title: { en: 'Walimatul Urus', ms: 'Walimatul Urus' },
  time: '12:00–16:00',
  segments: [
    { title: { en: 'Walimatul Urus', ms: 'Walimatul Urus' }, time: '12:00–16:00' },
  ],
  calendarSegments: [
    { title: { en: 'Walimatul Urus', ms: 'Walimatul Urus' }, startLocal: '20270822T120000', endLocal: '20270822T160000' },
  ],
};

function configuredHashes(): Record<CabinClass, string> {
  return {
    economy: import.meta.env.VITE_INVITE_HASH_ECONOMY ?? '',
    'premium-economy': import.meta.env.VITE_INVITE_HASH_PREMIUM ?? '',
    business: import.meta.env.VITE_INVITE_HASH_BUSINESS ?? '',
    first: import.meta.env.VITE_INVITE_HASH_FIRST ?? '',
  };
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function equalHash(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function invitationConfigurationReady(): boolean {
  const passcodeHash = import.meta.env.VITE_PASSCODE_HASH ?? '';
  const hashes = Object.values(configuredHashes());
  return isSha256(passcodeHash) && hashes.every(isSha256) && new Set(hashes.map((hash) => hash.toLowerCase())).size === 4;
}

export async function classForToken(token: string): Promise<CabinClass | null> {
  if (!/^[A-Za-z0-9_-]{20,160}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  for (const [cabinClass, configuredHash] of Object.entries(configuredHashes()) as Array<[CabinClass, string]>) {
    if (isSha256(configuredHash) && equalHash(tokenHash, configuredHash.toLowerCase())) return cabinClass;
  }
  return null;
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const configuredHash = import.meta.env.VITE_PASSCODE_HASH ?? '';
  if (!passcode || passcode.length > 160 || !isSha256(configuredHash)) return false;
  return equalHash(await sha256Hex(passcode), configuredHash.toLowerCase());
}

export function scopeForClass(cabinClass: CabinClass): InvitationScope {
  return cabinClass === 'business' || cabinClass === 'first' ? 'both-days' : 'day22';
}

export function appsScriptUrl(): string {
  const configured = import.meta.env.VITE_APPS_SCRIPT_URL ?? '';
  if (!configured) return '';
  try {
    const url = new URL(configured);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && url.pathname.endsWith('/exec')
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

export function rsvpStatus(): RsvpStatus {
  const configured = import.meta.env.VITE_RSVP_STATUS;
  if (configured === 'closed') return 'closed';
  if (configured === 'open' && appsScriptUrl()) return 'open';
  return 'preview';
}

export function invitationForClass(cabinClass: CabinClass): Invitation {
  const scope = scopeForClass(cabinClass);
  const events = scope === 'both-days' ? [day21, day22] : [day22];
  return {
    cabinClass,
    cabinLabel: labels[cabinClass],
    scope,
    flightCode: events.map((event) => event.flightCode).join(' / '),
    events,
    passengerLabel: { en: 'Honoured Guest', ms: 'Tetamu Yang Dihormati' },
    hotel: 'Crowne Plaza at Changi Airport',
    ballroom: 'Chengal',
    terminal: '3',
    rsvpStatus: rsvpStatus(),
    rsvpDeadline: {
      en: 'Kindly respond by Sunday, 8 August 2027.',
      ms: 'Sila sahkan kehadiran selewat-lewatnya Ahad, 8 Ogos 2027.',
    },
  };
}
