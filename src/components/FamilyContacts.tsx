import { dockCopy } from '../dockCopy';
import { contactGreeting, telUrl, whatsAppUrl, type FamilyContact } from '../familyContacts';
import type { InvitationEvent, Locale } from '../types';

// Same drawn family as Icons.tsx: 1.6px round strokes on a 24px grid.
const ChatIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4.5 19.5 6 15.6A7.5 7.5 0 1 1 9 18.6l-4.5.9Z" /><path d="M9 10.5h6M9 13.5h4" />
  </svg>
);

type FamilyContactsProps = {
  contacts: readonly FamilyContact[];
  events: readonly InvitationEvent[];
  locale: Locale;
};

/**
 * WhatsApp (and call) buttons for the guest's hosting family. Shown only after
 * unlock and only for the days the guest is invited to.
 */
export function FamilyContacts({ contacts, events, locale }: FamilyContactsProps) {
  const d = dockCopy[locale];
  if (!contacts.length) return null;
  return (
    <section className="family-contacts" aria-labelledby="family-contacts-title">
      <h4 id="family-contacts-title">{d.contactsTitle}</h4>
      <p className="family-contacts-intro">{d.contactsIntro}</p>
      <ul>
        {contacts.map((contact) => (
          <li key={contact.phone} className="family-contact">
            <div className="family-contact-who">
              <strong>{contact.name}</strong>
              {contact.role ? <span>{contact.role[locale]}</span> : null}
            </div>
            <div className="family-contact-actions">
              <a className="button button-secondary family-contact-whatsapp" href={whatsAppUrl(contact, contactGreeting(contact, events, locale))} target="_blank" rel="noreferrer" aria-label={d.messageLabel(contact.name)}>
                <ChatIcon />{d.whatsApp}
              </a>
              <a className="button button-text family-contact-call" href={telUrl(contact)} aria-label={d.callLabel(contact.name)}>{d.call}</a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
