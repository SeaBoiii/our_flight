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
  clearSession,
  fingerprintCredential,
  legacyTokenFromHash,
  readLocale,
  readReducedMotion,
  readSession,
  saveLocale,
  saveSession,
} from './storage';
import type { AccessCredential, Invitation, Locale } from './types';

const InvitationExperience = lazy(() => import('./components/InvitationExperience'));

type GateError = 'empty' | 'invalid' | 'configuration' | 'expired' | null;
const SESSION_MINUTES = 30;

function removeInvitationFragment(): void {
  if (!window.location.hash) return;
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [legacyToken, setLegacyToken] = useState(() => legacyInvitesEnabled() ? legacyTokenFromHash() : null);
  const [credential, setCredential] = useState<AccessCredential | null>(null);
  const [fingerprint, setFingerprint] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [accessInput, setAccessInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [gateError, setGateError] = useState<GateError>(null);
  const [boarded, setBoarded] = useState(false);
  const boardingHeadingRef = useRef<HTMLHeadingElement>(null);
  const accessFlowVersionRef = useRef(0);
  const t = copy[locale];

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
        const saved = readSession();
        if (!saved) {
          clearSession();
          return;
        }
        const savedExpired = Date.parse(saved.expiresAt) <= Date.now();
        const legacyUnavailable = saved.credential.kind === 'legacy-token' && !legacyInvitesEnabled();
        const wrongLegacyLink = Boolean(incomingToken && (
          saved.credential.kind !== 'legacy-token' || saved.credential.value !== incomingToken
        ));
        if (savedExpired || legacyUnavailable || wrongLegacyLink) {
          if (savedExpired && !incomingToken && saved.credential.kind === 'legacy-token' && legacyInvitesEnabled()) {
            setLegacyToken(saved.credential.value);
          }
          clearSession();
          if (savedExpired) setGateError('expired');
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
          clearSession();
          return;
        }
        setCredential(saved.credential);
        setFingerprint(nextFingerprint);
        setExpiresAt(saved.expiresAt);
        setInvitation(invitationForAccess(invitationAccess));
        if (saved.credential.kind === 'legacy-token') {
          setLegacyToken(null);
          removeInvitationFragment();
        }
      } finally {
        if (!cancelled && accessFlowVersionRef.current === flowVersion) setRestoring(false);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      const nextToken = legacyTokenFromHash();
      const legacyEnabled = legacyInvitesEnabled();
      const rejectedToken = Boolean(nextToken && !legacyEnabled);
      const effectiveToken = legacyEnabled ? nextToken : null;
      if (rejectedToken) removeInvitationFragment();
      if (!rejectedToken && effectiveToken === legacyToken) return;
      if (!rejectedToken && !effectiveToken && !legacyToken) return;
      accessFlowVersionRef.current += 1;
      clearSession();
      setLegacyToken(effectiveToken);
      setCredential(null);
      setFingerprint('');
      setExpiresAt('');
      setInvitation(null);
      setAccessInput('');
      setUnlocking(false);
      setRestoring(false);
      setGateError(null);
      setBoarded(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [legacyToken]);

  const expireSession = useCallback(() => {
    accessFlowVersionRef.current += 1;
    if (credential?.kind === 'legacy-token' && legacyInvitesEnabled()) {
      setLegacyToken(credential.value);
    }
    clearSession();
    setCredential(null);
    setFingerprint('');
    setExpiresAt('');
    setInvitation(null);
    setBoarded(false);
    setGateError('expired');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [credential]);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const remaining = Date.parse(expiresAt) - Date.now();
    const timer = window.setTimeout(expireSession, Math.max(0, Math.min(remaining, 2_147_000_000)));
    return () => window.clearTimeout(timer);
  }, [expiresAt, expireSession]);

  useEffect(() => {
    if (!invitation || boarded) return;
    const frame = window.requestAnimationFrame(() => boardingHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [boarded, invitation]);

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

      const nextExpiry = new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString();
      setCredential(nextCredential);
      setFingerprint(nextFingerprint);
      setExpiresAt(nextExpiry);
      setInvitation(invitationForAccess(invitationAccess));
      setAccessInput('');
      saveSession({
        version: 3,
        unlocked: true,
        expiresAt: nextExpiry,
        fingerprint: nextFingerprint,
        side: invitationAccess.side,
        cabinClass: invitationAccess.cabinClass,
        credential: nextCredential,
      });
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
      : gateError === 'expired'
        ? t.expired
        : gateError === 'configuration'
          ? t.configurationError
          : '';

  if (invitation && credential && fingerprint && boarded) {
    return (
      <Suspense fallback={<div className="page-loading" role="status">{t.checking}</div>}>
        <InvitationExperience
          invitation={invitation}
          accessCredential={credential}
          fingerprint={fingerprint}
          locale={locale}
          reducedMotion={reducedMotion}
          onBack={() => {
            setBoarded(false);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
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
            onBoard={() => {
              window.scrollTo({ top: 0, behavior: 'auto' });
              setBoarded(true);
            }}
          />
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
            <h1 id="check-in-title">{t.checkIn}</h1>
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
