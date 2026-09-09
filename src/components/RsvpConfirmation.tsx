import { useEffect, useRef } from 'react';
import { copy } from '../copy';
import { rsvpConfirmationCopy } from '../rsvpConfirmationCopy';
import type { Invitation, Locale, RsvpDraft } from '../types';
import { localized } from '../types';
import { EventActions } from './EventActions';
import '../rsvp-confirmation.css';

type RsvpConfirmationProps = {
  invitation: Invitation;
  locale: Locale;
  response: RsvpDraft;
  duplicate: boolean;
};

export function RsvpConfirmation({ invitation, locale, response, duplicate }: RsvpConfirmationProps) {
  const t = copy[locale];
  const confirmation = rsvpConfirmationCopy[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const answers = new Map(response.responses.map((answer) => [answer.eventId, answer]));
  const attendingCount = invitation.events.filter((event) => answers.get(event.id)?.attendance === 'attending').length;
  const tone = attendingCount === invitation.events.length ? 'attending' : attendingCount === 0 ? 'declining' : 'mixed';

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={`rsvp-confirmation rsvp-confirmation--${tone}`}>
      <header className="rsvp-confirmation__header">
        <div className="rsvp-confirmation__stamp" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none"><path d="m7 16 6 6L25 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>A&amp;N</span>
        </div>
        <div role="status" aria-live="polite" aria-atomic="true">
          <p className="eyebrow">{confirmation.received}</p>
          <h2 id="rsvp-title" ref={headingRef} tabIndex={-1}>{confirmation[`${tone}Title`]}</h2>
          <p className="rsvp-confirmation__message">{confirmation[`${tone}Body`]}</p>
        </div>
      </header>

      <dl className="rsvp-confirmation__passenger">
        <div><dt>{t.name}</dt><dd>{response.inviteeName.trim()}</dd></div>
        <div><dt>{confirmation.cabinClass}</dt><dd>{localized(invitation.cabinLabel, locale)}</dd></div>
      </dl>

      <div className="rsvp-confirmation__events">
        {invitation.events.map((event) => {
          const answer = answers.get(event.id);
          const attending = answer?.attendance === 'attending';
          return (
            <article className="rsvp-confirmation__event" key={event.id} aria-labelledby={`confirmed-${event.id}`}>
              <div className="rsvp-confirmation__flight">
                <span className="rsvp-confirmation__flight-code"><span className="visually-hidden">{t.flight} </span>{event.flightCode}</span>
                <span className={`rsvp-confirmation__attendance${attending ? ' rsvp-confirmation__attendance--attending' : ''}`}>
                  <span aria-hidden="true">{attending ? '\u2713' : '\u2014'}</span> {attending ? confirmation.attending : confirmation.declining}
                </span>
              </div>
              <p className="rsvp-confirmation__date"><time dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time></p>
              <h3 id={`confirmed-${event.id}`}>{localized(event.title, locale)}</h3>
              <p className="rsvp-confirmation__time">{event.time} <span>SGT</span></p>
              {attending ? (
                <>
                  <p className="rsvp-confirmation__party">{t.partySize}: <strong>{Number(answer.partySize)}</strong></p>
                  <EventActions event={event} locale={locale} directions={false} />
                </>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="rsvp-confirmation__venue">
        <p className="eyebrow">{t.venue}</p>
        <strong>{invitation.hotel}</strong>
        <p>{locale === 'ms' ? `${t.ballroom} ${invitation.ballroom}` : `${invitation.ballroom} ${t.ballroom}`} &middot; {t.terminal} {invitation.terminal}</p>
        <p>{t.singaporeTime}</p>
      </div>
      <p className="rsvp-confirmation__receipt">{duplicate ? t.duplicate : t.success}</p>
    </div>
  );
}
