import { useEffect, useRef } from 'react';
import { copy } from '../copy';
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
        sizes="100vw"
      />
      <source
        type="image/webp"
        srcSet={`${base}journey/cabin-480.webp 480w, ${base}journey/cabin-768.webp 768w, ${base}journey/cabin-1024.webp 1024w`}
        sizes="100vw"
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

function CloudPicture({ alt, sizes = '100vw' }: { alt: string; sizes?: string }) {
  const base = import.meta.env.BASE_URL;
  return (
    <picture>
      <source
        type="image/avif"
        srcSet={`${base}journey/clouds-480.avif 480w, ${base}journey/clouds-768.avif 768w, ${base}journey/clouds-1280.avif 1280w`}
        sizes={sizes}
      />
      <source
        type="image/webp"
        srcSet={`${base}journey/clouds-480.webp 480w, ${base}journey/clouds-768.webp 768w, ${base}journey/clouds-1280.webp 1280w`}
        sizes={sizes}
      />
      <img
        src={`${base}journey/clouds-768.webp`}
        width="1280"
        height="853"
        loading="lazy"
        decoding="async"
        alt={alt}
      />
    </picture>
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
          <CloudPicture alt={t.cloudsAlt} sizes="(max-width: 799px) 70vw, 350px" />
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

export function Journey({ invitation, locale, reducedMotion }: JourneyProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const t = copy[locale];
  const logo = `${import.meta.env.BASE_URL}monogram-a-and-n-display.png`;

  useEffect(() => {
    if (reducedMotion) return undefined;
    const section = sectionRef.current;
    if (!section) return undefined;

    let raf = 0;
    let listening = false;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      const ticketExit = phase(progress, 0.17, 0.37);
      const cabinIn = phase(progress, 0.18, 0.34);
      const windowProgress = phase(progress, 0.34, 0.74);
      const cloudsIn = phase(progress, 0.62, 0.84);
      const cabinOut = phase(progress, 0.64, 0.79);

      section.style.setProperty('--ticket-y', `${ticketExit * -38}vh`);
      section.style.setProperty('--ticket-opacity', `${1 - ticketExit}`);
      section.style.setProperty('--stamp-opacity', `${phase(progress, 0.03, 0.14) * (1 - ticketExit)}`);
      section.style.setProperty('--cabin-opacity', `${cabinIn * (1 - cabinOut)}`);
      section.style.setProperty('--cabin-scale', `${1 + windowProgress * 0.13}`);
      section.style.setProperty('--window-opacity', `${phase(progress, 0.3, 0.43) * (1 - cloudsIn * 0.7)}`);
      section.style.setProperty('--window-scale', `${0.72 + windowProgress * 3.4}`);
      section.style.setProperty('--cloud-opacity', `${cloudsIn}`);
      section.style.setProperty('--cloud-x', `${(progress - 0.62) * -28}px`);
      section.style.setProperty('--intro-opacity', `${1 - phase(progress, 0.2, 0.34)}`);
      section.style.setProperty('--reveal-opacity', `${phase(progress, 0.78, 0.94)}`);
    };

    const requestUpdate = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    const addListeners = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate, { passive: true });
      requestUpdate();
    };
    const removeListeners = () => {
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
      <div className="journey-stage">
        <div className="journey-cabin" aria-hidden="true">
          <CabinPicture alt="" eager />
        </div>
        <div className="journey-clouds" aria-hidden="true">
          <CloudPicture alt="" sizes="(max-width: 799px) 36vw, 260px" />
        </div>

        <div className="journey-window" aria-hidden="true">
          <div className="journey-window-frame">
            <CloudPicture alt="" />
          </div>
        </div>

        <div
          className={`journey-ticket${invitation.events.length > 1 ? ' journey-ticket--multiple' : ''}`}
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
