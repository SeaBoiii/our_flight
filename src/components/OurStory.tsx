import { useRef, type CSSProperties } from 'react';
import { copy } from '../copy';
import { designCopy } from '../designCopy';
import { gsap, ScrollTrigger, SplitText } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';
import type { Locale } from '../types';

type OurStoryProps = { locale: Locale; motion: boolean };

function PostcardStamp({ index }: { index: number }) {
  // Small engraved stamps: a crescent and star, two rings, a paper plane.
  const art = [
    <path key="a" d="M24 12a10 10 0 1 0 7 17 8 8 0 1 1-7-17Zm9 3 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3Z" />,
    <g key="b" fill="none" strokeWidth="1.6"><circle cx="20" cy="24" r="8" /><circle cx="29" cy="24" r="8" /></g>,
    <path key="c" d="m10 25 28-11-9 22-5-8-14-3Zm14 3 14-14" fill="none" strokeWidth="1.6" strokeLinejoin="round" />,
  ][index % 3];
  return (
    <svg className="postcard-stamp" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="3" y="3" width="42" height="42" rx="2" fill="none" strokeDasharray="2 2.6" strokeWidth="1.2" />
      {art}
    </svg>
  );
}

export function OurStory({ locale, motion }: OurStoryProps) {
  const t = copy[locale];
  const words = designCopy[locale];
  const sectionRef = useRef<HTMLElement>(null);
  const chapters = [t.storyBeginning, t.storyJourney, t.storyClosing];

  useGsapScene(sectionRef, () => {
    const section = sectionRef.current!;
    // The quote inks in word by word as it passes through the viewport.
    const quote = section.querySelector<HTMLElement>('.our-story-quote');
    if (quote) {
      const split = SplitText.create(quote, { type: 'words', wordsClass: 'ink-word' });
      gsap.fromTo(split.words, { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.08,
        scrollTrigger: { trigger: quote, start: 'top 82%', end: 'bottom 48%', scrub: true },
      });
    }
    // The dashed flight line draws itself.
    gsap.fromTo('.story-flight-trail', { strokeDashoffset: 1 }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: '.story-flight-line', start: 'top 85%', end: 'bottom 45%', scrub: true },
    });
    // Each postcard settles back slightly as the next slides over it.
    const cards = gsap.utils.toArray<HTMLElement>('.postcard', section);
    cards.forEach((card, index) => {
      const next = cards[index + 1];
      gsap.from(card, { y: 60, rotation: index % 2 ? 2.5 : -2.5, opacity: 0, duration: 0.9,
        scrollTrigger: { trigger: card, start: 'top 88%', once: true } });
      if (next) {
        gsap.to(card, { scale: 0.93, rotation: index % 2 ? 1.2 : -1.2, ease: 'none',
          scrollTrigger: { trigger: next, start: 'top 90%', end: 'top 30%', scrub: true } });
      }
    });
    ScrollTrigger.refresh();
  }, motion, [locale]);

  return (
    <section ref={sectionRef} className="our-story-section" aria-labelledby="our-story-title">
      <div className="our-story-inner">
        <h2 id="our-story-title">{t.ourStory}</h2>
        <svg className="story-flight-line" viewBox="0 0 560 96" fill="none" aria-hidden="true">
          <path d="M8 70C94 70 109 19 181 19C280 19 282 81 376 81C455 81 480 28 552 28" stroke="currentColor" strokeDasharray="3 7" opacity=".45" />
          <path className="story-flight-trail" d="M8 70C94 70 109 19 181 19C280 19 282 81 376 81C455 81 480 28 552 28" stroke="currentColor" strokeWidth="1.4" pathLength={1} strokeDasharray="1" />
          <circle cx="8" cy="70" r="4" fill="currentColor" />
          <circle cx="552" cy="28" r="4" fill="currentColor" />
        </svg>
        <blockquote key={`quote-${locale}`}>
          <p className="our-story-quote">{t.storyQuote}</p>
        </blockquote>
        <ol className="postcards">
          {chapters.map((chapter, index) => (
            <li className={`postcard${index === chapters.length - 1 ? ' postcard--closing' : ''}`} key={`${locale}-${index}`} style={{ '--i': index } as CSSProperties}>
              <div className="postcard-meta">
                <span>{String(index + 1).padStart(2, '0')} / 03</span>
                <span>{words.postcardStamps[index]}</span>
              </div>
              <p>{index === chapters.length - 1 ? <em>{chapter}</em> : chapter}</p>
              <PostcardStamp index={index} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
