import { describe, expect, it, vi } from 'vitest';
import {
  contactGreeting,
  contactsForEvents,
  familyContacts,
  telUrl,
  whatsAppUrl,
  type FamilyContact,
} from '../familyContacts';
import { invitationForClass } from '../invitations';

// Deliberately fake numbers throughout; never replace these with real contacts.
const brideContact: FamilyContact = {
  day: 'day21',
  name: 'Wahab family example',
  role: { en: "Bride's father", ms: 'Bapa pengantin perempuan' },
  phone: '+6590000001',
};
const groomContact: FamilyContact = {
  day: 'day22',
  name: 'Jamal family example',
  phone: '+6580000002',
};

describe('familyContacts', () => {
  it('parses both days and trims names and optional translated roles', () => {
    const raw = JSON.stringify({
      day22: [{ name: `  ${groomContact.name}  `, phone: groomContact.phone }],
      day21: [{
        name: `  ${brideContact.name}  `,
        role: { en: `  ${brideContact.role!.en}  `, ms: `  ${brideContact.role!.ms}  ` },
        phone: brideContact.phone,
      }],
    });

    expect(familyContacts(raw)).toEqual([brideContact, groomContact]);
  });

  it('reads the current environment only when raw is undefined', () => {
    vi.stubEnv('VITE_FAMILY_CONTACTS', JSON.stringify({ day21: [brideContact] }));
    expect(familyContacts()).toEqual([brideContact]);
    expect(familyContacts(undefined)).toEqual([brideContact]);
    expect(familyContacts('')).toEqual([]);
    expect(familyContacts(JSON.stringify({ day22: [groomContact] }))).toEqual([groomContact]);

    vi.stubEnv('VITE_FAMILY_CONTACTS', undefined);
    expect(familyContacts()).toEqual([]);
  });

  it.each(['60000001', '80000002', '90000003'])(
    'adds +65 to the fake Singapore local number %s',
    (phone) => {
      expect(familyContacts(JSON.stringify({ day21: [{ name: 'Example', phone }] })))
        .toEqual([{ day: 'day21', name: 'Example', phone: `+65${phone}` }]);
    },
  );

  it.each([
    [' +65 (9000)-[0001] ', '+6590000001'],
    ['(8000) - 0002', '+6580000002'],
    ['+65\t6000\n0003', '+6560000003'],
  ])('strips whitespace, dashes and brackets from %s', (phone, normalized) => {
    expect(familyContacts(JSON.stringify({ day21: [{ name: 'Example', phone }] }))[0]?.phone)
      .toBe(normalized);
  });

  it('keeps valid items among malformed items without throwing', () => {
    const raw = JSON.stringify({ day21: [
      null, false, 42, 'invalid', [], {},
      { phone: '+6590000001' },
      { name: '   ', phone: '+6590000001' },
      { name: 123, phone: '+6590000001' },
      { name: 'Missing phone' },
      { name: 'Numeric phone', phone: 90000001 },
      { name: 'Invalid phone', phone: '+65notaphone' },
      brideContact,
      { name: 'Another example', phone: '+6580000002' },
    ] });

    expect(familyContacts(raw)).toEqual([
      brideContact,
      { day: 'day21', name: 'Another example', phone: '+6580000002' },
    ]);
  });

  it.each([
    '+1000000', '+1000000000000000', '+00000000',
    '70000001', '9000000', '900000001', '6590000001',
    '006590000001', '++6590000001', '+65/90000001',
    '+6590000001 ext 2', '+6590000001?text=hello',
  ])('drops the invalid fake phone %s', (phone) => {
    expect(familyContacts(JSON.stringify({ day21: [{ name: 'Example', phone }] }))).toEqual([]);
  });

  it.each(['+10000001', '+100000000000001'])(
    'accepts the international digit-count boundary %s',
    (phone) => {
      expect(familyContacts(JSON.stringify({ day21: [{ name: 'Example', phone }] }))[0]?.phone)
        .toBe(phone);
    },
  );

  it.each(['', 'not JSON', '{', 'null', 'true', '42', '"text"', '[]'])(
    'returns no contacts for invalid JSON or a non-object root: %s',
    (raw) => expect(familyContacts(raw)).toEqual([]),
  );

  it('ignores unknown days while keeping known days', () => {
    expect(familyContacts(JSON.stringify({
      day20: [brideContact],
      day23: [groomContact],
      day21: [brideContact],
    }))).toEqual([brideContact]);
    expect(familyContacts(JSON.stringify({ day23: [groomContact] }))).toEqual([]);
  });

  it('skips malformed day lists while keeping valid days', () => {
    expect(familyContacts(JSON.stringify({ day21: {}, day22: [groomContact] })))
      .toEqual([groomContact]);
    expect(familyContacts(JSON.stringify({ day21: [brideContact], day22: null })))
      .toEqual([brideContact]);
  });

  it('trims and caps names and both translated roles at 60 characters', () => {
    const name = 'N'.repeat(70);
    const en = 'E'.repeat(70);
    const ms = 'M'.repeat(70);
    expect(familyContacts(JSON.stringify({ day21: [{
      name: `  ${name}  `,
      role: { en: `  ${en}  `, ms: `  ${ms}  ` },
      phone: brideContact.phone,
    }] }))).toEqual([{
      day: 'day21',
      name: name.slice(0, 60),
      role: { en: en.slice(0, 60), ms: ms.slice(0, 60) },
      phone: brideContact.phone,
    }]);
  });

  it.each([null, 'Father', [], {}, { en: 'Father' }, { en: 'Father', ms: '  ' }, { en: 42, ms: 'Bapa' }])(
    'omits a malformed optional role (%j) without dropping the contact',
    (role) => {
      expect(familyContacts(JSON.stringify({ day22: [{ ...groomContact, role }] })))
        .toEqual([groomContact]);
    },
  );

  it('keeps only the first three valid contacts per day', () => {
    const entries = [1, 2, 3, 4].map((index) => ({
      name: `Example ${index}`,
      phone: `+659000000${index}`,
    }));
    const raw = JSON.stringify({
      day21: [null, entries[0], { name: 'Invalid', phone: 'bad' }, ...entries.slice(1)],
      day22: entries,
    });

    expect(familyContacts(raw)).toEqual([
      ...entries.slice(0, 3).map((entry) => ({ day: 'day21', ...entry })),
      ...entries.slice(0, 3).map((entry) => ({ day: 'day22', ...entry })),
    ]);
  });
});

