import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FamilyContacts } from '../components/FamilyContacts';
import type { FamilyContact } from '../familyContacts';
import { invitationForClass } from '../invitations';

// Deliberately fake numbers throughout; never replace these with real contacts.
const brideContact: FamilyContact = {
  day: 'day21',
  name: 'Wahab family (test)',
  role: { en: "Bride's father", ms: 'Bapa pengantin perempuan' },
  phone: '+6590000001',
};
const groomContact: FamilyContact = {
  day: 'day22',
  name: 'Jamal family (test)',
  role: { en: "Groom's father", ms: 'Bapa pengantin lelaki' },
  phone: '+6580000002',
};
const events = invitationForClass('business').events;

const translations = [
  {
    locale: 'en',
    otherLocale: 'ms',
    heading: 'Questions? Message the family',
    call: 'Call',
    messageLabel: (name: string) => `Message ${name} on WhatsApp`,
    callLabel: (name: string) => `Call ${name}`,
    greetings: [
      "Assalamualaikum, I'm a guest at Aleem & Nurulain's wedding on Saturday, 21 August 2027.",
      "Assalamualaikum, I'm a guest at Aleem & Nurulain's wedding on Sunday, 22 August 2027.",
    ],
  },
  {
    locale: 'ms',
    otherLocale: 'en',
    heading: 'Ada pertanyaan? Hubungi keluarga',
    call: 'Telefon',
    messageLabel: (name: string) => `Hantar mesej WhatsApp kepada ${name}`,
    callLabel: (name: string) => `Telefon ${name}`,
    greetings: [
      'Assalamualaikum, saya tetamu majlis perkahwinan Aleem & Nurulain pada Sabtu, 21 Ogos 2027.',
      'Assalamualaikum, saya tetamu majlis perkahwinan Aleem & Nurulain pada Ahad, 22 Ogos 2027.',
    ],
  },
] as const;

describe.each(translations)('FamilyContacts in $locale', (copy) => {
  function expectContact(item: HTMLElement, contact: FamilyContact, greeting: string) {
    expect(within(item).getByText(contact.name)).toBeTruthy();
    if (contact.role) {
      expect(within(item).getByText(contact.role[copy.locale])).toBeTruthy();
      expect(within(item).queryByText(contact.role[copy.otherLocale])).toBeNull();
    }

    const message = within(item).getByRole('link', { name: copy.messageLabel(contact.name) });
    expect(message.textContent).toBe('WhatsApp');
    expect(message.getAttribute('href')).toBe(
      `https://wa.me/${contact.phone.slice(1)}?text=${encodeURIComponent(greeting)}`,
    );
    expect(message.getAttribute('target')).toBe('_blank');
    expect(message.getAttribute('rel')).toBe('noreferrer');

    const call = within(item).getByRole('link', { name: copy.callLabel(contact.name) });
    expect(call.textContent).toBe(copy.call);
    expect(call.getAttribute('href')).toBe(`tel:${contact.phone}`);
    expect(within(item).getAllByRole('link')).toHaveLength(2);
  }

  it('renders nothing for an empty contact list', () => {
    const { container } = render(<FamilyContacts contacts={[]} events={events} locale={copy.locale} />);
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('heading', { name: copy.heading })).toBeNull();
  });

  it('renders one contact with the localized heading, role, and accessible contact links', () => {
    render(<FamilyContacts contacts={[brideContact]} events={events} locale={copy.locale} />);

    const card = screen.getByRole('region', { name: copy.heading });
    expect(within(card).getByRole('heading', { level: 4, name: copy.heading })).toBeTruthy();
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expectContact(items[0], brideContact, copy.greetings[0]);
    expect(within(card).queryByText(groomContact.name)).toBeNull();
  });

  it('renders both contacts in order and names each contact\'s own date in its WhatsApp greeting', () => {
    render(<FamilyContacts contacts={[brideContact, groomContact]} events={events} locale={copy.locale} />);

    const card = screen.getByRole('region', { name: copy.heading });
    expect(within(card).getByRole('heading', { level: 4, name: copy.heading })).toBeTruthy();
    const items = within(card).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expectContact(items[0], brideContact, copy.greetings[0]);
    expectContact(items[1], groomContact, copy.greetings[1]);
  });

  it('omits the role line when the contact has no role', () => {
    const contactWithoutRole: FamilyContact = {
      day: groomContact.day,
      name: groomContact.name,
      phone: groomContact.phone,
    };
    render(<FamilyContacts contacts={[contactWithoutRole]} events={events} locale={copy.locale} />);

    const item = screen.getByRole('listitem');
    expectContact(item, contactWithoutRole, copy.greetings[1]);
    expect(within(item).getByText(contactWithoutRole.name).parentElement?.textContent).toBe(contactWithoutRole.name);
    expect(within(item).getByText(contactWithoutRole.name).parentElement?.childElementCount).toBe(1);
    expect(within(item).queryByText(groomContact.role!.en)).toBeNull();
    expect(within(item).queryByText(groomContact.role!.ms)).toBeNull();
  });
});
