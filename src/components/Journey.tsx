import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { copy } from '../copy';
import { getJourneyFrame, getWindowAperture, getWindowGeometry } from '../journeyMotion';
import { sceneAssets, type SceneAsset } from '../sceneAssets';
import type { Invitation, Locale } from '../types';
import { useLowDataMode } from '../useLowDataMode';
import { createCloudRenderer, type CloudRenderer } from '../cloudRenderer';
import '../journey.css';

type JourneyProps = { invitation: Invitation; locale: Locale; reducedMotion: boolean };

const journeyCopy = {
  en: {
    boarding: 'The beginning of forever', pass: 'Boarding pass', routeFrom: 'TODAY', routeTo: 'FOREVER',
    routeLabel: 'A journey together', takeoff: 'Some journeys change everything.', takeoffLabel: '01 / Taking flight',
    cabin: 'And some bring you home.', cabinLabel: '02 / Above the clouds', arrival: 'Our next chapter. With you.',
    staticBody: 'Our next chapter begins with the people we love. Welcome to our wedding celebration.',
    scroll: 'Scroll to take flight', accepted: 'CLEARED FOR FOREVER',
  },
  ms: {
    boarding: 'Permulaan sebuah selamanya', pass: 'Pas masuk', routeFrom: 'HARI INI', routeTo: 'SELAMANYA',
    routeLabel: 'Perjalanan bersama', takeoff: 'Ada perjalanan yang mengubah segalanya.', takeoffLabel: '01 / Mula terbang',
    cabin: 'Ada yang membawa kita pulang.', cabinLabel: '02 / Di atas awan', arrival: 'Bab seterusnya. Bersama anda.',
    staticBody: 'Bab seterusnya bermula bersama insan tersayang. Selamat datang ke majlis perkahwinan kami.',
    scroll: 'Tatal untuk memulakan perjalanan', accepted: 'MENUJU SELAMANYA',
  },
} satisfies Record<Locale, Record<string, string>>;

function ScenePicture({ asset }: { asset: SceneAsset }) {
  const base = import.meta.env.BASE_URL;
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <picture className="flight-scene-picture" style={{
      '--portrait-focus': `${asset.portrait.focalPoint.x * 100}% ${asset.portrait.focalPoint.y * 100}%`,
      '--landscape-focus': `${asset.landscape.focalPoint.x * 100}% ${asset.landscape.focalPoint.y * 100}%`,
    } as CSSProperties}>
      <source media="(min-width: 768px)" type="image/avif" srcSet={`${base}${asset.landscape.avif}`} />
      <source media="(min-width: 768px)" type="image/webp" srcSet={`${base}${asset.landscape.webp}`} />
      <source type="image/avif" srcSet={`${base}${asset.portrait.avif}`} />
      <img src={`${base}${asset.portrait.webp}`} width={asset.portrait.width} height={asset.portrait.height}
        decoding="async" alt="" onError={() => setFailed(true)} />
    </picture>
  );
}

function DecorativeTicket({ invitation, locale, showChop = false }: Pick<JourneyProps, 'invitation' | 'locale'> & { showChop?: boolean }) {
  const t = journeyCopy[locale];
  return (
    <div className="ceremonial-ticket" aria-hidden="true">
      <div className="ceremonial-ticket-band"><span>A&amp;N AIRWAYS</span><span>{t.pass}</span></div>
      <div className="ceremonial-ticket-content">
        <p className="ceremonial-ticket-label">{t.boarding}</p>
        <p className="ceremonial-ticket-names">Aleem <em>&amp;</em> Nurulain</p>
        <div className="ceremonial-ticket-route"><span>{t.routeFrom}</span><svg viewBox="0 0 64 20" aria-hidden="true"><path d="M1 10h58M50 2l10 8-10 8" /></svg><span>{t.routeTo}</span></div>
        <div className="ceremonial-ticket-details"><span>{invitation.flightCode}</span><span>{invitation.cabinLabel[locale]}</span></div>
      </div>
      <div className="ceremonial-ticket-stub"><span>{t.accepted}</span><span className="ceremonial-ticket-barcode" /></div>
      {showChop && <div className="ceremonial-ticket-chop" aria-hidden="true">
        <span>{locale === 'en' ? 'SINGAPORE' : 'SINGAPURA'}</span>
        <strong>A&amp;N</strong>
        <span>{locale === 'en' ? 'CLEARED TO BOARD' : 'SEDIA BERLEPAS'}</span>
        <small>OUR FLIGHT · 2027</small>
      </div>}
    </div>
  );
}

