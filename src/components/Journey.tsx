import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { copy } from '../copy';
import { designCopy } from '../designCopy';
import { getJourneyFrame, getWindowAperture, getWindowGeometry } from '../journeyMotion';
import { gsap, ScrollTrigger, SplitText } from '../motion/gsap';
import { aircraftAsset, sceneAssets, goldenArrivalVideo, windowSkyVideo, type SceneAsset } from '../sceneAssets';
import { createFilmStrip, loadFilmFrames, motionLayersAllowed, type FilmStrip } from '../filmStrip';
import type { Invitation, Locale } from '../types';
import { useLowDataMode } from '../useLowDataMode';
import { createCloudRenderer, type CloudRenderer } from '../cloudRenderer';
import '../journey.css';

type JourneyProps = { invitation: Invitation; locale: Locale; reducedMotion: boolean; guestName?: string };

const journeyCopy = {
  en: {
    boarding: 'The beginning of forever', pass: 'Boarding pass', routeFrom: 'TODAY', routeTo: 'FOREVER',
    routeLabel: 'A journey together', takeoff: 'Some journeys change everything.', takeoffLabel: '01 / Taking flight',
    cabin: 'And some bring you home.', cabinLabel: '02 / Above the clouds', arrival: 'Our next chapter. With you.',
    staticBody: 'Our next chapter begins with the people we love. Welcome to our wedding celebration.',
    scroll: 'Scroll to take flight', accepted: 'CLEARED FOR FOREVER',
    skip: 'Skip flight', skipLabel: 'Skip the flight and go to the invitation',
  },
  ms: {
    boarding: 'Permulaan sebuah selamanya', pass: 'Pas masuk', routeFrom: 'HARI INI', routeTo: 'SELAMANYA',
    routeLabel: 'Perjalanan bersama', takeoff: 'Ada perjalanan yang mengubah segalanya.', takeoffLabel: '01 / Mula terbang',
    cabin: 'Ada yang membawa kita pulang.', cabinLabel: '02 / Di atas awan', arrival: 'Bab seterusnya. Bersama anda.',
    staticBody: 'Bab seterusnya bermula bersama insan tersayang. Selamat datang ke majlis perkahwinan kami.',
    scroll: 'Tatal untuk memulakan perjalanan', accepted: 'MENUJU SELAMANYA',
    skip: 'Langkau', skipLabel: 'Langkau penerbangan dan terus ke jemputan',
  },
} satisfies Record<Locale, Record<string, string>>;

// The route the little aircraft follows in the flight HUD (a 150 × 30 track).
const ROUTE_PATH = 'M6 24 C 40 24, 48 6, 75 6 S 118 21, 144 13';

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

