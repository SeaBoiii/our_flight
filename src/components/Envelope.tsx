import { useRef } from 'react';
import { designCopy } from '../designCopy';
import { gsap } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';
import { waxSealAsset } from '../sceneAssets';
import type { Locale } from '../types';

type EnvelopeProps = { locale: Locale; guestName?: string };

/**
 * A scroll-scrubbed prelude to the formal invitation: the wax seal lifts, the
 * flap opens and the card rises. Purely decorative; the invitation that
 * follows carries all of the words. Only mounted when motion is allowed.
 */
export function Envelope({ locale, guestName }: EnvelopeProps) {
  const sceneRef = useRef<HTMLElement>(null);
  const words = designCopy[locale];
  const base = import.meta.env.BASE_URL;

  useGsapScene(sceneRef, () => {
    const scene = sceneRef.current!;
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: scene, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
    timeline
      .to('.envelope-hint', { opacity: 0, y: 12, duration: 0.1 }, 0.02)
      .to('.envelope-seal', { y: -36, scale: 1.18, rotation: -14, duration: 0.16, ease: 'power2.out' }, 0.04)
      .to('.envelope-seal', { y: -160, opacity: 0, rotation: -28, duration: 0.14, ease: 'power2.in' }, 0.18)
      .to('.envelope-flap', { rotationX: 180, duration: 0.24, ease: 'power2.inOut' }, 0.16)
      .set('.envelope-flap', { zIndex: 1 }, 0.28)
      .to('.envelope-card', { yPercent: -62, duration: 0.3, ease: 'power2.out' }, 0.36)
      .to('.envelope-body', { yPercent: 70, opacity: 0, duration: 0.24, ease: 'power2.in' }, 0.66)
      .to('.envelope-card', { yPercent: -8, scale: 1.18, duration: 0.26, ease: 'power2.inOut' }, 0.66)
      .to('.envelope-flap', { opacity: 0, duration: 0.14 }, 0.66)
      .to('.envelope-glow', { opacity: 1, scale: 1.4, duration: 0.3 }, 0.6)
      .to(['.envelope', '.envelope-glow'], { opacity: 0, y: -24, duration: 0.1, ease: 'power2.in' }, 0.9);
  }, true);

  return (
    <section ref={sceneRef} className="envelope-scene" aria-hidden="true">
      <div className="envelope-stage">
        <div className="envelope-glow" />
        <div className="envelope">
          <div className="envelope-body envelope-back" />
          <div className="envelope-card">
            <img src={`${base}monogram-a-and-n-display.webp`} width="599" height="381" alt="" decoding="async" />
            <p className="envelope-card-label">{words.envelopeLabel}</p>
            {guestName ? <p className="envelope-card-guest">{guestName}</p> : null}
            <p className="envelope-card-names">Aleem <span>&amp;</span> Nurulain</p>
          </div>
          <div className="envelope-body envelope-front" />
          <div className="envelope-flap" />
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
