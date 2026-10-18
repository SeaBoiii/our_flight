import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { BoardingPass } from './components/BoardingPass';
import { LanguageToggle } from './components/LanguageToggle';
import { ExperienceBoundary } from './components/ExperienceBoundary';
import { ExperienceRecovery } from './components/ExperienceRecovery';
import { GateCinemagraph } from './components/GateCinemagraph';
import { ArrowUpRightIcon } from './components/Icons';
import { SplitFlap } from './components/SplitFlap';
import { copy } from './copy';
import { designCopy } from './designCopy';
import { clearMusicPreference, playMusic, setMusicPreference, useMusic } from './music';
import { prepareForBoarding, preloadForCheckIn } from './preload';
import { createUuid } from './browser';
import { experienceCopy } from './experienceCopy';
import { useLowDataMode } from './useLowDataMode';
import {
  accessForCredential,
  invitationConfigurationReady,
  invitationForAccess,
  isLegacyInvitationToken,
  isNormalizedInvitationCode,
  legacyInvitationConfigurationReady,
  legacyInvitesEnabled,
  normalizeInvitationCode,
  verifyLegacyPasscode,
} from './invitations';
import {
  clearRememberedInvitation,
  clearSavedGuestData,
  fingerprintCredential,
  legacyTokenFromHash,
  readLocale,
  readReducedMotion,
  readRememberedInvitation,
  readRsvpReceipt,
  saveLocale,
  saveRememberedInvitation,
} from './storage';
import type { AccessCredential, Invitation, Locale } from './types';
import { dockCopy } from './dockCopy';
import { clockNow, weddingDay } from './weddingDay';

const InvitationExperience = lazy(() => import('./components/InvitationExperience'));

type GateError = 'empty' | 'invalid' | 'configuration' | null;
const GATE_FLIGHTS = ['AN2108', 'AN2208'] as const;
type EntryMode = 'journey' | 'fast-track';
type EntryHistory = { visit: string; view: EntryMode | 'boarding'; position: number };

function entryHistory(): EntryHistory | null {
  const entry = window.history.state?.ourFlightEntry as Partial<EntryHistory> | undefined;
  return entry && typeof entry.visit === 'string'
    && Number.isInteger(entry.position) && (entry.position ?? -1) >= 0
    && ['journey', 'fast-track', 'boarding'].includes(entry.view ?? '')
    ? entry as EntryHistory
    : null;
}

