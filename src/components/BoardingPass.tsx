import { useEffect, useRef, useState } from 'react';
import { copy } from '../copy';
import { hapticTap } from '../haptics';
import { firstScenesReady, openingScenesReady } from '../preload';
import type { Invitation, InvitationEvent, Locale } from '../types';
import { localized } from '../types';
import '../boarding-pass.css';

type BoardingPassProps = {
  invitation: Invitation;
  locale: Locale;
  guestName?: string;
  compact?: boolean;
  stamped?: boolean;
  /** Runs synchronously inside the tap, e.g. to start opt-in music. */
  onScan?: () => void;
  onBoard?: () => void;
};

type Timeline = { kill: () => void };

function stubDate(event: InvitationEvent, locale: Locale) {
  const [year, , day] = event.dateIso.split('-');
  return { day, month: locale === 'en' ? 'AUG' : 'OGOS', year };
}

function cabinTitle(invitation: Invitation, locale: Locale): string {
  const label = localized(invitation.cabinLabel, locale);
  return locale === 'ms' || /class/i.test(label) ? label : `${label} Class`;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function BoardingPass({ invitation, locale, guestName, compact = false, stamped = false, onScan, onBoard }: BoardingPassProps) {
  const t = copy[locale];
  const logo = `${import.meta.env.BASE_URL}monogram-a-and-n-display.webp`;
  const [isScanning, setIsScanning] = useState(false);
  const boardingTimer = useRef<number | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);
  const mountedRef = useRef(true);
  const classTitle = cabinTitle(invitation, locale);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (boardingTimer.current !== null) window.clearTimeout(boardingTimer.current);
      timelineRef.current?.kill();
    };
  }, []);

  const playTear = () => {
    const stack = stackRef.current;
    if (!stack) return;
    // GSAP is already cached by the check-in preload; the boarding timer below
    // never depends on this decorative sequence finishing.
    void import('../motion/gsap').then(({ gsap }) => {
      if (!mountedRef.current) return;
      const passes = stack.querySelectorAll('.full-ticket');
      const stubs = stack.querySelectorAll('.ticket-paper-stub');
      const beams = stack.querySelectorAll('.ticket-scan-beam');
      const timeline = gsap.timeline();
      timeline
        .fromTo(beams, { top: '3%', opacity: 0 }, { top: '96%', opacity: 1, duration: 0.55, ease: 'sine.inOut' })
        .to(beams, { opacity: 0, duration: 0.12 }, '>-0.08')
        .to(stubs, { yPercent: 55, rotation: -7, opacity: 0, transformOrigin: '8% 0%', duration: 0.42, ease: 'power2.in', stagger: 0.06 }, 0.42)
        .add(() => hapticTap(14), 0.46)
        .to(passes, { y: -36, rotationX: 7, opacity: 0, duration: 0.32, ease: 'power2.in', stagger: 0.04 }, 0.7);
      timelineRef.current = timeline;
    }).catch(() => undefined);
  };

  const scanAndBoard = () => {
    if (!onBoard || boardingTimer.current !== null) return;
    onScan?.();
    setIsScanning(true);
    const reducedMotion = prefersReducedMotion();
    if (!reducedMotion) playTear();
    boardingTimer.current = window.setTimeout(() => {
      // Board as soon as the opening scenes are decoded. When the network is
      // slow, wait a little longer (never more than 700 ms) for a smooth start.
      if (openingScenesReady()) onBoard();
      else void firstScenesReady(700).then(() => { if (mountedRef.current) onBoard(); });
    }, reducedMotion ? 80 : 905);
  };

  return (
    <div ref={stackRef} className={`ticket-stack ticket-stack--midnight cabin-${invitation.cabinClass}${compact ? ' ticket-stack--compact' : ''}${onBoard ? ' ticket-stack--boardable' : ''}${isScanning ? ' ticket-stack--scanning' : ''}`}>
      {onBoard ? (
        <p className="ticket-scan-instruction" role="status" aria-live="polite">
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4M3 12h18" />
          </svg>
          {isScanning ? t.scanningTicket : t.scanTicket}
        </p>
      ) : null}
      {invitation.events.map((event) => {
        const date = stubDate(event, locale);
        return (
          <article
            className={`boarding-pass full-ticket${compact ? ' boarding-pass--compact' : ''}`}
            key={event.id}
            aria-label={`${localized(invitation.cabinLabel, locale)} · ${event.flightCode} · ${localized(event.dateLabel, locale)}`}
          >
            <header className="ticket-paper-header">
              <span className="ticket-paper-brand"><b>A&amp;N</b><span>OUR FLIGHT</span></span>
              <strong>{classTitle}</strong>
            </header>

            <div className="ticket-paper-body">
              <img className="ticket-paper-watermark" src={logo} width="200" height="200" alt="" aria-hidden="true" />
              <div className="ticket-paper-passenger">
                <div><span className="ticket-paper-label">{t.passenger}</span><strong>{guestName?.trim() || localized(invitation.passengerLabel, locale)}</strong></div>
                <div><span className="ticket-paper-label">{t.flight}</span><strong className="ticket-paper-code">{event.flightCode}</strong></div>
              </div>

              <div className="ticket-paper-route">
                <div><span className="ticket-paper-label">{t.departure}</span><strong>SIN</strong><span>Singapore</span></div>
                <span className="ticket-paper-flightpath" aria-hidden="true">
                  <svg viewBox="0 0 32 32"><path d="m27 15-9-5V4c0-3-4-3-4 0v6l-9 5v3l9-3v8l-4 3v2l6-2 6 2v-2l-4-3v-8l9 3Z" /></svg>
                </span>
                <div><span className="ticket-paper-label">{t.destination}</span><strong className="foil-text">A&amp;N</strong><span>Aleem &amp; Nurulain</span></div>
              </div>

              <time className="ticket-paper-date" dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time>
              <dl className="ticket-paper-events">
                {event.segments.map((segment, index) => (
                  <div key={`${event.id}-ticket-${index}`}>
                    <dt>{localized(segment.title, locale)}</dt>
                    <dd>{segment.time}</dd>
                  </div>
                ))}
              </dl>

              <dl className="ticket-paper-fields">
                <div className="ticket-paper-venue"><dt>{t.hotel}</dt><dd>{invitation.hotel}</dd></div>
                <div><dt>{t.ballroom}</dt><dd>{invitation.ballroom}</dd></div>
                <div><dt>{t.terminal}</dt><dd>{invitation.terminal}</dd></div>
              </dl>
              <span className="ticket-scan-beam" aria-hidden="true" />
            </div>

            <aside className="ticket-paper-stub" aria-hidden="true">
              <div className="ticket-paper-stub-date"><strong>{date.day}</strong><span>{date.month}<br />{date.year}</span></div>
              <div className="ticket-paper-stub-details"><strong>{event.flightCode}</strong><span>{classTitle}</span><span><span>{invitation.ballroom}</span> · T{invitation.terminal}</span></div>
              <span className="ticket-paper-barcode" />
            </aside>

            <p className="ticket-paper-keepsake">{t.keepsake}</p>
            <div className={`boarding-stamp${stamped ? ' boarding-stamp--visible' : ''}`} aria-hidden="true">
              <strong>A&amp;N</strong><span>BOARDING</span><small>OUR FLIGHT</small>
            </div>
          </article>
        );
      })}

      {onBoard ? (
        <button className="ticket-scan-action" type="button" disabled={isScanning}
          aria-label={isScanning ? t.scanningTicket : t.scanTicket} onClick={scanAndBoard}>
          <span className="visually-hidden">{isScanning ? t.scanningTicket : t.scanTicket}</span>
        </button>
      ) : null}
    </div>
  );
}
