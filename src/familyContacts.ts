import { dockCopy } from './dockCopy';
import { localized, type InvitationEvent, type Locale } from './types';

export type FamilyContact = {
  day: 'day21' | 'day22';
  name: string;
  role?: { en: string; ms: string };
  phone: string; // E.164 digits with leading +, e.g. +6590000001.
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function label(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 60).trim() : '';
}

function normalizePhone(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;

  const phone = value.replace(/[\s()[\]-]/g, '');
  if (/^[689]\d{7}$/.test(phone)) return `+65${phone}`;
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return phone;
  return undefined;
}

/**
 * Parses VITE_FAMILY_CONTACTS (or the given raw string, for tests), never throwing.
 * Invalid JSON, unknown days, missing names, and invalid phones are dropped item by item.
 * Phones strip spaces, dashes, and brackets and require 8–15 digits with a leading +,
 * or an 8-digit Singapore local number starting 6, 8, or 9. Names/roles are trimmed
 * and capped at 60 characters; each day keeps at most three valid contacts.
 */
export function familyContacts(raw?: string): FamilyContact[] {
  const source = raw === undefined ? import.meta.env.VITE_FAMILY_CONTACTS : raw;
  if (typeof source !== 'string') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];

  const contacts: FamilyContact[] = [];
  for (const day of ['day21', 'day22'] as const) {
    const entries = parsed[day];
    if (!Array.isArray(entries)) continue;

    let count = 0;
    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const name = label(entry.name);
      const phone = normalizePhone(entry.phone);
      if (!name || !phone) continue;

      const contact: FamilyContact = { day, name, phone };
      if (isRecord(entry.role)) {
        const en = label(entry.role.en);
        const ms = label(entry.role.ms);
        if (en && ms) contact.role = { en, ms };
      }
      contacts.push(contact);
      if (++count === 3) break;
    }
  }
  return contacts;
}

/** Contacts for the given events' days, in event order, de-duplicated by phone. */
export function contactsForEvents(
  contacts: readonly FamilyContact[],
  events: readonly { id: string }[],
): FamilyContact[] {
  const selected: FamilyContact[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    for (const contact of contacts) {
      if (contact.day !== event.id || seen.has(contact.phone)) continue;
      selected.push(contact);
      seen.add(contact.phone);
    }
  }
  return selected;
}

/** https://wa.me/<digits without +>?text=<encoded greeting> */
export function whatsAppUrl(contact: FamilyContact, text: string): string {
  return `https://wa.me/${contact.phone.slice(1)}?text=${encodeURIComponent(text)}`;
}

/** tel:+<digits> */
export function telUrl(contact: FamilyContact): string {
  return `tel:${contact.phone}`;
}

/** The greeting pre-typed into WhatsApp names the day this contact hosts. */
export function contactGreeting(contact: FamilyContact, events: readonly InvitationEvent[], locale: Locale): string {
  const event = events.find((candidate) => candidate.id === contact.day);
  return dockCopy[locale].greeting(event ? localized(event.dateLabel, locale) : '');
}
