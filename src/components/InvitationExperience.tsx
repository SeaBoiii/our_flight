import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react';
import { copy } from '../copy';
import { designCopy } from '../designCopy';
import type { AccessCredential, Invitation, Locale } from '../types';
import { localized } from '../types';
import { crownePlazaLogo } from '../venueLogo';
import { mapUrl } from '../venue';
import { wazeUrl } from '../directions';
import { seatForEvent } from '../departure';
import { dockCopy } from '../dockCopy';
import { ExperienceBoundary } from './ExperienceBoundary';
import { experienceCopy } from '../experienceCopy';
import { readRsvpReceipt } from '../storage';
import { useLowDataMode } from '../useLowDataMode';
import { gsap, ScrollTrigger, SplitText } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';
import { pauseMusic } from '../music';
import { preloadForReplay } from '../preload';
import { sceneAssets } from '../sceneAssets';
import { Envelope } from './Envelope';
import { ArrowDownIcon, ArrowUpRightIcon } from './Icons';
import { BoardingDock } from './BoardingDock';
import { DepartureBoard } from './DepartureBoard';
import { LanguageToggle } from './LanguageToggle';
import { MusicToggle } from './MusicToggle';
import { OurStory } from './OurStory';
import { RsvpForm } from './RsvpForm';
import { VenueMap } from './VenueMap';
import '../experience.css';

const Journey = lazy(() => import('./Journey').then((module) => ({ default: module.Journey })));

