import { copy } from '../copy';
import type { Invitation, Locale } from '../types';
import { localized } from '../types';

type BoardingPassProps = {
  invitation: Invitation;
  locale: Locale;
  compact?: boolean;
  stamped?: boolean;
  onBoard?: () => void;
};

export function BoardingPass({
  invitation,
  locale,
  compact = false,
  stamped = false,
  onBoard,
}: BoardingPassProps) {
  const t = copy[locale];

  return (
    <article
      className={`boarding-pass cabin-${invitation.cabinClass}${compact ? ' boarding-pass--compact' : ''}`}
      aria-label={`${localized(invitation.cabinLabel, locale)} ${t.flight}`}
    >
      <div className="ticket-watermark" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}an-monogram.svg`} alt="" />
      </div>

      <header className="ticket-header">
        <img
          className="ticket-logo"
          src={`${import.meta.env.BASE_URL}an-monogram.svg`}
          alt="Aleem and Nurulain"
        />
        <div className="ticket-class">
          <span>{t.flight}</span>
          <strong>{localized(invitation.cabinLabel, locale)}</strong>
        </div>
      </header>

      <div className="ticket-route" aria-label={`${t.departure}: SIN. ${t.destination}: Crowne Plaza, Changi Airport`}>
        <div>
          <span>{t.departure}</span>
          <strong>SIN</strong>
        </div>
        <div className="ticket-flight-path" aria-hidden="true">
          <span />
          <svg viewBox="0 0 34 20">
            <path d="M3 10h23m-8-7 9 7-9 7M8 6l-4 4 4 4" />
          </svg>
          <span />
        </div>
        <div className="ticket-arrival">
          <span>{t.destinationAirport}</span>
          <strong>{t.destinationName}</strong>
        </div>
      </div>

      <dl className="ticket-fields">
        <div>
          <dt>{t.passenger}</dt>
          <dd>{localized(invitation.passengerLabel, locale)}</dd>
        </div>
        <div className="ticket-field-wide">
          <dt>{t.hotel}</dt>
          <dd>{invitation.hotel}</dd>
        </div>
        <div>
          <dt>{t.ballroom}</dt>
          <dd>{invitation.ballroom}</dd>
        </div>
        <div>
          <dt>{t.terminal}</dt>
          <dd>{invitation.terminal}</dd>
        </div>
      </dl>

      <div className="ticket-sectors">
        {invitation.events.map((event) => (
          <section className="ticket-sector" key={event.id}>
            <div>
              <span>{t.flight}</span>
              <strong>{event.flightCode}</strong>
            </div>
            <div>
              <span>{t.event}</span>
              <strong>{localized(event.title, locale)}</strong>
            </div>
            <div>
              <time dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time>
              <strong>{event.time}</strong>
            </div>
          </section>
        ))}
      </div>

      <footer className="ticket-footer">
        <span>{t.keepsake}</span>
        <span className="ticket-code" aria-hidden="true">A N 2 0 2 7</span>
      </footer>

      <div className={`boarding-stamp${stamped ? ' boarding-stamp--visible' : ''}`} aria-hidden="true">
        <strong>A&amp;N</strong>
        <span>BOARDING</span>
        <small>OUR FLIGHT</small>
      </div>

      {onBoard ? (
        <button className="button button-primary ticket-board" type="button" onClick={onBoard}>
          <span>{t.board}</span>
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M5 12h13m-5-5 5 5-5 5" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}
