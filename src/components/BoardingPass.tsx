import { useEffect, useRef, useState } from 'react';
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

function cabinTitle(invitation: Invitation, locale: Locale): string {
  const label = localized(invitation.cabinLabel, locale);
  if (locale === 'ms' || /class/i.test(label)) return label;
  return `${label} Class`;
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
  const [isScanning, setIsScanning] = useState(false);
  const boardingTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (boardingTimer.current !== null) window.clearTimeout(boardingTimer.current);
  }, []);

  const scanAndBoard = () => {
    if (!onBoard || boardingTimer.current !== null) return;
    setIsScanning(true);
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    boardingTimer.current = window.setTimeout(onBoard, reducedMotion ? 80 : 905);
  };

  return (
    <div className={`ticket-stack cabin-${invitation.cabinClass}${compact ? ' ticket-stack--compact' : ''}${onBoard ? ' ticket-stack--boardable' : ''}${isScanning ? ' ticket-stack--scanning' : ''}`}>
      {onBoard ? (
        <p className="ticket-scan-instruction" role="status" aria-live="polite">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M9 11V5a2 2 0 0 1 4 0v5l1-1a2 2 0 0 1 3 1 2 2 0 0 1 3 2v4c0 4-2 6-6 6h-1c-2 0-3-1-4-2l-4-5a2 2 0 0 1 3-2l1 1v-3Z" />
            <path d="M5 5H2m4-3L4 1m11 2 2-2" />
          </svg>
          {isScanning ? t.scanningTicket : t.scanTicket}
        </p>
      ) : null}
      {invitation.events.map((event) => {
        const date = stubDate(event, locale);
        const classTitle = cabinTitle(invitation, locale);
        return (
          <article
            className={`boarding-pass full-ticket${compact ? ' boarding-pass--compact' : ''}`}
            key={event.id}
            aria-label={`${localized(invitation.cabinLabel, locale)} · ${event.flightCode} · ${localized(event.dateLabel, locale)}`}
          >
            <div className="ticket-class-band" aria-hidden="true">
              <div className="ticket-band-main">
                <span className="ticket-band-brand"><b>A&amp;N</b><em>OUR FLIGHT</em></span>
                <strong>{classTitle}</strong>
              </div>
              <div className="ticket-band-stub"><span>{classTitle}</span></div>
            </div>

            <div className="ticket-main">
              <img className="ticket-watermark" src={logo} alt="" aria-hidden="true" />
              <div className="ticket-topline">
                <span>{t.passenger} · {localized(invitation.passengerLabel, locale)}</span>
                <span>{event.flightCode} · {date.day} {date.month} {date.year}</span>
              </div>

              <div className="route-row">
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
                <div className="ticket-field-passenger"><dt>{t.passenger}</dt><dd>{localized(invitation.passengerLabel, locale)}</dd></div>
                <div className="ticket-field-flight"><dt>{t.flight}</dt><dd>{event.flightCode}</dd></div>
                <div className="ticket-field-time"><dt>{t.eventTime}</dt><dd>{event.time}</dd></div>
                <div className="ticket-field-gate"><dt>{t.gate}</dt><dd>{invitation.hotel}</dd></div>
                <div><dt>{t.ballroom}</dt><dd>{invitation.ballroom}</dd></div>
                <div><dt>{t.terminal}</dt><dd>{invitation.terminal}</dd></div>
              </dl>
              <p className="ticket-keepsake-mobile">{t.keepsake}</p>
            </div>

            <div className="ticket-stub" aria-hidden="true">
              <span className="stub-class">{classTitle}</span>
              <span className="stub-flight">{event.flightCode}</span>
              <span className="stub-date">{date.day}</span>
              <span className="stub-month">{date.month} {date.year}</span>
              <div className="stub-meta">
                <span><small>{t.terminal}</small><strong>{invitation.terminal}</strong></span>
                <span><small>{t.ballroom}</small><strong>{invitation.ballroom}</strong></span>
              </div>
              <i />
              <small className="stub-keepsake">{t.keepsake}</small>
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
        <button
          className="ticket-scan-action"
          type="button"
          disabled={isScanning}
          aria-label={isScanning ? t.scanningTicket : t.scanTicket}
          onClick={scanAndBoard}
        >
          <span className="visually-hidden">{isScanning ? t.scanningTicket : t.scanTicket}</span>
        </button>
      ) : null}
    </div>
  );
}
