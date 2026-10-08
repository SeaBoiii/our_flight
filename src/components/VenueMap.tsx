import { useRef } from 'react';
import { gsap } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';

const ROUTE = 'M46 152 C 72 152, 84 132, 104 122 S 140 112, 169 112 L 214 112 C 238 112, 250 92, 268 74';

/**
 * Illustrated walking route from Changi Airport MRT through Terminal 3 to
 * Crowne Plaza. Decorative: the written directions remain the source of truth.
 */
export function VenueMap({ motion }: { motion: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);

  useGsapScene(mapRef, () => {
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: mapRef.current, start: 'top 80%', end: 'bottom 45%', scrub: 0.4 },
    });
    timeline
      .fromTo('.venue-map-trail', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1 }, 0)
      .fromTo('.venue-map-stop', { scale: 0.4, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 0.18, stagger: 0.4, transformOrigin: '50% 50%', ease: 'expo.out' }, 0);
  }, motion);

  return (
    <div ref={mapRef} className="venue-map" aria-hidden="true">
      <svg viewBox="0 0 320 190">
        <defs>
          <pattern id="venue-map-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0v16" fill="none" stroke="currentColor" strokeOpacity=".08" />
          </pattern>
        </defs>
        <rect width="320" height="190" fill="url(#venue-map-grid)" />
        {/* Runway and taxiway hints */}
        <path d="M18 178 300 140" className="venue-map-runway" />
        <path d="M30 184 300 150" className="venue-map-runway venue-map-runway--dash" />
        {/* Terminal 3 */}
        <rect x="134" y="66" width="70" height="40" rx="6" className="venue-map-building" />
        <text x="169" y="93" textAnchor="middle" className="venue-map-glyph">T3</text>
        {/* Crowne Plaza */}
        <path d="M262 46h34v42h-34z" className="venue-map-building venue-map-building--hotel" />
        <path d="M268 54h6M268 62h6M268 70h6M284 54h6M284 62h6M284 70h6" className="venue-map-windows" />
        {/* Route */}
        <path d={ROUTE} className="venue-map-route" />
        <path d={ROUTE} className="venue-map-trail" pathLength={1} />
        <g className="venue-map-stop"><circle cx="46" cy="152" r="9" /><text x="46" y="155.5" textAnchor="middle">M</text></g>
        <g className="venue-map-stop"><circle cx="169" cy="112" r="5" /></g>
        <g className="venue-map-stop venue-map-stop--destination"><circle cx="268" cy="74" r="7" /><path d="m268 70 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3Z" /></g>
        <text x="46" y="176" textAnchor="middle" className="venue-map-label">CHANGI MRT</text>
        <text x="169" y="130" textAnchor="middle" className="venue-map-label">TERMINAL 3</text>
        <text x="279" y="104" textAnchor="middle" className="venue-map-label">CROWNE PLAZA</text>
      </svg>
    </div>
  );
}
