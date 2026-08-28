import { useEffect, useRef, type RefObject } from 'react';
import { copy } from '../copy';
import { getWindowAperture, getWindowExitScale } from '../journeyMotion';
import type { Invitation, Locale } from '../types';
import { BoardingPass } from './BoardingPass';

type JourneyProps = {
  invitation: Invitation;
  locale: Locale;
  reducedMotion: boolean;
};

function CabinPicture({ alt, eager = false }: { alt: string; eager?: boolean }) {
  const base = import.meta.env.BASE_URL;
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`${base}journey/cabin-480.avif 480w, ${base}journey/cabin-768.avif 768w, ${base}journey/cabin-1024.avif 1024w`}
        sizes="1024px"
      />
      <source
        type="image/webp"
        srcSet={`${base}journey/cabin-480.webp 480w, ${base}journey/cabin-768.webp 768w, ${base}journey/cabin-1024.webp 1024w`}
        sizes="1024px"
      />
      <img
        src={`${base}journey/cabin-768.webp`}
        width="1024"
        height="1536"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        alt={alt}
      />
    </picture>
  );
}

function CloudPoster({ alt }: { alt: string }) {
  const base = import.meta.env.BASE_URL;
  return (
    <img
      src={`${base}journey/clouds-video-poster.webp`}
      width="1280"
      height="720"
      loading="lazy"
      decoding="async"
      alt={alt}
    />
  );
}

function CloudVideo({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
  const base = import.meta.env.BASE_URL;
  return (
    <video
      ref={videoRef}
      className="journey-cloud-video"
      autoPlay
      loop
      muted
      playsInline
      preload="metadata"
      poster={`${base}journey/clouds-video-poster.webp`}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    >
      <source src={`${base}journey/clouds-ping-pong.mp4`} type="video/mp4" />
    </video>
  );
}

function ReducedJourney({ invitation, locale }: Omit<JourneyProps, 'reducedMotion'>) {
  const t = copy[locale];
  return (
    <section className="static-journey" aria-label={t.journeyLabel}>
      <div className="static-journey-intro">
        <p className="eyebrow">{t.flightTheme}</p>
        <h1>{t.welcome}</h1>
        <p>{t.welcomeBody}</p>
      </div>
      <figure className="static-scene">
        <CabinPicture alt={t.cabinAlt} />
      </figure>
      <figure className="static-scene static-window-scene">
        <div className="static-window-frame">
          <CloudPoster alt={t.cloudsAlt} />
        </div>
        <figcaption>{t.throughWindow}</figcaption>
      </figure>
      <div className="static-ticket">
        <BoardingPass invitation={invitation} locale={locale} compact stamped />
      </div>
    </section>
  );
}

function phase(value: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (value - start) / (end - start)));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Keeps the cloud reveal attached to the real photographed window while the
 * cabin camera advances. The cloud photograph itself never scales.
 */
function setCloudAperture(
  section: HTMLElement,
  viewportWidth: number,
  viewportHeight: number,
  cameraScale: number,
): void {
  const aperture = getWindowAperture(viewportWidth, viewportHeight, cameraScale);
  const setPixelProperty = (name: string, value: number) => {
    section.style.setProperty(name, `${value}px`);
  };

  // Negative insets carry the rounded corners beyond the viewport instead of
  // flattening the opening into a separate full-screen rounded rectangle.
  setPixelProperty('--cloud-clip-left', aperture.left);
  setPixelProperty('--cloud-clip-right', viewportWidth - aperture.right);
  setPixelProperty('--cloud-clip-top', aperture.top);
  setPixelProperty('--cloud-clip-bottom', viewportHeight - aperture.bottom);
  setPixelProperty('--cloud-clip-radius-x', aperture.width * 0.48);
  setPixelProperty('--cloud-clip-radius-y', aperture.height * 0.18);
}

export function Journey({ invitation, locale, reducedMotion }: JourneyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cloudVideoRef = useRef<HTMLVideoElement>(null);
  const t = copy[locale];
  const logo = `${import.meta.env.BASE_URL}monogram-a-and-n-display.png`;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return undefined;

    let raf = 0;
    let listening = false;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const stageWidth = Math.max(1, stage.clientWidth);
      const stageHeight = Math.max(1, stage.clientHeight);
      const distance = Math.max(1, rect.height - stageHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const ticketExit = phase(progress, 0.17, 0.37);
      const cabinIn = phase(progress, 0.18, 0.34);
      const windowProgress = smoothstep(phase(progress, 0.34, 0.79));
      const cloudsIn = phase(progress, 0.32, 0.43);
      const cabinOut = phase(progress, 0.77, 0.88);
      const cameraScale = mix(
        1,
        getWindowExitScale(stageWidth, stageHeight),
        windowProgress,
      );

      section.style.setProperty('--ticket-y', `${ticketExit * -38}vh`);
      section.style.setProperty('--ticket-opacity', `${1 - ticketExit}`);
      section.style.setProperty('--stamp-opacity', `${phase(progress, 0.03, 0.14) * (1 - ticketExit)}`);
      section.style.setProperty('--cabin-opacity', `${cabinIn * (1 - cabinOut)}`);
      section.style.setProperty('--cabin-scale', `${cameraScale}`);
      section.style.setProperty('--cloud-opacity', `${cloudsIn}`);
      section.style.setProperty('--intro-opacity', `${1 - phase(progress, 0.2, 0.34)}`);
      section.style.setProperty('--reveal-opacity', `${phase(progress, 0.84, 0.96)}`);
      setCloudAperture(
        section,
        stageWidth,
        stageHeight,
        cameraScale,
      );
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    const addListeners = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate, { passive: true });
      const video = cloudVideoRef.current;
      if (video?.paused) void video.play().catch(() => undefined);
      requestUpdate();
    };
    const removeListeners = () => {
      cloudVideoRef.current?.pause();
      if (!listening) return;
      listening = false;
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting ? addListeners() : removeListeners(),
      { rootMargin: '100% 0px' },
    );
    observer.observe(section);

    return () => {
      observer.disconnect();
      removeListeners();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reducedMotion]);

  if (reducedMotion) {
    return <ReducedJourney invitation={invitation} locale={locale} />;
  }

  return (
    <section ref={sectionRef} className="journey" aria-label={t.journeyLabel}>
      <div ref={stageRef} className="journey-stage">
        <div className="journey-cabin" aria-hidden="true">
          <CabinPicture alt="" eager />
        </div>
        <div className="journey-clouds" aria-hidden="true">
          <CloudVideo videoRef={cloudVideoRef} />
        </div>

        <div
          className={`journey-ticket journey-ticket--${invitation.cabinClass}`}
          aria-hidden="true"
        >
          <BoardingPass invitation={invitation} locale={locale} compact stamped />
        </div>

        <div className="journey-intro">
          <p className="eyebrow">{t.flightTheme}</p>
          <h1>{t.welcome}</h1>
          <p>{t.welcomeBody}</p>
        </div>

        <div className="journey-reveal" aria-hidden="true">
          <img src={logo} alt="" />
          <p>{t.throughWindow}</p>
        </div>
      </div>
    </section>
  );
}