describe('contactsForEvents', () => {
  const contacts: readonly FamilyContact[] = Object.freeze([groomContact, brideContact]);

  it('returns only day21 contacts for a day21 invitation', () => {
    expect(contactsForEvents(contacts, [{ id: 'day21' }])).toEqual([brideContact]);
  });

  it('returns only day22 contacts for a day22 invitation', () => {
    expect(contactsForEvents(contacts, [{ id: 'day22' }])).toEqual([groomContact]);
  });

  it('returns both days in event order, independently of contact order', () => {
    expect(contactsForEvents(contacts, [{ id: 'day21' }, { id: 'day22' }]))
      .toEqual([brideContact, groomContact]);
    expect(contactsForEvents(contacts, [{ id: 'day22' }, { id: 'day21' }]))
      .toEqual([groomContact, brideContact]);
  });

  it('deduplicates phones within and across days and repeated events', () => {
    const sharedContact: FamilyContact = { ...brideContact, day: 'day22', name: 'Shared example' };
    expect(contactsForEvents(
      [groomContact, sharedContact, brideContact, { ...brideContact, name: 'Duplicate example' }],
      [{ id: 'day21' }, { id: 'day22' }, { id: 'day21' }],
    )).toEqual([brideContact, groomContact]);
    expect(contactsForEvents(
      [brideContact, sharedContact],
      [{ id: 'day22' }, { id: 'day21' }],
    )).toEqual([sharedContact]);
  });

  it('preserves contact order within each selected day', () => {
    const anotherContact: FamilyContact = { day: 'day21', name: 'Another example', phone: '+6560000003' };
    expect(contactsForEvents([anotherContact, groomContact, brideContact], [{ id: 'day21' }]))
      .toEqual([anotherContact, brideContact]);
  });

  it('returns no contacts for empty inputs or unknown events', () => {
    expect(contactsForEvents(contacts, [])).toEqual([]);
    expect(contactsForEvents([], [{ id: 'day21' }])).toEqual([]);
    expect(contactsForEvents(contacts, [{ id: 'day23' }])).toEqual([]);
  });
});

describe('family contact links', () => {
  it('encodes spaces, ampersands, and Malay characters in the WhatsApp greeting', () => {
    const text = 'Salam keluarga & pengantin — سلامت داتڠ!';
    const url = whatsAppUrl(brideContact, text);

    expect(url).toBe(`https://wa.me/6590000001?text=${encodeURIComponent(text)}`);
    expect(url).not.toContain('+');
    expect(url).toContain('%20');
    expect(url).toContain('%26');
    expect(url).toContain('%E2%80%94');
    expect(url).toContain('%D8%B3');
    expect(new URL(url).searchParams.get('text')).toBe(text);
  });

  it('supports an empty WhatsApp greeting', () => {
    expect(whatsAppUrl(groomContact, '')).toBe('https://wa.me/6580000002?text=');
  });

  it('formats a telephone link with the leading plus', () => {
    expect(telUrl(brideContact)).toBe('tel:+6590000001');
  });
});

describe('contactGreeting', () => {
  const events = invitationForClass('business').events;

  it.each([
    [brideContact, 'en', "Assalamualaikum, I'm a guest at Aleem & Nurulain's wedding on Saturday, 21 August 2027."],
    [groomContact, 'en', "Assalamualaikum, I'm a guest at Aleem & Nurulain's wedding on Sunday, 22 August 2027."],
    [brideContact, 'ms', 'Assalamualaikum, saya tetamu majlis perkahwinan Aleem & Nurulain pada Sabtu, 21 Ogos 2027.'],
    [groomContact, 'ms', 'Assalamualaikum, saya tetamu majlis perkahwinan Aleem & Nurulain pada Ahad, 22 Ogos 2027.'],
  ] as const)('greets %s in %s using that contact\'s event date', (contact, locale, expected) => {
    expect(contactGreeting(contact, events, locale)).toBe(expected);
  });

  it.each(['en', 'ms'] as const)('safely falls back in %s when the contact has no matching event', (locale) => {
    for (const availableEvents of [[], events.filter((event) => event.id === 'day22')]) {
      let greeting = '';
      expect(() => { greeting = contactGreeting(brideContact, availableEvents, locale); }).not.toThrow();
      // Without a date the sentence ends cleanly, never with "on ." / "pada .".
      expect(greeting).toBe(locale === 'en'
        ? "Assalamualaikum, I'm a guest at Aleem & Nurulain's wedding."
        : 'Assalamualaikum, saya tetamu majlis perkahwinan Aleem & Nurulain.');
      expect(greeting).not.toMatch(/undefined|null/);
      for (const event of events) expect(greeting).not.toContain(event.dateLabel[locale]);
    }
  });
});
