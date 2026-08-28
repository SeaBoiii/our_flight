import { useEffect, useRef, useState } from 'react';
import { downloadCalendar } from '../calendar';
import { copy } from '../copy';
import type { AccessCredential, Invitation, Locale } from '../types';
import { localized } from '../types';
import { crownePlazaLogo } from '../venueLogo';
import { Journey } from './Journey';
import { LanguageToggle } from './LanguageToggle';
import { RsvpForm } from './RsvpForm';

type InvitationExperienceProps = {
  invitation: Invitation;
  accessCredential: AccessCredential;
  fingerprint: string;
  locale: Locale;
  reducedMotion: boolean;
  onBack: () => void;
  onToggleLocale: () => void;
};

const mapUrl = 'https://www.google.com/maps/search/?api=1&query=Crowne+Plaza+Changi+Airport%2C+75+Airport+Boulevard%2C+Singapore+819664';

function dateParts(label: string) {
  const [weekday, dated = ''] = label.split(/,\s*/, 2);
  const [day = '', ...monthAndYear] = dated.split(/\s+/);
  return { weekday, day, monthAndYear: monthAndYear.join(' ') };
}

export default function InvitationExperience({
  invitation,
  accessCredential,
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
          <p className="bismillah" lang="ar" dir="rtl">{t.bismillah}</p>
          <p className="salam">{t.salam}</p>
          <p className="formal-copy">{t.formalInvite}</p>
          <h1>Aleem <span>&amp;</span> Nurulain</h1>
          <p className="blessing">{t.blessing}</p>
        </div>
      </section>

      <section className="our-story-section" aria-labelledby="our-story-title">
        <div className="our-story-inner">
          <p className="eyebrow">Aleem &amp; Nurulain</p>
          <h2 id="our-story-title">{t.ourStory}</h2>
          <blockquote>
            <p>{t.storyQuote}</p>
          </blockquote>
          <div className="our-story-copy">
            <p>{t.storyBeginning}</p>
            <p>{t.storyJourney}</p>
            <p className="our-story-closing"><em>{t.storyClosing}</em></p>
          </div>
        </div>
      </section>

      <section className="itinerary-section" aria-labelledby="itinerary-title">
        <div className="section-heading">
          <p className="eyebrow">{localized(invitation.cabinLabel, locale)}</p>
          <h2 id="itinerary-title">{t.itinerary}</h2>
          <p>{t.singaporeTime}</p>
        </div>

        <div className="itinerary-list">
          {invitation.events.map((event) => {
            const displayDate = localized(event.dateLabel, locale);
            const date = dateParts(displayDate);
            return (
              <article className="itinerary-card" key={event.id}>
                <p className="itinerary-flight"><span>{event.flightCode}</span><span>{localized(invitation.cabinLabel, locale)}</span></p>
                <h3 className="itinerary-date">
                  <time dateTime={event.dateIso}>
                    <span className="itinerary-weekday" aria-hidden="true">{date.weekday}</span>
                    <span className="itinerary-date-core" aria-hidden="true">
                      <strong>{date.day}</strong>
                      <span>{date.monthAndYear}</span>
                    </span>
                    <span className="visually-hidden">{displayDate}</span>
                  </time>
                </h3>
                <div className="itinerary-event-heading">
                  <h4>{localized(event.title, locale)}</h4>
                  <p>{event.time}</p>
                </div>
                <ol className="event-programme">
                  {event.programme.map((item, index) => {
                    const placeholder = item.time === '--:--';
                    return (
                      <li key={`${event.id}-programme-${index}`}>
                        <span
                          className={`programme-time${placeholder ? ' programme-time--placeholder' : ''}`}
                          aria-label={placeholder ? t.programmeTimePlaceholder : undefined}
                        >
                          {item.time}
                        </span>
                        <span>{localized(item.title, locale)}</span>
                      </li>
                    );
                  })}
                </ol>
                <dl className="venue-fields">
                  <div className="venue-hotel">
                    <dt>{t.hotel}</dt>
                    <dd>
                      <span>{invitation.hotel}</span>
                      <img
                        className="venue-logo"
                        src={crownePlazaLogo}
                        width="140"
                        height="85"
                        loading="lazy"
                        decoding="async"
                        alt=""
                      />
                    </dd>
                  </div>
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
            );
          })}
        </div>
      </section>

      <details className="travel-section">
        <summary>
          <span className="travel-summary-copy">
            <span className="eyebrow">{t.venue}</span>
            <span className="travel-summary-title" role="heading" aria-level={2}>{t.gettingHere}</span>
            <span className="travel-summary-venue">{invitation.hotel} &middot; {t.terminal} {invitation.terminal}</span>
            <span className="travel-summary-action">{t.travelSummary}</span>
          </span>
          <span className="travel-summary-chevron" aria-hidden="true" />
        </summary>
        <div className="travel-details">
          <address>{invitation.hotel}<br />{t.address}</address>
          <ul>
            <li>{t.travelMrt}</li>
            <li>{t.travelJewel}</li>
            <li>{t.travelCar}</li>
            <li>{t.travelParking}</li>
          </ul>
          <p>{t.travelTime}</p>
        </div>
      </details>

      <RsvpForm
        invitation={invitation}
        accessCredential={accessCredential}
        fingerprint={fingerprint}
        locale={locale}
      />

      <footer className="site-footer">
        <img src={`${import.meta.env.BASE_URL}monogram-a-and-n-display.png`} alt="" />
        <p>{t.footer}</p>
        <small className="video-credit">
          Video:{' '}
          <a
            href="https://mixkit.co/free-stock-video/clouds-and-blue-sky-background-2408/"
            target="_blank"
            rel="noreferrer"
          >
            Clouds and blue sky background
          </a>
          {' '}from{' '}
          <a
            href="https://mixkit.co/"
            target="_blank"
            rel="noreferrer"
          >
            Mixkit
          </a>
        </small>
      </footer>
    </main>
  );
}
