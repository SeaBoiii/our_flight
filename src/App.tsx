import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { BoardingPass } from './components/BoardingPass';
import { LanguageToggle } from './components/LanguageToggle';
import { copy } from './copy';
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
  fingerprintCredential,
  legacyTokenFromHash,
  readLocale,
  readReducedMotion,
  readRememberedInvitation,
  saveLocale,
  saveRememberedInvitation,
} from './storage';
import type { AccessCredential, Invitation, Locale } from './types';

const InvitationExperience = lazy(() => import('./components/InvitationExperience'));

type GateError = 'empty' | 'invalid' | 'configuration' | null;
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
  const historyVisitRef = useRef(crypto.randomUUID());
  const historyPositionRef = useRef(0);
  const t = copy[locale];

  const rememberBoardingHistory = useCallback(() => {
    historyPositionRef.current = 0;
    window.history.replaceState(
      { ourFlightEntry: { visit: historyVisitRef.current, view: 'boarding', position: 0 } },
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
    motionPreference.addEventListener('change', syncMotionPreference);
    return () => motionPreference.removeEventListener('change', syncMotionPreference);
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
        rememberBoardingHistory();
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
  }, [rememberBoardingHistory]);

  useEffect(() => {
    const onHashChange = () => {
      const nextToken = legacyTokenFromHash();
      // Native section links create their own history entries. Track those
      // entries so the ticket control can return past them in one action.
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
      historyVisitRef.current = crypto.randomUUID();
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
    historyVisitRef.current = crypto.randomUUID();
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
      if (entry.view === 'fast-track' && !restoredInvitation) return;
      historyPositionRef.current = entry.position;
      setEntryMode(entry.view === 'boarding' ? null : entry.view);
      if (entry.view === 'boarding') window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [invitation, restoredInvitation]);

  useEffect(() => {
    if (!invitation || entryMode) return;
    const frame = window.requestAnimationFrame(() => boardingHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [entryMode, invitation]);

  const boardInvitation = (mode: EntryMode) => {
    if (mode === 'fast-track' && !restoredInvitation) return;
    historyPositionRef.current += 1;
    window.history.pushState(
      { ourFlightEntry: { visit: historyVisitRef.current, view: mode, position: historyPositionRef.current } },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    window.scrollTo({ top: 0, behavior: 'auto' });
    setEntryMode(mode);
  };

  const returnToBoarding = () => {
    const entry = entryHistory();
    setEntryMode(null);
    if (entry?.visit === historyVisitRef.current && entry.position > 0) {
      window.history.go(-entry.position);
    } else {
      rememberBoardingHistory();
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
      rememberBoardingHistory();
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
      <Suspense fallback={<div className="page-loading" role="status">{t.checking}</div>}>
        <InvitationExperience
          invitation={invitation}
          accessCredential={credential}
          fingerprint={fingerprint}
          locale={locale}
          reducedMotion={reducedMotion}
          entryMode={entryMode}
          onBack={returnToBoarding}
          onForget={forgetInvitation}
          onToggleLocale={toggleLocale}
        />
      </Suspense>
    );
  }

  const base = import.meta.env.BASE_URL;
  const logo = `${base}monogram-a-and-n-display.png`;

  return (
    <main className={invitation ? `boarding-page cabin-${invitation.cabinClass}` : 'gate-page'}>
      {!invitation ? (
        <picture className="gate-background" aria-hidden="true">
          <source media="(min-width: 800px)" srcSet={`${base}gate/changi-jewel-landscape.webp`} type="image/webp" />
          <img src={`${base}gate/changi-jewel-portrait.webp`} alt="" decoding="async" fetchPriority="high" />
        </picture>
      ) : null}
      <header className="site-header">
        <img src={logo} alt="Aleem and Nurulain" />
        <div className="header-actions">
          <LanguageToggle locale={locale} label={t.language} onToggle={toggleLocale} />
        </div>
      </header>

      {invitation ? (
        <section className="boarding-ready" aria-labelledby="boarding-title">
          <div className="boarding-copy">
            <p className="eyebrow">{t.flightTheme}</p>
            <h1 ref={boardingHeadingRef} id="boarding-title" className="boarding-title" tabIndex={-1}>{t.ticketReady}</h1>
            <p>Aleem &amp; Nurulain</p>
          </div>
          <BoardingPass
            invitation={invitation}
            locale={locale}
            onBoard={() => boardInvitation('journey')}
          />
          {restoredInvitation ? (
            <div className="boarding-returning">
              <button className="button button-secondary boarding-fast-track" type="button" onClick={() => boardInvitation('fast-track')}>
                {t.fastTrack}
              </button>
              <p>{t.fastTrackHint}</p>
            </div>
          ) : null}
          <button className="invitation-forget" type="button" onClick={forgetInvitation}>{t.forgetInvitation}</button>
        </section>
      ) : (
        <section className="gate-stage" aria-labelledby="check-in-title">
          <div className="gate-pass" aria-hidden="true">
            <div className="gate-pass-top"><span>OUR FLIGHT</span><span>2027</span></div>
            <div className="gate-route">
              <strong>SIN</strong>
              <span><i /></span>
              <strong>CROWNE PLAZA</strong>
            </div>
            <p>CHANGI AIRPORT &middot; SINGAPORE</p>
            <img src={logo} alt="" />
          </div>
          <div className="gate-copy">
            <p className="eyebrow">{t.flightTheme}</p>
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
              </button>
            </form>
            <small>{t.gateDate}</small>
          </div>
        </section>
      )}
    </main>
  );
}
