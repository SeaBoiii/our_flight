import { useEffect, useRef, useState } from 'react';
import { designCopy } from '../designCopy';
import { gsap } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';
import { envelopeArt, waxSealAsset } from '../sceneAssets';
import type { Locale } from '../types';

type EnvelopeProps = { locale: Locale; guestName?: string };

const SPARKS = [0, 1, 2, 3, 4, 5, 6];

/**
 * A scroll-scrubbed prelude to the formal invitation, styled after the printed
 * boarding-pass card: arch-window light falls across linen, the wax seal
 * lifts, the flap opens on a night-sky liner and the card rises out of the
 * golden hour. Purely decorative; the invitation that follows carries all of
 * the words. Only mounted when motion is allowed.
 */
export function Envelope({ locale, guestName }: EnvelopeProps) {
  const sceneRef = useRef<HTMLElement>(null);
  // The photographic layers are fetched only as the scene draws near.
  const [near, setNear] = useState(false);
  const words = designCopy[locale];
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || near) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: '250% 0px' });
    observer.observe(scene);
    return () => observer.disconnect();
  }, [near]);

  useGsapScene(sceneRef, () => {
    const scene = sceneRef.current!;
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
    timeline
      // The light finds the envelope, which settles flat on the cloth.
      .fromTo('.envelope-linen', { opacity: 0 }, { opacity: 1, duration: 0.12 }, 0)
      .fromTo('.envelope', { rotationX: 16, rotationZ: -4, y: 26, scale: 0.94 }, { rotationX: 0, rotationZ: 0, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' }, 0)
      .to('.envelope-hint', { opacity: 0, y: 12, duration: 0.1 }, 0.02)
      // The seal is pressed once, then lifts away.
      .to('.envelope-seal', { scale: 0.94, duration: 0.03, ease: 'power1.in' }, 0.03)
      .to('.envelope-seal', { y: -44, scale: 1.2, rotation: -14, duration: 0.08, ease: 'power2.out' }, 0.06)
      .to('.envelope-seal', { y: -190, opacity: 0, rotation: -30, duration: 0.08, ease: 'power2.in' }, 0.14)
      // The flap turns over and shows its night-sky liner.
      .to('.envelope-flap', { rotationX: 180, duration: 0.26, ease: 'power2.inOut' }, 0.18)
      .fromTo('.envelope-flap', { '--flap-turn': 0 }, { '--flap-turn': 1, duration: 0.13, ease: 'power1.in' }, 0.18)
      .set('.envelope-flap', { zIndex: 1 }, 0.32)
      .fromTo('.envelope-spark', { opacity: 0, y: 0, scale: 0.4 }, { opacity: 1, y: -46, scale: 1, duration: 0.1, stagger: 0.022, ease: 'power1.out' }, 0.36)
      .to('.envelope-spark', { opacity: 0, y: -118, duration: 0.12, stagger: 0.022, ease: 'power1.in' }, 0.46)
      // The card rises out of the golden hour and comes forward.
      .fromTo('.envelope-card', { yPercent: 56 }, { yPercent: -64, duration: 0.3, ease: 'power2.out' }, 0.38)
      .to('.envelope-glow', { opacity: 1, scale: 1.4, duration: 0.3 }, 0.6)
      .to('.envelope-body', { yPercent: 70, opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.68)
      // The flap keeps its two faces: it travels with the body and its faces fade.
      .to('.envelope-flap', { yPercent: 113, duration: 0.22, ease: 'power2.in' }, 0.68)
      .to('.envelope-flap-face', { opacity: 0, duration: 0.22, ease: 'power2.in' }, 0.68)
      .to('.envelope-card', { yPercent: -8, scale: 1.16, duration: 0.24, ease: 'power2.inOut' }, 0.68)
      .to(['.envelope', '.envelope-glow', '.envelope-linen'], { opacity: 0, duration: 0.09, ease: 'power2.in' }, 0.91)
      .to('.envelope', { y: -24, duration: 0.09, ease: 'power2.in' }, 0.91);
  }, true);

  return (
    <section ref={sceneRef} className={`envelope-scene${near ? ' envelope-scene--art' : ''}`} aria-hidden="true">
      <div className="envelope-stage">
        <div className="envelope-linen" />
        <div className="envelope-glow" />
        <div className="envelope">
          <div className="envelope-body envelope-back" />
          <div className="envelope-pocket"><div className="envelope-card">
            {near && <img className="envelope-card-arch" src={`${base}${envelopeArt.archWindow}`} width="336" height="600" alt="" decoding="async" />}
            <div className="envelope-card-copy">
              <p className="envelope-card-label">{words.envelopeLabel}</p>
              <p className="envelope-card-names">Aleem <span>&amp;</span> Nurulain</p>
              {guestName ? <p className="envelope-card-guest">{guestName}</p> : null}
              <p className="envelope-card-route"><span>{words.routeFrom}</span><i /><svg viewBox="0 0 24 24"><path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" /></svg><i /><span>{words.routeTo}</span></p>
            </div>
          </div></div>
          <div className="envelope-body envelope-front" />
          <div className="envelope-sparks">{SPARKS.map((spark) => <span key={spark} className="envelope-spark" />)}</div>
          <div className="envelope-flap">
            <div className="envelope-flap-face envelope-flap-outer" />
            <div className="envelope-flap-face envelope-flap-inner" />
          </div>
          <div className="envelope-seal">
            <img src={`${base}${waxSealAsset}`} width="360" height="360" alt="" decoding="async" />
            <span className="envelope-seal-mark" />
          </div>
        </div>
        <p className="envelope-hint">{words.envelopeHint}<svg viewBox="0 0 24 24"><path d="M12 3v17m-5-5 5 5 5-5" /></svg></p>
      </div>
    </section>
  );
}
