import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiFailure, restoreInvitation, unlockInvitation } from './api';
import { BoardingPass } from './components/BoardingPass';
import { copy } from './copy';
import {
  clearSession,
  fingerprintToken,
  invitationTokenFromHash,
  readLocale,
  readReducedMotion,
  readSession,
  saveLocale,
  saveReducedMotion,
  saveSession,
} from './storage';
import type { Invitation, Locale } from './types';

const InvitationExperience = lazy(() => import('./components/InvitationExperience'));

type GateError = 'empty' | 'invalid' | 'connection' | 'expired' | null;

export default function App() {
  const [locale, setLocale] = useState<Locale>(readLocale);
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion);
  const [linkToken, setLinkToken] = useState(invitationTokenFromHash);
  const [fingerprint, setFingerprint] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [passcode, setPasscode] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [gateError, setGateError] = useState<GateError>(null);
  const [boarded, setBoarded] = useState(false);
  const boardingHeadingRef = useRef<HTMLHeadingElement>(null);
  const t = copy[locale];

  useEffect(() => {
    document.documentElement.lang = locale === 'ms' ? 'ms-SG' : 'en-SG';
    saveLocale(locale);
  }, [locale]);

  useEffect(() => {
    const onHashChange = () => {
      const nextToken = invitationTokenFromHash();
      if (nextToken === linkToken) return;
      clearSession();
      setLinkToken(nextToken);
      setFingerprint('');
      setAccessToken('');
      setExpiresAt('');
      setInvitation(null);
      setPasscode('');
      setGateError(null);
      setBoarded(false);
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [linkToken]);

  useEffect(() => {
    let cancelled = false;
    if (!linkToken) {
      return undefined;
    }

    const restore = async () => {
      const nextFingerprint = await fingerprintToken(linkToken);
      if (cancelled) return;
      setFingerprint(nextFingerprint);
      const saved = readSession();
      if (!saved || saved.fingerprint !== nextFingerprint || Date.parse(saved.expiresAt) <= Date.now()) {
        if (saved) clearSession();
        return;
      }

      setRestoring(true);
      try {
        const response = await restoreInvitation(saved.accessToken);
        if (cancelled) return;
        setAccessToken(saved.accessToken);
        setExpiresAt(response.expiresAt);
        setInvitation(response.invitation);
      } catch (error) {
        if (cancelled) return;
        clearSession();
        if (!(error instanceof ApiFailure && error.status === 401)) setGateError('connection');
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [linkToken]);

  const expireSession = useCallback(() => {
    clearSession();
    setAccessToken('');
    setExpiresAt('');
    setInvitation(null);
    setBoarded(false);
    setGateError('expired');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

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
  const toggleMotion = () => {
    setReducedMotion((current) => {
      saveReducedMotion(!current);
      return !current;
    });
  };

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!linkToken) return;
    if (!passcode) {
      setGateError('empty');
      return;
    }
    setUnlocking(true);
    setGateError(null);
    const submittedToken = linkToken;
    try {
      const nextFingerprint = fingerprint || await fingerprintToken(linkToken);
      const response = await unlockInvitation(linkToken, passcode);
      if (invitationTokenFromHash() !== submittedToken) return;
      setFingerprint(nextFingerprint);
      setAccessToken(response.accessToken);
      setExpiresAt(response.expiresAt);
      setInvitation(response.invitation);
      setPasscode('');
      saveSession({
        accessToken: response.accessToken,
        expiresAt: response.expiresAt,
        fingerprint: nextFingerprint,
      });
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (error) {
      setGateError(error instanceof ApiFailure && error.status === 401 ? 'invalid' : 'connection');
    } finally {
      setUnlocking(false);
    }
  };

  const gateErrorMessage = gateError === 'empty'
    ? t.emptyPasscode
    : gateError === 'invalid'
      ? t.invalidInvitation
      : gateError === 'expired'
        ? t.expired
        : gateError === 'connection'
          ? t.connectionError
          : '';

  if (invitation && accessToken && fingerprint && boarded) {
    return (
      <Suspense fallback={<div className="page-loading" role="status">{t.checking}</div>}>
        <InvitationExperience
          invitation={invitation}
          accessToken={accessToken}
          fingerprint={fingerprint}
          locale={locale}
          reducedMotion={reducedMotion}
          onBack={() => {
            setBoarded(false);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
          onToggleMotion={toggleMotion}
          onToggleLocale={toggleLocale}
          onSessionExpired={expireSession}
        />
      </Suspense>
    );
  }

  return (
    <main className={invitation ? `boarding-page cabin-${invitation.cabinClass}` : 'gate-page'}>
      <header className="site-header">
        <img src={`${import.meta.env.BASE_URL}an-monogram.svg`} alt="Aleem and Nurulain" />
        <div className="header-actions">
          {invitation ? (
            <button type="button" aria-pressed={reducedMotion} onClick={toggleMotion}>
              {reducedMotion ? t.reducedMotionOn : t.reduceMotion}
            </button>
          ) : null}
          <button type="button" lang={locale === 'en' ? 'ms' : 'en'} onClick={toggleLocale}>{t.language}</button>
        </div>
      </header>

      {invitation ? (
        <section className="boarding-ready" aria-labelledby="boarding-title">
          <div className="boarding-copy">
            <p className="eyebrow">{t.flightTheme}</p>
            <h1 ref={boardingHeadingRef} id="boarding-title" tabIndex={-1}>{t.ticketReady}</h1>
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
            <img src={`${import.meta.env.BASE_URL}an-monogram.svg`} alt="" />
          </div>
          <div className="gate-copy">
            <p className="eyebrow">{t.flightTheme}</p>
            <h1 id="check-in-title">{linkToken ? t.checkIn : t.missingTitle}</h1>
            <p>{linkToken ? t.gateBody : t.missingBody}</p>
            {linkToken ? (
              <form onSubmit={handleUnlock} noValidate>
                <label htmlFor="invitation-passcode">{t.passcode}</label>
                <input
                  id="invitation-passcode"
                  type="password"
                  autoComplete="one-time-code"
                  autoCapitalize="none"
                  spellCheck="false"
                  value={passcode}
                  placeholder={t.passcodePlaceholder}
                  aria-invalid={Boolean(gateErrorMessage)}
                  aria-describedby={gateErrorMessage ? 'gate-error' : undefined}
                  disabled={unlocking || restoring}
                  onChange={(event) => {
                    setPasscode(event.target.value);
                    setGateError(null);
                  }}
                />
                {gateErrorMessage ? <p id="gate-error" className="gate-error" role="alert">{gateErrorMessage}</p> : null}
                <button className="button button-primary" type="submit" disabled={unlocking || restoring}>
                  {unlocking || restoring ? t.checking : t.viewInvitation}
                </button>
              </form>
            ) : null}
            <small>{t.gateDate}</small>
          </div>
        </section>
      )}
    </main>
  );
}
