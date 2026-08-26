import { useEffect, useRef, useState } from 'react';
import { downloadCalendar } from '../calendar';
import { copy } from '../copy';
import type { Invitation, Locale } from '../types';
import { localized } from '../types';
import { Journey } from './Journey';
import { LanguageToggle } from './LanguageToggle';
import { RsvpForm } from './RsvpForm';

type InvitationExperienceProps = {
  invitation: Invitation;
  invitationToken: string;
  fingerprint: string;
  locale: Locale;
  reducedMotion: boolean;
  onBack: () => void;
  onToggleLocale: () => void;
};

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=Crowne+Plaza+Changi+Airport%2C+75+Airport+Boulevard%2C+Singapore+819664';

export default function InvitationExperience({
  invitation,
  invitationToken,
  fingerprint,
  locale,
  reducedMotion,
  onBack,
  onToggleLocale,
}: InvitationExperienceProps) {
  const t = copy[locale];
  const [calendarBusy, setCalendarBusy] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const experienceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let settleFrame = 0;
    let settleTimer = 0;
    const resetScroll = () => {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      root.style.scrollBehavior = previousBehavior;
    };
    const frame = window.requestAnimationFrame(() => {
      resetScroll();
      experienceRef.current?.focus({ preventScroll: true });
      // A second frame wins over scroll anchoring when the 360svh sticky
      // journey is replaced by the shorter reduced-motion reading order.
      settleFrame = window.requestAnimationFrame(() => {
        resetScroll();
        settleTimer = window.setTimeout(() => {
          resetScroll();
          experienceRef.current?.focus();
        }, 80);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimer);
    };
  }, [reducedMotion]);

  const handleCalendar = (eventId: string) => {
    setCalendarBusy(eventId);
    setCalendarError(null);
    try {
      const event = invitation.events.find((candidate) => candidate.id === eventId);
      if (!event) throw new Error('Unknown calendar event');
      downloadCalendar(event, locale);
    } catch {
      setCalendarError(eventId);
    } finally {
      setCalendarBusy(null);
    }
  };

  return (
    <main ref={experienceRef} className={`experience cabin-${invitation.cabinClass}`} tabIndex={-1} aria-label={t.journeyLabel}>
      <nav className="experience-nav" aria-label={t.controls}>
        <button className="experience-back" type="button" aria-label={t.back} onClick={onBack}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6m5-5-5 5 5 5" /></svg>
          <span>{t.back}</span>
        </button>
        <LanguageToggle locale={locale} label={t.language} onToggle={onToggleLocale} />
      </nav>

      <Journey invitation={invitation} locale={locale} reducedMotion={reducedMotion} />

      <section id="invitation" className="invitation-reveal" tabIndex={-1}>
        <div className="invitation-card">
          <img className="invitation-logo" src={`${import.meta.env.BASE_URL}monogram-a-and-n-display.png`} alt="Aleem and Nurulain" />
          <p className="bismillah">{t.bismillah}</p>
          <p className="salam">{t.salam}</p>
          <p className="formal-copy">{t.formalInvite}</p>
          <h1>Aleem <span>&amp;</span> Nurulain</h1>
          <p className="blessing">{t.blessing}</p>
        </div>
      </section>

      <section className="itinerary-section" aria-labelledby="itinerary-title">
        <div className="section-heading">
          <p className="eyebrow">{localized(invitation.cabinLabel, locale)}</p>
          <h2 id="itinerary-title">{t.itinerary}</h2>
          <p>{t.singaporeTime}</p>
        </div>

        <div className="itinerary-list">
          {invitation.events.map((event) => (
            <article className="itinerary-card" key={event.id}>
              <header>
                <span>{event.flightCode}</span>
                <time dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time>
              </header>
              <h3>{localized(event.title, locale)}</h3>
              <p className="itinerary-time">{event.time}</p>
              <ul className="event-segments">
                {event.segments.map((segment, index) => (
                  <li key={`${event.id}-${index}`}>
                    <span>{localized(segment.title, locale)}</span>
                    <strong>{segment.time}</strong>
                  </li>
                ))}
              </ul>
              <dl className="venue-fields">
                <div><dt>{t.hotel}</dt><dd>{invitation.hotel}</dd></div>
                <div><dt>{t.ballroom}</dt><dd>{invitation.ballroom}</dd></div>
                <div><dt>{t.terminal}</dt><dd>{invitation.terminal}</dd></div>
              </dl>
              <div className="itinerary-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={calendarBusy === event.id}
                  onClick={() => handleCalendar(event.id)}
                >
                  {calendarBusy === event.id ? t.calendarBusy : t.calendar}
                </button>
                <a
                  className="button button-secondary"
                  href={mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${t.directions} (${t.newTab})`}
                >
                  {t.directions}
                </a>
              </div>
              {calendarError === event.id ? <p className="field-error" role="alert">{t.calendarFailed}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="travel-section" aria-labelledby="travel-title">
        <div>
          <p className="eyebrow">{t.venue}</p>
          <h2 id="travel-title">{t.gettingHere}</h2>
          <address>{invitation.hotel}<br />{t.address}</address>
        </div>
        <ul>
          <li>{t.travelMrt}</li>
          <li>{t.travelJewel}</li>
          <li>{t.travelCar}</li>
          <li>{t.travelParking}</li>
        </ul>
        <p>{t.travelTime}</p>
      </section>

      <RsvpForm
        invitation={invitation}
        invitationToken={invitationToken}
        fingerprint={fingerprint}
        locale={locale}
      />

      <footer className="site-footer">
        <img src={`${import.meta.env.BASE_URL}monogram-a-and-n-display.png`} alt="" />
        <p>{t.footer}</p>
      </footer>
    </main>
  );
}