function removeInvitationFragment(): void {
  if (!window.location.hash) return;
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const lowData = useLowDataMode();
  const [legacyToken, setLegacyToken] = useState(() => legacyInvitesEnabled() ? legacyTokenFromHash() : null);
  const [credential, setCredential] = useState<AccessCredential | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [accessInput, setAccessInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [gateError, setGateError] = useState<GateError>(null);
  const [restoredInvitation, setRestoredInvitation] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode | null>(null);
  const boardingHeadingRef = useRef<HTMLHeadingElement>(null);
  const checkInHeadingRef = useRef<HTMLHeadingElement>(null);
  const accessFlowVersionRef = useRef(0);
  const historyVisitRef = useRef<string | null>(null);
  if (historyVisitRef.current === null) historyVisitRef.current = createUuid();
  const historyPositionRef = useRef(0);
  const t = copy[locale];
  const experienceText = experienceCopy[locale];
  const design = designCopy[locale];
  const music = useMusic();

  const rememberEntryHistory = useCallback((view: EntryHistory['view']) => {
    historyPositionRef.current = 0;
    window.history.replaceState(
      { ourFlightEntry: { visit: historyVisitRef.current, view, position: 0 } },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'ms' ? 'ms-SG' : 'en-SG';
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    if (typeof motionPreference.addEventListener === 'function') {
      motionPreference.addEventListener('change', syncMotionPreference);
      return () => motionPreference.removeEventListener('change', syncMotionPreference);
    }
    motionPreference.addListener(syncMotionPreference);
    return () => motionPreference.removeListener(syncMotionPreference);
  }, []);

  useEffect(() => {
    const incomingToken = legacyTokenFromHash();
    if (incomingToken && !legacyInvitesEnabled()) removeInvitationFragment();

    let cancelled = false;
    const flowVersion = ++accessFlowVersionRef.current;
    const restore = async () => {
      setRestoring(true);
      try {
        const saved = readRememberedInvitation();
        if (!saved) {
          clearRememberedInvitation();
          return;
        }
        const legacyUnavailable = saved.credential.kind === 'legacy-token' && !legacyInvitesEnabled();
        const wrongLegacyLink = Boolean(legacyInvitesEnabled() && incomingToken && (
          saved.credential.kind !== 'legacy-token' || saved.credential.value !== incomingToken
        ));
        const configurationReady = saved.credential.kind === 'legacy-token'
          ? legacyInvitationConfigurationReady()
          : invitationConfigurationReady();
        if (legacyUnavailable || wrongLegacyLink || !configurationReady) {
          clearRememberedInvitation();
          return;
        }

        const [nextFingerprint, invitationAccess] = await Promise.all([
          fingerprintCredential(saved.credential),
          accessForCredential(saved.credential),
        ]);
        if (cancelled || accessFlowVersionRef.current !== flowVersion) return;
        if (
          !invitationAccess
          || invitationAccess.side !== saved.side
          || invitationAccess.cabinClass !== saved.cabinClass
          || nextFingerprint !== saved.fingerprint
        ) {
          clearRememberedInvitation();
          return;
        }
        setCredential(saved.credential);
        setFingerprint(nextFingerprint);
        setInvitation(invitationForAccess(invitationAccess));
        setRestoredInvitation(true);
        setEntryMode('fast-track');
        rememberEntryHistory('fast-track');
        if (saved.credential.kind === 'legacy-token') {
          setLegacyToken(null);
          removeInvitationFragment();
        }
      } catch {
        if (!cancelled && accessFlowVersionRef.current === flowVersion) {
          clearRememberedInvitation();
          setGateError('configuration');
        }
      } finally {
        if (!cancelled && accessFlowVersionRef.current === flowVersion) setRestoring(false);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [rememberEntryHistory]);

  useEffect(() => {
    const onHashChange = () => {
      const nextToken = legacyTokenFromHash();
      // Native section links create their own history entries. Track those
      // entries so Back can return past them to this visit's entry screen.
      if (!nextToken && invitation && entryMode && !entryHistory()) {
        historyPositionRef.current += 1;
        window.history.replaceState({
          ourFlightEntry: { visit: historyVisitRef.current, view: entryMode, position: historyPositionRef.current },
        }, '');
      }
      const legacyEnabled = legacyInvitesEnabled();
      const rejectedToken = Boolean(nextToken && !legacyEnabled);
      const effectiveToken = legacyEnabled ? nextToken : null;
      if (rejectedToken) removeInvitationFragment();
      if (rejectedToken && invitation) return;
      if (!rejectedToken && effectiveToken === legacyToken) return;
      if (!rejectedToken && !effectiveToken && !legacyToken) return;
      accessFlowVersionRef.current += 1;
      clearRememberedInvitation();
      setLegacyToken(effectiveToken);
      setCredential(null);
      setFingerprint('');
      setInvitation(null);
      setAccessInput('');
      setUnlocking(false);
      setRestoring(false);
      setGateError(null);
      setRestoredInvitation(false);
      setEntryMode(null);
      historyVisitRef.current = createUuid();
      historyPositionRef.current = 0;
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [entryMode, invitation, legacyToken]);

  const forgetInvitation = useCallback(() => {
    accessFlowVersionRef.current += 1;
    clearRememberedInvitation();
    setLegacyToken(null);
    setCredential(null);
    setFingerprint('');
    setInvitation(null);
    setRestoredInvitation(false);
    setEntryMode(null);
    setGateError(null);
    setAccessInput('');
    setUnlocking(false);
    setRestoring(false);
    historyVisitRef.current = createUuid();
    historyPositionRef.current = 0;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => checkInHeadingRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    const onPopState = () => {
      if (!invitation) return;
      const entry = entryHistory();
      if (entry?.visit !== historyVisitRef.current) return;
      historyPositionRef.current = entry.position;
      setEntryMode(entry.view === 'boarding' ? null : entry.view);
      if (entry.view === 'boarding') window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [invitation]);

  useEffect(() => {
    if (!invitation || entryMode) return;
    const frame = window.requestAnimationFrame(() => boardingHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [entryMode, invitation]);

  // First-time guests: hard-load the journey while they enter their code.
  const showingGate = !invitation && !restoring;
  useEffect(() => {
    if (showingGate && !lowData) preloadForCheckIn();
  }, [showingGate, lowData]);

  // The departures board alternates between both wedding-day flights, the way
  // a real split-flap board cycles. Paused in hidden tabs and for reduced motion.
  const [flightIndex, setFlightIndex] = useState(0);
  useEffect(() => {
    if (!showingGate || reducedMotion) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setFlightIndex((index) => (index + 1) % GATE_FLIGHTS.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [showingGate, reducedMotion]);

  // Boarding pass: decode the cached scenes and warm the cloud shader.
  const showingBoarding = Boolean(invitation && !entryMode && !restoredInvitation);
  useEffect(() => {
    if (showingBoarding && !lowData) prepareForBoarding();
  }, [showingBoarding, lowData]);

  const boardInvitation = (mode: EntryMode | 'boarding') => {
    historyPositionRef.current += 1;
    window.history.pushState(
      { ourFlightEntry: { visit: historyVisitRef.current, view: mode, position: historyPositionRef.current } },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    window.scrollTo({ top: 0, behavior: 'auto' });
    setEntryMode(mode === 'boarding' ? null : mode);
  };

  const returnToEntry = () => {
    const entry = entryHistory();
    const view = restoredInvitation ? 'fast-track' : 'boarding';
    setEntryMode(view === 'boarding' ? null : view);
    if (entry?.visit === historyVisitRef.current && entry.position > 0) {
      window.history.go(-entry.position);
    } else {
      rememberEntryHistory(view);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const toggleLocale = () => setLocale((current) => current === 'en' ? 'ms' : 'en');

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessInput.trim()) {
      setGateError('empty');
      return;
    }

    const isLegacyAttempt = Boolean(legacyToken);
    if (isLegacyAttempt ? !legacyInvitationConfigurationReady() : !invitationConfigurationReady()) {
      setGateError('configuration');
      return;
    }

    setUnlocking(true);
    setGateError(null);
    const flowVersion = ++accessFlowVersionRef.current;
    try {
      let nextCredential: AccessCredential;
      if (legacyToken) {
        const passcodeValid = isLegacyInvitationToken(legacyToken) && await verifyLegacyPasscode(accessInput);
        if (accessFlowVersionRef.current !== flowVersion) return;
        if (!passcodeValid) {
          setGateError('invalid');
          return;
        }
        nextCredential = { kind: 'legacy-token', value: legacyToken };
      } else {
        const normalizedCode = normalizeInvitationCode(accessInput);
        if (!isNormalizedInvitationCode(normalizedCode)) {
          setGateError('invalid');
          return;
        }
        nextCredential = { kind: 'class-code', value: normalizedCode };
      }

      const [nextFingerprint, invitationAccess] = await Promise.all([
        fingerprintCredential(nextCredential),
        accessForCredential(nextCredential),
      ]);
      if (accessFlowVersionRef.current !== flowVersion) return;
      if (!invitationAccess) {
        setGateError('invalid');
        return;
      }

      setCredential(nextCredential);
      setFingerprint(nextFingerprint);
      setInvitation(invitationForAccess(invitationAccess));
      setRestoredInvitation(false);
      setEntryMode(null);
      setAccessInput('');
      saveRememberedInvitation({
        version: 4,
        fingerprint: nextFingerprint,
        side: invitationAccess.side,
        cabinClass: invitationAccess.cabinClass,
        credential: nextCredential,
      });
      rememberEntryHistory('boarding');
      if (nextCredential.kind === 'legacy-token') {
        setLegacyToken(null);
        removeInvitationFragment();
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch {
      setGateError('configuration');
    } finally {
      if (accessFlowVersionRef.current === flowVersion) setUnlocking(false);
    }
  };

  const gateErrorMessage = gateError === 'empty'
    ? t.emptyPasscode
    : gateError === 'invalid'
      ? t.invalidInvitation
      : gateError === 'configuration'
        ? t.configurationError
        : '';

  if (invitation && credential && fingerprint && entryMode) {
    return (
      <ExperienceBoundary fallback={<ExperienceRecovery invitation={invitation} locale={locale} failed onBack={() => boardInvitation('boarding')} />}>
        <Suspense fallback={<ExperienceRecovery invitation={invitation} locale={locale} onBack={() => boardInvitation('boarding')} />}>
          <InvitationExperience
            key={fingerprint}
            invitation={invitation}
            accessCredential={credential}
            fingerprint={fingerprint}
            locale={locale}
            reducedMotion={reducedMotion}
            returning={restoredInvitation}
            entryMode={entryMode}
            onBack={entryMode === 'journey' ? returnToEntry : () => boardInvitation('boarding')}
            onReplay={() => boardInvitation('journey')}
            onForget={forgetInvitation}
            onClearDevice={() => { clearSavedGuestData(); clearMusicPreference(); forgetInvitation(); }}
            onToggleLocale={toggleLocale}
          />
        </Suspense>
      </ExperienceBoundary>
    );
  }

  const base = import.meta.env.BASE_URL;
  const logo = `${base}monogram-a-and-n-display.webp`;
  const nameLetters = (name: string, offset: number) => name.split('').map((letter, index) => (
    <span key={`${name}-${index}`} style={{ '--i': offset + index } as CSSProperties}>{letter}</span>
  ));

  return (
    <main className={invitation ? `boarding-page cabin-${invitation.cabinClass}` : 'gate-page'}>
      {!invitation && !restoring && !lowData ? (
        <picture className="gate-background" aria-hidden="true">
          <source media="(min-width: 800px)" srcSet={`${base}flight/airport-landscape-1440.avif`} type="image/avif" />
          <source media="(min-width: 800px)" srcSet={`${base}flight/airport-landscape-1440.webp`} type="image/webp" />
          <source srcSet={`${base}flight/airport-portrait-640.avif`} type="image/avif" />
          <img src={`${base}flight/airport-portrait-640.webp`} width="640" height="960" alt="" decoding="async" fetchPriority="high" />
        </picture>
      ) : null}
      {!invitation && !restoring ? <GateCinemagraph reducedMotion={reducedMotion} lowData={lowData} /> : null}
      <header className="site-header">
        <div className="site-brand">
          <span className="site-brand-monogram"><img src={logo} width="84" height="56" alt="Aleem and Nurulain" /></span>
          <span>OUR FLIGHT<small>{locale === 'en' ? 'A wedding invitation' : 'Jemputan perkahwinan'}</small></span>
        </div>
        <div className="header-actions">
          <LanguageToggle locale={locale} label={t.language} onToggle={toggleLocale} />
        </div>
      </header>

      {invitation ? (
        <section className="boarding-ready" aria-labelledby="boarding-title">
          <div className="boarding-copy">
            <p className="eyebrow">{t.flightTheme}</p>
            <h1 ref={boardingHeadingRef} id="boarding-title" className="boarding-title" tabIndex={-1}>{t.ticketReady}</h1>
            <p>Aleem <span>&amp;</span> Nurulain</p>
          </div>
          {restoredInvitation ? <div className="boarding-returning">
            <button className="button button-secondary boarding-fast-track" type="button" onClick={returnToEntry}>
              {experienceText.backToItinerary}
            </button>
          </div> : null}
          {!lowData && music.status !== 'unavailable' ? (
            <div className="boarding-music">
              <button
                className="music-switch"
                type="button"
                role="switch"
                aria-checked={music.preferred}
                aria-describedby="boarding-music-hint"
                onClick={() => setMusicPreference(!music.preferred)}
              >
                <span className="music-switch-track" aria-hidden="true"><span /></span>
                <span>{design.boardWithMusic}</span>
              </button>
              <p id="boarding-music-hint">{design.boardWithMusicHint}</p>
            </div>
          ) : null}
          <BoardingPass
            invitation={invitation}
            locale={locale}
            guestName={readRsvpReceipt(fingerprint, invitation.events.map((event) => event.id))?.guestName}
            onScan={() => { if (music.preferred && !lowData) playMusic(); }}
            onBoard={() => boardInvitation('journey')}
          />
          {weddingDay(invitation.events, clockNow()) ? (
            // On the wedding day itself, guests may just need directions and the programme.
            <button className="button button-secondary boarding-skip-today" type="button" onClick={() => boardInvitation('fast-track')}>
              {dockCopy[locale].skipToToday}
            </button>
          ) : null}
          <button className="invitation-forget" type="button" onClick={forgetInvitation}>{t.forgetInvitation}</button>
        </section>
      ) : (
        <section className="gate-stage" aria-labelledby="check-in-title">
          <div className="gate-introduction">
            <div className="gate-board" role="img" aria-label={design.boardSummary}>
              <div><small aria-hidden="true">{design.boardFlight}</small><SplitFlap text={GATE_FLIGHTS[flightIndex]} delay={250} className="split-flap--cycling" /></div>
              <div><small aria-hidden="true">{design.boardDestination}</small><SplitFlap text={design.boardForever} delay={520} /></div>
              <div><small aria-hidden="true">{design.boardStatus}</small><SplitFlap text={design.boardOnTime} delay={900} className="split-flap--status" /></div>
            </div>
            <p className="gate-departure"><span /> {locale === 'en' ? 'A new chapter is departing' : 'Bab baharu bakal bermula'}</p>
            <p className="gate-names">
              <span className="visually-hidden">Aleem &amp; Nurulain</span>
              <span className="gate-names-line" aria-hidden="true">{nameLetters('Aleem', 0)} <em style={{ '--i': 5 } as CSSProperties}>&amp;</em></span>
              <span className="gate-names-line" aria-hidden="true">{nameLetters('Nurulain', 6)}</span>
            </p>
            <p className="gate-dedication">{locale === 'en' ? 'Two hearts. One destination.' : 'Dua hati. Satu destinasi.'}</p>
            <div className="gate-pass" aria-hidden="true">
              <div><small>{locale === 'en' ? 'DEPARTING' : 'BERLEPAS'}</small><strong>SIN</strong><span>Singapore</span></div>
              <svg viewBox="0 0 160 30" fill="none"><path d="M0 15h65m32 0h63" stroke="currentColor" strokeDasharray="3 5" /><path d="m80 3 4 10 11 5-1 3-11-3-2 8h-3l-2-8-10 3-1-3 11-5z" fill="currentColor" /></svg>
              <div><small>{locale === 'en' ? 'ARRIVING' : 'TIBA'}</small><strong>{locale === 'en' ? 'Forever' : 'Selamanya'}</strong><span>August 2027</span></div>
            </div>
          </div>
          <div className="gate-copy">
            <p className="eyebrow">{locale === 'en' ? 'Your journey begins' : 'Perjalanan anda bermula'}</p>
            <h1 ref={checkInHeadingRef} id="check-in-title" tabIndex={-1}>{t.checkIn}</h1>
            <p>{t.gateBody}</p>
            <form onSubmit={handleUnlock} noValidate>
              <label htmlFor="invitation-code">{t.passcode}</label>
              <input
                id="invitation-code"
                className={legacyToken ? undefined : 'invitation-code-input'}
                type="text"
                inputMode="text"
                autoComplete="off"
                autoCapitalize={legacyToken ? 'none' : 'characters'}
                spellCheck="false"
                maxLength={legacyToken ? 160 : 24}
                value={accessInput}
                placeholder={t.passcodePlaceholder}
                aria-invalid={Boolean(gateErrorMessage)}
                aria-describedby={gateErrorMessage ? 'gate-error' : undefined}
                disabled={unlocking || restoring}
                onChange={(event) => {
                  setAccessInput(event.target.value);
                  setGateError(null);
                }}
              />
              {gateErrorMessage ? <p id="gate-error" className="gate-error" role="alert">{gateErrorMessage}</p> : null}
              <button className="button button-primary" type="submit" disabled={unlocking || restoring}>
                {unlocking || restoring ? t.checking : t.viewInvitation}
                <span className="button-icon"><ArrowUpRightIcon /></span>
              </button>
            </form>
            <small>{t.gateDate}</small>
          </div>
        </section>
      )}
      {!invitation ? <div className="gate-footer"><span>ALEEM &amp; NURULAIN</span><span>CHANGI AIRPORT · SINGAPORE</span></div> : null}
    </main>
  );
}