type InvitationExperienceProps = {
  invitation: Invitation;
  accessCredential: AccessCredential;
  fingerprint: string;
  locale: Locale;
  reducedMotion: boolean;
  returning?: boolean;
  entryMode?: 'journey' | 'fast-track';
  onBack: () => void;
  onReplay?: () => void;
  onForget?: () => void;
  onClearDevice?: () => void;
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
  returning = false,
  entryMode = 'journey',
  onBack,
  onReplay,
  onForget,
  onClearDevice,
  onToggleLocale,
}: InvitationExperienceProps) {
  const t = copy[locale];
  const words = experienceCopy[locale];
  const design = designCopy[locale];
  const dock = dockCopy[locale];
  const lowData = useLowDataMode();
  const motion = !reducedMotion && !lowData && typeof IntersectionObserver === 'function';
  const [receipt, setReceipt] = useState(() => readRsvpReceipt(fingerprint, invitation.events.map((event) => event.id)));
  const attendingEvents = invitation.events.filter((event) => receipt?.responses.some((answer) => answer.eventId === event.id && answer.attendance === 'attending'));
  const [addressCopied, setAddressCopied] = useState(false);
  const experienceRef = useRef<HTMLElement>(null);
  const navigatedRef = useRef(false);
  const sectionFocusFrameRef = useRef(0);
  const copiedTimerRef = useRef(0);
  const base = import.meta.env.BASE_URL;

  useEffect(() => () => {
    window.cancelAnimationFrame(sectionFocusFrameRef.current);
    window.clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    const root = experienceRef.current;
    const navigation = root?.querySelector<HTMLElement>('.experience-nav');
    if (!root || !navigation) return;
    const measure = () => root.style.setProperty('--controls-clearance', `${Math.ceil(navigation.getBoundingClientRect().bottom + 20)}px`);
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(navigation);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Music steps aside when the guest reaches the RSVP form.
  useEffect(() => {
    const rsvp = experienceRef.current?.querySelector('#rsvp');
    if (!rsvp) return undefined;
    const trigger = ScrollTrigger.create({ trigger: rsvp, start: 'top 70%', onEnter: () => pauseMusic(900) });
    return () => trigger.kill();
  }, []);

  // Section reveals: one GSAP context for the whole page, reverted on unmount.
  useGsapScene(experienceRef, () => {
    const root = experienceRef.current!;
    // The navigation bar condenses once the guest starts scrolling.
    ScrollTrigger.create({
      start: 120,
      end: 'max',
      toggleClass: { targets: root.querySelector('.experience-nav')!, className: 'experience-nav--condensed' },
    });

    // Formal invitation: each line rises through a mask.
    gsap.utils.toArray<HTMLElement>('[data-reveal-lines]', root).forEach((element) => {
      const split = SplitText.create(element, { type: 'lines', mask: 'lines', linesClass: 'reveal-line' });
      gsap.from(split.lines, {
        yPercent: 105, duration: 1, stagger: 0.08,
        scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      });
    });
    const names = root.querySelector<HTMLElement>('.invitation-card h1');
    if (names) {
      const split = SplitText.create(names, { type: 'chars', charsClass: 'name-char' });
      gsap.from(split.chars, {
        yPercent: 60, rotationX: -90, opacity: 0, transformOrigin: '50% 100%', duration: 1.1, stagger: 0.035,
        scrollTrigger: { trigger: names, start: 'top 85%', once: true },
      });
    }
    gsap.utils.toArray<HTMLElement>('[data-reveal]', root).forEach((element) => {
      gsap.from(element, { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: element, start: 'top 90%', once: true } });
    });

    // Departures board: heading letters flip in like split-flap cards.
    const heading = root.querySelector<HTMLElement>('#itinerary-title');
    if (heading) {
      const split = SplitText.create(heading, { type: 'chars', charsClass: 'flap-char' });
      gsap.from(split.chars, {
        rotationX: -100, opacity: 0, transformOrigin: '50% 50% -12px', duration: 0.8, stagger: 0.035, ease: 'expo.out',
        scrollTrigger: { trigger: heading, start: 'top 88%', once: true },
      });
    }
    gsap.utils.toArray<HTMLElement>('.itinerary-card', root).forEach((card) => {
      gsap.from(card, { y: 60, opacity: 0, scale: 0.97, transformOrigin: '50% 0%', duration: 1, scrollTrigger: { trigger: card, start: 'top 90%', once: true } });
      const line = card.querySelector('.event-programme-line');
      if (line) {
        gsap.fromTo(line, { scaleY: 0 }, { scaleY: 1, ease: 'none', transformOrigin: '50% 0%',
          scrollTrigger: { trigger: card.querySelector('.event-programme'), start: 'top 75%', end: 'bottom 55%', scrub: true } });
      }
      card.querySelectorAll('.event-programme li').forEach((item) => {
        ScrollTrigger.create({ trigger: item, start: 'top 70%', toggleClass: { targets: item, className: 'is-lit' }, once: true });
      });
    });

    // Arrival footer: the golden sky drifts as the page settles.
    const footerSky = root.querySelector('.arrival-sky');
    if (footerSky) {
      gsap.fromTo(footerSky, { yPercent: -12, scale: 1.12 }, { yPercent: 0, scale: 1, ease: 'none',
        scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
    }
  }, motion, [entryMode, locale]);

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
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.getElementById('itinerary-title')?.focus({ preventScroll: true });
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
  }, [entryMode]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(`${invitation.hotel}, ${t.address}`);
    } catch {
      // Older in-app browsers: select the address so it can be copied manually.
      const address = experienceRef.current?.querySelector('.travel-section address');
      const selection = window.getSelection();
      if (!address || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(address);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    setAddressCopied(true);
    window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setAddressCopied(false), 2400);
  };

  const journeyFallback = (failed = false) => (
    <section className="journey-recovery" aria-labelledby="journey-recovery-title">
      <h2 id="journey-recovery-title">{failed ? words.invitation : words.journeyLoading}</h2>
      {failed ? <p role="status">{words.journeyUnavailable}</p> : null}
      <a className="button button-secondary" href="#itinerary" onClick={(event) => focusSection(event, 'itinerary-title')}>{words.journeySkip}</a>
    </section>
  );

  return (
    <main ref={experienceRef} className={`experience experience--${entryMode} cabin-${invitation.cabinClass}`} tabIndex={-1} aria-label={t.journeyLabel}>
      <nav className="experience-nav" aria-label={t.controls}>
        <button className="experience-back" type="button" onClick={onBack} aria-label={returning && entryMode === 'journey' ? words.backToItinerary : t.back}>
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M19 12H6m5-5-5 5 5 5" /></svg>
          <span>{returning && entryMode === 'journey' ? words.backToItinerary : t.back}</span>
        </button>
        <span className="experience-nav-monogram" aria-hidden="true">A<span>&amp;</span>N</span>
        <span className="experience-nav-actions">
          {!lowData ? <MusicToggle locale={locale} /> : null}
          <LanguageToggle locale={locale} label={t.language} onToggle={onToggleLocale} />
        </span>
      </nav>

      {entryMode === 'journey' ? <>
      <ExperienceBoundary fallback={journeyFallback(true)}>
        <Suspense fallback={journeyFallback()}>
          <Journey invitation={invitation} locale={locale} guestName={receipt?.guestName} reducedMotion={reducedMotion} />
        </Suspense>
      </ExperienceBoundary>

      {motion ? <Envelope locale={locale} guestName={receipt?.guestName} /> : null}

      <section id="invitation" className="invitation-reveal" tabIndex={-1}>
        <div className="invitation-card" key={`invitation-${locale}`}>
          <span className="invitation-border" aria-hidden="true" />
          <img className="invitation-logo" src={`${base}monogram-a-and-n-display.webp`} alt="Aleem and Nurulain" width="160" height="110" loading="lazy" decoding="async" />
          <p className="bismillah" lang="ar" dir="rtl">{t.bismillah}</p>
          <p className="salam" data-reveal-lines>{t.salam}</p>
          {receipt?.guestName ? <p className="personal-salutation">{words.personalInvite(receipt.guestName)}</p> : null}
          <p className="formal-copy" data-reveal-lines>{t.formalInvite}</p>
          <p className="invitation-names-label">{locale === 'ms' ? 'Majlis perkahwinan' : 'The wedding of'}</p>
          <h1>Aleem <span>&amp;</span> Nurulain</h1>
          <p className="blessing" data-reveal-lines>{t.blessing}</p>
        </div>
      </section>

      <OurStory locale={locale} motion={motion} />
      </> : null}

      <section id="itinerary" className="itinerary-section" aria-labelledby="itinerary-title">
        {entryMode === 'fast-track' ? <div className="returning-welcome">
          <p className="returning-greeting">{receipt?.guestName ? words.welcomeName(receipt.guestName) : words.welcome}</p>
          <p>{words.thankYou}</p>
          <button
            className="button button-text invitation-replay"
            type="button"
            onPointerDown={preloadForReplay}
            onFocus={preloadForReplay}
            onClick={onReplay ?? onBack}
          >{words.replay}</button>
        </div> : null}
        <div className="section-heading">
          <p className="eyebrow">{localized(invitation.cabinLabel, locale)}</p>
          <h2 id="itinerary-title" tabIndex={-1} key={`itinerary-${locale}`}>{t.itinerary}</h2>
          <p>{t.singaporeTime}</p>
        </div>

        <DepartureBoard events={invitation.events} locale={locale} />

        <div className="itinerary-list">
          {invitation.events.map((event) => {
            const displayDate = localized(event.dateLabel, locale);
            const date = dateParts(displayDate);
            return (
              <article className="itinerary-card" key={event.id}>
                <p className="itinerary-flight"><span>{event.flightCode}</span><span>{dock.seat} {seatForEvent(event)}</span><span>{localized(invitation.cabinLabel, locale)}</span></p>
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
                <div className="event-programme-track">
                  <span className="event-programme-line" aria-hidden="true" />
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
                </div>
                <dl className="venue-fields">
                  <div className="venue-hotel">
                    <dt>{t.hotel}</dt>
                    <dd>
                      <span>{invitation.hotel}</span>
                    </dd>
                  </div>
                  <div><dt>{t.ballroom}</dt><dd>{invitation.ballroom}</dd></div>
                  <div><dt>{t.terminal}</dt><dd>{invitation.terminal}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
        <a className="itinerary-rsvp button button-text" href="#rsvp" onClick={(event) => focusSection(event, 'rsvp-title')}>{t.rsvpTitle}<ArrowDownIcon /></a>
      </section>

      <section id="venue" className="travel-section" aria-labelledby="venue-title">
        <div className="travel-arrival">
          <div className="travel-introduction" data-reveal>
            <h2 id="venue-title">{t.gettingHere}</h2>
            <div className="travel-destination" aria-hidden="true"><span>SIN</span><span>Singapore<br />Changi Airport</span></div>
            <VenueMap motion={motion} />
          </div>
          <div className="travel-venue" data-reveal>
            <img className="travel-venue-logo" src={crownePlazaLogo} width="140" height="85" loading="lazy" decoding="async" alt="" />
            <h3>{invitation.hotel}</h3>
            <p className="travel-ballroom">{locale === 'ms' ? `${t.ballroom} ${invitation.ballroom}` : `${invitation.ballroom} ${t.ballroom}`} &middot; {t.terminal} {invitation.terminal}</p>
            <address>{t.address}</address>
            <div className="travel-actions">
              <a className="button button-primary travel-directions" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${t.directions} (${t.newTab})`}>
                {t.directions}<span className="button-icon"><ArrowUpRightIcon /></span>
              </a>
              <a className="button button-secondary travel-waze" href={wazeUrl} target="_blank" rel="noreferrer" aria-label={`${dock.openInWaze} (${t.newTab})`}>
                {dock.openInWaze}<span className="button-icon"><ArrowUpRightIcon /></span>
              </a>
              <button className="button button-secondary travel-copy" type="button" onClick={() => { void copyAddress(); }}>
                {addressCopied ? design.addressCopied : design.copyAddress}
              </button>
            </div>
            <p className="visually-hidden" role="status">{addressCopied ? design.addressCopied : ''}</p>
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
        onReceiptChange={setReceipt}
      />

      <BoardingDock locale={locale} checkedIn={!!receipt} calendarEvents={attendingEvents} />

      <footer className="site-footer">
        {!lowData ? (
          <picture className="arrival-sky" aria-hidden="true">
            <source media="(min-width: 768px)" type="image/avif" srcSet={`${base}${sceneAssets.golden.landscape.avif}`} />
            <source media="(min-width: 768px)" type="image/webp" srcSet={`${base}${sceneAssets.golden.landscape.webp}`} />
            <source type="image/avif" srcSet={`${base}${sceneAssets.golden.portrait.avif}`} />
            <img src={`${base}${sceneAssets.golden.portrait.webp}`} alt="" width="848" height="1264" loading="lazy" decoding="async" />
          </picture>
        ) : null}
        <div className="site-footer-content">
          <img src={`${base}monogram-a-and-n-display.webp`} alt="" width="120" height="83" loading="lazy" decoding="async" />
          <p className="arrival-title">{design.arrivalTitle}</p>
          <p className="arrival-body">{design.arrivalBody}</p>
          <p className="site-footer-mark">{t.footer}</p>
          {onForget ? <button className="button button-text invitation-forget" type="button" onClick={onForget}>{t.forgetInvitation}</button> : null}
          {onClearDevice ? <details className="device-settings">
            <summary>{words.deviceSettings}</summary>
            <p>{words.clearDeviceHint}</p>
            <button className="button button-text" type="button" onClick={onClearDevice}>{words.clearDevice}</button>
          </details> : null}
          <p className="music-credit">{design.musicCredit}</p>
        </div>
      </footer>
    </main>
  );
}
