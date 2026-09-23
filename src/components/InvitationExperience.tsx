import { useEffect, useRef, type MouseEvent } from 'react';
import { copy } from '../copy';
import type { AccessCredential, Invitation, Locale } from '../types';
import { localized } from '../types';
import { crownePlazaLogo } from '../venueLogo';
import { mapUrl } from '../venue';
import { Journey } from './Journey';
import { LanguageToggle } from './LanguageToggle';
import { RsvpForm } from './RsvpForm';
import { EventActions } from './EventActions';
import '../experience.css';

type InvitationExperienceProps = {
  invitation: Invitation;
  accessCredential: AccessCredential;
  fingerprint: string;
  locale: Locale;
  reducedMotion: boolean;
  entryMode?: 'journey' | 'fast-track';
  onBack: () => void;
  onForget?: () => void;
  onToggleLocale: () => void;
};

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
  entryMode = 'journey',
  onBack,
  onForget,
  onToggleLocale,
}: InvitationExperienceProps) {
  const t = copy[locale];
  const experienceRef = useRef<HTMLElement>(null);
  const itineraryHeadingRef = useRef<HTMLHeadingElement>(null);
  const navigatedRef = useRef(false);
  const sectionFocusFrameRef = useRef(0);

  useEffect(() => () => window.cancelAnimationFrame(sectionFocusFrameRef.current), []);

  useEffect(() => {
    const experience = experienceRef.current;
    if (!experience) return;
    let pointerDown = false;
    let restoreTimer = 0;
    const isEditing = (target: EventTarget | null) => target instanceof HTMLElement
      && target.matches('input:not([type="radio"]):not([type="checkbox"]), textarea, select');
    const updateKeyboardState = (event: FocusEvent) => {
      const target = event.type === 'focusout' ? event.relatedTarget : event.target;
      window.clearTimeout(restoreTimer);
      // A tap can blur an input before its click fires. Keep the dock hidden
      // until that tap finishes so it cannot intercept a footer/form button.
      if (!isEditing(target) && pointerDown) return;
      experience.toggleAttribute('data-editing', isEditing(target));
    };
    const startPointer = () => { pointerDown = true; };
    const finishPointer = () => {
      pointerDown = false;
      restoreTimer = window.setTimeout(() => experience.toggleAttribute('data-editing', isEditing(document.activeElement)), 0);
    };
    experience.addEventListener('focusin', updateKeyboardState);
    experience.addEventListener('focusout', updateKeyboardState);
    document.addEventListener('pointerdown', startPointer, true);
    document.addEventListener('pointerup', finishPointer, true);
    document.addEventListener('pointercancel', finishPointer, true);
    return () => {
      window.clearTimeout(restoreTimer);
      experience.removeEventListener('focusin', updateKeyboardState);
      experience.removeEventListener('focusout', updateKeyboardState);
      document.removeEventListener('pointerdown', startPointer, true);
      document.removeEventListener('pointerup', finishPointer, true);
      document.removeEventListener('pointercancel', finishPointer, true);
    };
  }, []);

  useEffect(() => {
    // Content is visible by default; motion only embellishes its first arrival.
    if (reducedMotion || typeof IntersectionObserver !== 'function' || typeof Element.prototype.animate !== 'function') return;
    const animations: Animation[] = [];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (!document.hidden) animations.push(entry.target.animate(
          [{ opacity: 0.65, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 750, easing: 'cubic-bezier(.2,.7,.2,1)' },
        ));
      }
    }, { threshold: 0.12 });
    experienceRef.current?.querySelectorAll('[data-reveal]').forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [reducedMotion]);

  const focusSection = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    navigatedRef.current = true;
    const targetHash = event.currentTarget.hash;
    window.cancelAnimationFrame(sectionFocusFrameRef.current);
    // Native fragment navigation may focus the section after the click handler.
    // Move focus to its heading once that default action has completed.
    sectionFocusFrameRef.current = window.requestAnimationFrame(() => {
      if (window.location.hash === targetHash) document.getElementById(id)?.focus({ preventScroll: true });
    });
  };

  useEffect(() => {
    navigatedRef.current = false;
    if (entryMode === 'fast-track') {
      const frame = window.requestAnimationFrame(() => {
        itineraryHeadingRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
        itineraryHeadingRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(frame);
    }
    let settleFrame = 0;
    let settleTimer = 0;
    const resetScroll = () => {
      if (navigatedRef.current) return;
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
      if (!navigatedRef.current) experienceRef.current?.focus({ preventScroll: true });
      // A second frame wins over scroll anchoring when the sticky
      // journey is replaced by the shorter reduced-motion reading order.
      settleFrame = window.requestAnimationFrame(() => {
        resetScroll();
        settleTimer = window.setTimeout(() => {
          resetScroll();
          if (!navigatedRef.current) experienceRef.current?.focus();
        }, 80);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(settleFrame);
      window.clearTimeout(settleTimer);
    };
  }, [reducedMotion, entryMode]);

  return (
    <main ref={experienceRef} className={`experience cabin-${invitation.cabinClass}`} tabIndex={-1} aria-label={t.journeyLabel}>
      <nav className="experience-nav" aria-label={t.controls}>
        <button className="experience-back" type="button" aria-label={t.back} onClick={onBack}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6m5-5-5 5 5 5" /></svg>
          <span>{t.back}</span>
        </button>
        <span className="experience-nav-monogram" aria-hidden="true">A<span>&amp;</span>N</span>
        <LanguageToggle locale={locale} label={t.language} onToggle={onToggleLocale} />
      </nav>

      {entryMode === 'journey' ? <Journey invitation={invitation} locale={locale} reducedMotion={reducedMotion} /> : null}

      <section id="invitation" className="invitation-reveal" tabIndex={-1}>
        <div className="invitation-card" data-reveal>
          <img className="invitation-logo" src={`${import.meta.env.BASE_URL}monogram-a-and-n-display.png`} alt="Aleem and Nurulain" width="160" height="110" loading="lazy" decoding="async" />
          <p className="bismillah" lang="ar" dir="rtl">{t.bismillah}</p>
          <p className="salam">{t.salam}</p>
          <p className="formal-copy">{t.formalInvite}</p>
          <p className="invitation-names-label">{locale === 'ms' ? 'Majlis perkahwinan' : 'The wedding of'}</p>
          <h1>Aleem <span>&amp;</span> Nurulain</h1>
          <p className="blessing">{t.blessing}</p>
        </div>
      </section>

      <section className="our-story-section" aria-labelledby="our-story-title">
        <div className="our-story-inner" data-reveal>
          <p className="eyebrow">Aleem &amp; Nurulain</p>
          <h2 id="our-story-title">{t.ourStory}</h2>
          <svg className="story-flight-line" viewBox="0 0 560 96" fill="none" aria-hidden="true">
            <path d="M8 70C94 70 109 19 181 19C280 19 282 81 376 81C455 81 480 28 552 28" stroke="currentColor" strokeDasharray="3 7" />
            <circle cx="8" cy="70" r="4" fill="currentColor" />
            <circle cx="552" cy="28" r="4" fill="currentColor" />
            <path d="m271 41 3 10 14 8-1 3-16-4-6 5-3-1 3-8-4-8 2-2 5 5 1-9Z" fill="currentColor" />
          </svg>
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
        <div className="section-heading" data-reveal>
          <p className="eyebrow">{localized(invitation.cabinLabel, locale)}</p>
          <h2 id="itinerary-title" ref={itineraryHeadingRef} tabIndex={-1}>{t.itinerary}</h2>
          <p>{t.singaporeTime}</p>
        </div>

        <div className="itinerary-list">
          {invitation.events.map((event) => {
            const displayDate = localized(event.dateLabel, locale);
            const date = dateParts(displayDate);
            return (
              <article className="itinerary-card" key={event.id} data-reveal>
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
                <EventActions event={event} locale={locale} className="itinerary-actions" />
              </article>
            );
          })}
        </div>
        <a className="itinerary-rsvp button button-text" href="#rsvp" onClick={(event) => focusSection(event, 'rsvp-title')}>{t.rsvpTitle}<span aria-hidden="true"> ↓</span></a>
      </section>

      <section id="venue" className="travel-section" aria-labelledby="venue-title">
        <div className="travel-arrival" data-reveal>
          <div className="travel-introduction">
            <p className="eyebrow">{t.venue}</p>
            <h2 id="venue-title">{t.gettingHere}</h2>
            <div className="travel-destination" aria-hidden="true"><span>SIN</span><span>Singapore<br />Changi Airport</span></div>
          </div>
          <div className="travel-venue">
            <img className="travel-venue-logo" src={crownePlazaLogo} width="140" height="85" loading="lazy" decoding="async" alt="" />
            <h3>{invitation.hotel}</h3>
            <p className="travel-ballroom">{locale === 'ms' ? `${t.ballroom} ${invitation.ballroom}` : `${invitation.ballroom} ${t.ballroom}`} &middot; {t.terminal} {invitation.terminal}</p>
            <address>{t.address}</address>
            <a className="button button-primary travel-directions" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${t.directions} (${t.newTab})`}>
              {t.directions}<span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <details className="travel-guidance">
          <summary>
            <span>{t.travelSummary}</span>
            <span className="travel-summary-chevron" aria-hidden="true" />
          </summary>
          <div className="travel-details">
            <ul>
              <li>{t.travelMrt}</li>
              <li>{t.travelJewel}</li>
              <li>{t.travelCar}</li>
              <li>{t.travelParking}</li>
            </ul>
            <p>{t.travelTime}</p>
          </div>
        </details>
      </section>

      <RsvpForm
        invitation={invitation}
        accessCredential={accessCredential}
        fingerprint={fingerprint}
        locale={locale}
      />

      <footer className="site-footer">
        <img src={`${import.meta.env.BASE_URL}monogram-a-and-n-display.png`} alt="" width="120" height="83" loading="lazy" decoding="async" />
        <p>{t.footer}</p>
        {onForget ? <button className="button button-text invitation-forget" type="button" onClick={onForget}>{t.forgetInvitation}</button> : null}
      </footer>
    </main>
  );
}