function StaticJourney({ invitation, locale }: Omit<JourneyProps, 'reducedMotion'>) {
  const t = copy[locale];
  return (
    <section className="static-journey static-journey--daylight" aria-label={t.journeyLabel}>
      <div className="static-journey-intro">
        <p className="eyebrow">{journeyCopy[locale].boarding}</p>
        <h1>{t.welcome}</h1>
        <p className="journey-welcome-body">{journeyCopy[locale].staticBody}</p>
      </div>
      <div className="static-ticket"><DecorativeTicket invitation={invitation} locale={locale} /></div>
      <p className="static-journey-arrival">{journeyCopy[locale].arrival}</p>
    </section>
  );
}

export function Journey({ invitation, locale, reducedMotion }: JourneyProps) {
  const lowData = useLowDataMode();
  const staticMode = reducedMotion || lowData || typeof IntersectionObserver === 'undefined';
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cloudCanvasRef = useRef<HTMLCanvasElement>(null);
  const [assetTier, setAssetTier] = useState(0);
  const t = copy[locale];
  const words = journeyCopy[locale];
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    if (staticMode) return undefined;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return undefined;
    let raf = 0;
    let visible = false;
    let listening = false;
    let cloudRenderer: CloudRenderer | null = null;
    let cloudAttempted = false;
    const canvas = cloudCanvasRef.current;

    const update = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      const rect = section.getBoundingClientRect();
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      const frame = getJourneyFrame(-rect.top / Math.max(1, rect.height - height), width, height);
      const px = (name: string, value: number) => section.style.setProperty(name, `${value}px`);
      const number = (name: string, value: number) => section.style.setProperty(name, `${value}`);
      number('--ticket-opacity', frame.ticketOpacity);
      number('--ticket-chop-opacity', frame.stampOpacity);
      number('--ticket-chop-scale', frame.stampScale);
      section.style.setProperty('--ticket-chop-rotate', `${frame.stampRotate}deg`);
      px('--ticket-y', frame.ticketY);
      section.style.setProperty('--ticket-rotate', `${frame.ticketRotate}deg`);
      number('--intro-opacity', frame.introOpacity);
      number('--airport-opacity', frame.airportOpacity);
      number('--departure-opacity', frame.departureOpacity);
      number('--airport-scale', frame.airportScale);
      number('--aircraft-opacity', frame.aircraftOpacity);
      px('--aircraft-x', frame.aircraftX);
      px('--aircraft-y', frame.aircraftY);
      number('--aircraft-scale', frame.aircraftScale);
      number('--takeoff-copy-opacity', frame.takeoffCopyOpacity);
      number('--cabin-copy-opacity', frame.cabinCopyOpacity);
      number('--cabin-opacity', frame.cabinOpacity);
      number('--cabin-scale', frame.cameraScale);
      number('--sky-opacity', frame.skyOpacity);
      number('--reveal-opacity', frame.revealOpacity);
      px('--reveal-y', frame.revealY);
      number('--daylight-opacity', frame.daylightOpacity);
      number('--journey-progress', frame.progress);
      const geometry = getWindowGeometry(width, height);
      const aperture = getWindowAperture(width, height, frame.cameraScale);
      px('--window-origin-x', geometry.originX);
      px('--window-origin-y', geometry.originY);
      px('--cloud-clip-left', aperture.left);
      px('--cloud-clip-right', width - aperture.right);
      px('--cloud-clip-top', aperture.top);
      px('--cloud-clip-bottom', height - aperture.bottom);
      px('--cloud-clip-radius-x', aperture.width * 0.48);
      px('--cloud-clip-radius-y', aperture.height * 0.18);
      section.classList.toggle('journey--started', frame.progress > 0.012);
      setAssetTier((current) => Math.max(current, frame.assetTier));
      if (canvas && frame.progress >= .48 && !cloudAttempted) {
        cloudAttempted = true;
        cloudRenderer = createCloudRenderer(canvas);
        canvas.dataset.renderer = cloudRenderer ? 'webgl' : 'fallback';
      }
      if (cloudRenderer && frame.skyOpacity > 0) {
        cloudRenderer.draw(frame.progress, width, height);
      }
    };

    const requestUpdate = () => {
      if (!raf && visible && !document.hidden) raf = window.requestAnimationFrame(update);
    };
    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
    const resume = () => {
      if (!visible || document.hidden) return;
      if (!listening) {
        listening = true;
        window.addEventListener('scroll', requestUpdate, { passive: true });
        window.addEventListener('resize', requestUpdate, { passive: true });
      }
      requestUpdate();
    };
    const onVisibility = () => document.hidden ? stop() : resume();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cloudRenderer?.dispose();
      cloudRenderer = null;
      if (canvas) canvas.dataset.renderer = 'fallback';
    };
    const onContextRestored = () => { cloudAttempted = false; requestUpdate(); };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) resume(); else stop();
    });
    observer.observe(section);
    document.addEventListener('visibilitychange', onVisibility);
    canvas?.addEventListener('webglcontextlost', onContextLost);
    canvas?.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
      canvas?.removeEventListener('webglcontextlost', onContextLost);
      canvas?.removeEventListener('webglcontextrestored', onContextRestored);
      cloudRenderer?.dispose();
    };
  }, [staticMode]);

  if (staticMode) return <StaticJourney invitation={invitation} locale={locale} />;

  return (
    <section ref={sectionRef} className="journey journey--cinematic" aria-label={t.journeyLabel}>
      <div ref={stageRef} className="journey-stage">
        <div className="flight-airport" aria-hidden="true">{assetTier >= 1 && <ScenePicture asset={sceneAssets.airport} />}</div>
        <div className="flight-departure" aria-hidden="true">{assetTier >= 1 && <ScenePicture asset={sceneAssets.runway} />}</div>
        <div className="flight-runway-glow" aria-hidden="true" />
        <div className="flight-aircraft" aria-hidden="true">{assetTier >= 1 && <img src={`${base}flight/aircraft-960.webp`} width="960" height="640" alt="" decoding="async" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}</div>
        <div className="journey-cabin" aria-hidden="true">{assetTier >= 2 && <ScenePicture asset={sceneAssets.cabin} />}</div>
        <div className="journey-clouds" aria-hidden="true">
          {assetTier >= 2 && <ScenePicture asset={sceneAssets.sky} />}
          <canvas ref={cloudCanvasRef} className="flight-cloud-volume" />
        </div>
        <div className="flight-daylight" aria-hidden="true" />
        <div className="journey-opening">
          <div className="journey-intro">
            <p className="eyebrow">{words.boarding}</p>
            <h1>{t.welcome}</h1>
            <p className="journey-welcome-body">{t.welcomeBody}</p>
          </div>
          <div className="journey-ticket-slot"><div className="journey-ticket"><DecorativeTicket invitation={invitation} locale={locale} showChop /></div></div>
          <p className="journey-scroll-cue"><span>{words.scroll}</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v17m-5-5 5 5 5-5" /></svg></p>
        </div>
        <div className="flight-caption flight-caption--takeoff" aria-hidden="true"><p className="eyebrow">{words.takeoffLabel}</p><p>{words.takeoff}</p></div>
        <div className="flight-caption flight-caption--cabin" aria-hidden="true"><p className="eyebrow">{words.cabinLabel}</p><p>{words.cabin}</p></div>
        <div className="journey-reveal" aria-hidden="true"><img src={`${base}monogram-a-and-n-display.png`} width="640" height="640" alt="" decoding="async" /><p>{words.arrival}</p></div>
        <div className="flight-progress" aria-hidden="true"><span /></div>
      </div>
    </section>
  );
}
