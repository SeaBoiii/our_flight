import { copy } from '../copy';
import type { Invitation, InvitationEvent, Locale } from '../types';
import { localized } from '../types';

type BoardingPassProps = {
  invitation: Invitation;
  locale: Locale;
  compact?: boolean;
  stamped?: boolean;
  onBoard?: () => void;
};

function stubDate(event: InvitationEvent, locale: Locale) {
  const [year, , day] = event.dateIso.split('-');
  return {
    day,
    month: locale === 'en' ? 'AUG' : 'OGOS',
    year,
  };
}

export function BoardingPass({
  invitation,
  locale,
  compact = false,
  stamped = false,
  onBoard,
}: BoardingPassProps) {
  const t = copy[locale];
  const logo = `${import.meta.env.BASE_URL}monogram-a-and-n-display.png`;

  return (
    <div className={`ticket-stack cabin-${invitation.cabinClass}${compact ? ' ticket-stack--compact' : ''}`}>
      {invitation.events.map((event) => {
        const date = stubDate(event, locale);
        return (
          <article
            className={`boarding-pass full-ticket${compact ? ' boarding-pass--compact' : ''}`}
            key={event.id}
            aria-label={`${localized(invitation.cabinLabel, locale)} · ${event.flightCode} · ${localized(event.dateLabel, locale)}`}
          >
            <div className="ticket-main">
              <img className="ticket-watermark" src={logo} alt="" aria-hidden="true" />
              <div className="ticket-topline">
                <span>OUR FLIGHT · ALEEM &amp; NURULAIN</span>
                <span>{localized(invitation.cabinLabel, locale)}</span>
              </div>

              <div className="route-row" aria-label={`${t.departure}: SIN. ${t.destination}: Crowne Plaza, Changi Airport`}>
                <div>
                  <span className="field-label">{t.departure}</span>
                  <strong>SIN</strong>
                  <span>Singapore</span>
                </div>
                <div className="route-line" aria-hidden="true"><span>✦</span></div>
                <div className="route-destination">
                  <span className="field-label">{t.destination}</span>
                  <strong>CROWNE PLAZA</strong>
                  <span>Changi Airport</span>
                </div>
              </div>

              <div className="ticket-event-title">
                {event.segments.map((segment, index) => (
                  <span key={`${event.id}-ticket-${index}`}>
                    <strong>{localized(segment.title, locale)}</strong>
                    <time>{segment.time}</time>
                  </span>
                ))}
              </div>
              <dl className="ticket-fields">
                <div><dt>{t.passenger}</dt><dd>{localized(invitation.passengerLabel, locale)}</dd></div>
                <div><dt>{t.flight}</dt><dd>{event.flightCode}</dd></div>
                <div><dt>{t.eventTime}</dt><dd>{event.time}</dd></div>
                <div className="ticket-field-gate"><dt>{t.gate}</dt><dd>{invitation.hotel}</dd></div>
                <div><dt>{t.ballroom}</dt><dd>{invitation.ballroom}</dd></div>
                <div><dt>{t.terminal}</dt><dd>{invitation.terminal}</dd></div>
              </dl>
              <p className="ticket-keepsake-mobile">{t.keepsake}</p>
            </div>

            <div className="ticket-stub" aria-hidden="true">
              <span className="stub-date">{date.day}</span>
              <span>{date.month}</span>
              <span>{date.year}</span>
              <i />
              <small>{t.keepsake}</small>
            </div>

            <div className={`boarding-stamp${stamped ? ' boarding-stamp--visible' : ''}`} aria-hidden="true">
              <strong>A&amp;N</strong>
              <span>BOARDING</span>
              <small>OUR FLIGHT</small>
            </div>
          </article>
        );
      })}

      {onBoard ? (
        <button className="button button-primary ticket-board" type="button" onClick={onBoard}>
          <span>{t.board}</span><span aria-hidden="true">→</span>
        </button>
      ) : null}
    </div>
  );
}