function DecorativeTicket({ invitation, locale, guestName, showChop = false }: Pick<JourneyProps, 'invitation' | 'locale' | 'guestName'> & { showChop?: boolean }) {
  const t = journeyCopy[locale];
  return (
    <div className="ceremonial-ticket" aria-hidden="true">
      <div className="ceremonial-ticket-band"><span>A&amp;N AIRWAYS</span><span>{t.pass}</span></div>
      <div className="ceremonial-ticket-content">
        <p className="ceremonial-ticket-label">{guestName?.trim() || t.boarding}</p>
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

function StaticJourney({ invitation, locale, guestName }: Omit<JourneyProps, 'reducedMotion'>) {
  const t = copy[locale];
  return (
    <section className="static-journey static-journey--daylight" aria-label={t.journeyLabel}>
      <div className="static-journey-intro">
        <p className="eyebrow">{journeyCopy[locale].boarding}</p>
        <h1>{t.welcome}</h1>
        <p className="journey-welcome-body">{journeyCopy[locale].staticBody}</p>
      </div>
      <div className="static-ticket"><DecorativeTicket invitation={invitation} locale={locale} guestName={guestName} /></div>
      <p className="static-journey-arrival">{journeyCopy[locale].arrival}</p>
    </section>
  );
}

export function Journey({ invitation, locale, reducedMotion, guestName }: JourneyProps) {
  const lowData = useLowDataMode();
  const staticMode = reducedMotion || lowData || typeof IntersectionObserver === 'undefined';
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cloudCanvasRef = useRef<HTMLCanvasElement>(null);
  const filmCanvasRef = useRef<HTMLCanvasElement>(null);
  const skyVideoRef = useRef<HTMLVideoElement>(null);
  // The living window is live only while its video is really playing; the
  // scroll driver reads this without re-subscribing.
  const liveSkyRef = useRef(false);
  const goldenVideoRef = useRef<HTMLVideoElement>(null);
  const liveGoldenRef = useRef(false);
  const refreshRef = useRef<() => void>(() => undefined);
  const [assetTier, setAssetTier] = useState(0);
  // Phone-only motion layers; decided once so a rotation never swaps scenes.
  const [motionLayers] = useState(() => !staticMode && typeof window !== 'undefined' && motionLayersAllowed());
  const [skyVideoFailed, setSkyVideoFailed] = useState(false);
  const [goldenVideoFailed, setGoldenVideoFailed] = useState(false);
  const t = copy[locale];
  const words = journeyCopy[locale];
  const design = designCopy[locale];
  const base = import.meta.env.BASE_URL;

  // One ScrollTrigger drives every journey layer from a single progress value.
  useEffect(() => {
    if (staticMode) return undefined;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return undefined;
    let cloudRenderer: CloudRenderer | null = null;
    let cloudAttempted = false;
    let driver: ScrollTrigger | null = null;
    let film: FilmStrip | null = null;
    let disposed = false;
    const canvas = cloudCanvasRef.current;
    const filmCanvas = filmCanvasRef.current;

    const apply = (progress: number) => {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      const frame = getJourneyFrame(progress, width, height);
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
      number('--ticket-press', frame.ticketPress);
      section.style.setProperty('--ticket-yaw', `${frame.ticketYaw}deg`);
      section.style.setProperty('--ticket-roll', `${frame.ticketRoll}deg`);
      px('--ticket-depth', frame.ticketDepth);
      number('--ticket-sheen', frame.ticketSheen);
      number('--film-opacity', frame.filmOpacity);
      number('--shade-open', frame.shadeOpen);
      if (film && frame.filmOpacity > 0) film.draw(frame.filmPosition);
      number('--takeoff-copy-opacity', frame.takeoffCopyOpacity);
      number('--cabin-copy-opacity', frame.cabinCopyOpacity);
      number('--cabin-opacity', frame.cabinOpacity);
      number('--cabin-scale', frame.cameraScale);
      const liveSky = liveSkyRef.current;
      number('--sky-opacity', liveSky ? frame.liveSkyOpacity : frame.skyOpacity);
      number('--live-sky-scale', frame.liveSkyScale);
      // Each loop only runs while its scene can be seen.
      const runLoop = (video: HTMLVideoElement | null, visible: boolean) => {
        if (!video) return;
        if (visible && video.paused) void video.play().catch(() => undefined);
        else if (!visible && !video.paused) video.pause();
      };
      if (liveSky) runLoop(skyVideoRef.current, frame.liveSkyOpacity > 0 && frame.goldenOpacity < 1 && !document.hidden);
      if (liveGoldenRef.current) runLoop(goldenVideoRef.current, frame.goldenOpacity > 0 && !document.hidden);
      number('--golden-opacity', frame.goldenOpacity);
      number('--golden-scale', frame.goldenScale);
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
      section.classList.toggle('journey--arriving', frame.progress > 0.8);
      setAssetTier((current) => Math.max(current, frame.assetTier));
      if (canvas && frame.progress >= .48 && !cloudAttempted && !liveSky) {
        cloudAttempted = true;
        cloudRenderer = createCloudRenderer(canvas);
        canvas.dataset.renderer = cloudRenderer ? 'webgl' : 'fallback';
      }
      if (cloudRenderer && !liveSky && frame.skyOpacity > 0 && frame.goldenOpacity < 1 && !document.hidden) {
        cloudRenderer.draw(frame.progress, width, height);
      }
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      cloudRenderer?.dispose();
      cloudRenderer = null;
      if (canvas) canvas.dataset.renderer = 'fallback';
    };
    const onContextRestored = () => {
      cloudAttempted = false;
      if (driver) apply(driver.progress);
    };

    refreshRef.current = () => { if (driver) apply(driver.progress); };

    // Take-off film: swap in only once every frame has arrived.
    if (motionLayers && filmCanvas) {
      void loadFilmFrames().then((images) => {
        if (disposed || !images) return;
        film = createFilmStrip(filmCanvas, images);
        if (!film) return;
        section.classList.add('journey--film');
        if (driver) apply(driver.progress);
      });
    }

    const context = gsap.context(() => {
      // Scene layers follow scroll exactly (no smoothing), so the camera and
      // the WebGL clouds stay locked to the guest's finger.
      driver = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => apply(self.progress),
      });

      // Kinetic captions: lines rise through a mask, with gentle smoothing.
      const captions = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.035 },
        scrollTrigger: { trigger: section, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
      });
      const lines = (selector: string) => {
        const element = section.querySelector<HTMLElement>(selector);
        return element ? SplitText.create(element, { type: 'lines', mask: 'lines', linesClass: 'kinetic-line' }).lines : [];
      };
      const takeoff = lines('.flight-caption--takeoff .flight-caption-text');
      const cabin = lines('.flight-caption--cabin .flight-caption-text');
      const arrival = lines('.journey-reveal p');
      captions
        .fromTo(takeoff, { yPercent: 110 }, { yPercent: 0, stagger: 0.012 }, 0.19)
        .to(takeoff, { yPercent: -110, ease: 'power2.in', stagger: 0.01 }, 0.335)
        .fromTo(cabin, { yPercent: 110 }, { yPercent: 0, stagger: 0.012 }, 0.44)
        .to(cabin, { yPercent: -110, ease: 'power2.in', stagger: 0.01 }, 0.548)
        .fromTo(arrival, { yPercent: 110 }, { yPercent: 0, stagger: 0.015, duration: 0.05 }, 0.88)
        .set({}, {}, 1);
    }, section);

    canvas?.addEventListener('webglcontextlost', onContextLost);
    canvas?.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      disposed = true;
      refreshRef.current = () => undefined;
      film?.dispose();
      section.classList.remove('journey--film');
      context.revert();
      canvas?.removeEventListener('webglcontextlost', onContextLost);
      canvas?.removeEventListener('webglcontextrestored', onContextRestored);
      cloudRenderer?.dispose();
    };
  }, [staticMode, locale, motionLayers]);

  const showSkyVideo = motionLayers && assetTier >= 2 && !skyVideoFailed;
  const setLiveSky = (live: boolean) => {
    if (liveSkyRef.current === live) return;
    liveSkyRef.current = live;
    sectionRef.current?.classList.toggle('journey--live-sky', live);
    refreshRef.current();
  };
  // Autoplay can be refused (Low Power Mode, some in-app browsers). The window
  // then keeps its photograph and the WebGL clouds, exactly as before.
  useEffect(() => {
    const video = skyVideoRef.current;
    const section = sectionRef.current;
    if (!showSkyVideo || !video) return undefined;
    const played = video.play();
    if (played && typeof played.catch === 'function') played.catch(() => setSkyVideoFailed(true));
    return () => {
      video.pause();
      liveSkyRef.current = false;
      section?.classList.remove('journey--live-sky');
    };
  }, [showSkyVideo]);

  // The arrival sky follows the same rules, one scene later.
  const showGoldenVideo = motionLayers && assetTier >= 3 && !goldenVideoFailed;
  const setLiveGolden = (live: boolean) => {
    if (liveGoldenRef.current === live) return;
    liveGoldenRef.current = live;
    sectionRef.current?.classList.toggle('journey--live-golden', live);
    refreshRef.current();
  };
  useEffect(() => {
    const video = goldenVideoRef.current;
    const section = sectionRef.current;
    if (!showGoldenVideo || !video) return undefined;
    const played = video.play();
    if (played && typeof played.catch === 'function') played.catch(() => setGoldenVideoFailed(true));
    return () => {
      video.pause();
      liveGoldenRef.current = false;
      section?.classList.remove('journey--live-golden');
    };
  }, [showGoldenVideo]);

  // Guests in a hurry can land straight on the invitation. The jump is
  // instant, so the film is not fast-forwarded on the way.
  const skipFlight = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById('invitation');
    if (!target) return;
    event.preventDefault();
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
    target.focus({ preventScroll: true });
  };

  if (staticMode) return <StaticJourney invitation={invitation} locale={locale} guestName={guestName} />;

  return (
    <section ref={sectionRef} className="journey journey--cinematic" aria-label={t.journeyLabel}>
      <div ref={stageRef} className="journey-stage">
        <div className="flight-airport" aria-hidden="true">{assetTier >= 1 && <ScenePicture asset={sceneAssets.airport} />}</div>
        <div className="flight-departure" aria-hidden="true">{assetTier >= 1 && <ScenePicture asset={sceneAssets.runway} />}</div>
        <div className="flight-runway-glow" aria-hidden="true"><span /><span /><span /></div>
        {motionLayers && <canvas ref={filmCanvasRef} className="flight-film" aria-hidden="true" />}
        <div className="flight-aircraft" aria-hidden="true">{assetTier >= 1 && <img src={`${base}${aircraftAsset}`} width="960" height="640" alt="" decoding="async" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />}</div>
        <div className="journey-cabin" aria-hidden="true">{assetTier >= 2 && <ScenePicture asset={sceneAssets.cabin} />}</div>
        <div className="journey-clouds" aria-hidden="true">
          {assetTier >= 2 && <ScenePicture asset={sceneAssets.sky} />}
          <canvas ref={cloudCanvasRef} className="flight-cloud-volume" />
          {showSkyVideo && <video ref={skyVideoRef} className="flight-sky-live" src={`${base}${windowSkyVideo}`}
            muted loop playsInline preload="auto" disablePictureInPicture aria-hidden="true" tabIndex={-1}
            onPlaying={() => setLiveSky(true)} onError={() => { setLiveSky(false); setSkyVideoFailed(true); }} />}
        </div>
        <div className="flight-shade" aria-hidden="true"><span className="flight-shade-panel" /></div>
        <div className="flight-golden" aria-hidden="true">
          {assetTier >= 2 && <ScenePicture asset={sceneAssets.golden} />}
          {showGoldenVideo && <video ref={goldenVideoRef} className="flight-golden-live" src={`${base}${goldenArrivalVideo}`}
            muted loop playsInline preload="auto" disablePictureInPicture aria-hidden="true" tabIndex={-1}
            onPlaying={() => setLiveGolden(true)} onError={() => { setLiveGolden(false); setGoldenVideoFailed(true); }} />}
        </div>
        <div className="flight-daylight" aria-hidden="true" />
        <div className="journey-opening">
          <div className="journey-intro">
            <p className="eyebrow">{words.boarding}</p>
            <h1>{t.welcome}</h1>
            <p className="journey-welcome-body">{t.welcomeBody}</p>
          </div>
          <div className="journey-ticket-slot"><div className="journey-ticket"><DecorativeTicket invitation={invitation} locale={locale} guestName={guestName} showChop /><span className="journey-ticket-sheen" /></div></div>
          <p className="journey-scroll-cue"><span>{words.scroll}</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v17m-5-5 5 5 5-5" /></svg></p>
        </div>
        <div className="flight-caption flight-caption--takeoff" aria-hidden="true"><p className="eyebrow">{words.takeoffLabel}</p><p className="flight-caption-text" key={`takeoff-${locale}`}>{words.takeoff}</p></div>
        <div className="flight-caption flight-caption--cabin" aria-hidden="true"><p className="eyebrow">{words.cabinLabel}</p><p className="flight-caption-text" key={`cabin-${locale}`}>{words.cabin}</p></div>
        <div className="journey-reveal" aria-hidden="true"><img src={`${base}monogram-a-and-n-display.webp`} width="640" height="640" alt="" decoding="async" /><p key={`arrival-${locale}`}>{words.arrival}</p></div>
        <a className="journey-skip" href="#invitation" aria-label={words.skipLabel} onClick={skipFlight}>
          <span>{words.skip}</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 6 7 6-7 6M13 6l7 6-7 6" /></svg>
        </a>
        <div className="flight-hud" aria-hidden="true">
          <span className="flight-hud-code">{design.routeFrom}</span>
          <span className="flight-hud-track">
            <svg viewBox="0 0 150 30">
              <path className="flight-hud-route" d={ROUTE_PATH} />
              <path className="flight-hud-trail" d={ROUTE_PATH} pathLength={1} />
            </svg>
            <span className="flight-hud-plane" style={{ offsetPath: `path('${ROUTE_PATH}')` } as CSSProperties}>
              <svg viewBox="0 0 32 32"><path d="m27 15-9-5V4c0-3-4-3-4 0v6l-9 5v3l9-3v8l-4 3v2l6-2 6 2v-2l-4-3v-8l9 3Z" /></svg>
            </span>
          </span>
          <span className="flight-hud-code">{design.routeTo}</span>
        </div>
      </div>
    </section>
  );
}
