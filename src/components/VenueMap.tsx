import { useEffect, useRef, useState } from 'react';
import { gsap } from '../motion/gsap';
import { useGsapScene } from '../motion/useGsapScene';
import { fastConnection } from '../filmStrip';
import { venueMapArt } from '../sceneAssets';

// The walk, drawn over the paper model in the artwork's own 1280 x 958 space:
// up from the MRT station, across the forecourt into Terminal 3, then along
// the link bridge to the hotel.
const ROUTE = 'M236 846 C 318 800, 410 716, 478 640 S 560 566, 598 532 C 640 494, 700 432, 772 372 S 930 318, 1022 296';
const STOPS = [
  { name: 'Changi Airport MRT', x: 236, y: 846, at: 0 },
  { name: 'Terminal 3', x: 598, y: 532, at: 0.47 },
  { name: 'Crowne Plaza', x: 1022, y: 296, at: 1 },
] as const;
const percent = (value: number, size: number) => `${(value / size) * 100}%`;

/**
 * Illustrated walking route from Changi Airport MRT through Terminal 3 to
 * Crowne Plaza, over a paper model of the airport. Decorative: the written
 * directions remain the source of truth. With motion, the route draws itself
 * as the guest scrolls and the model comes alive with a small muted loop.
 */
export function VenueMap({ motion }: { motion: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const base = import.meta.env.BASE_URL;
  // The loop is fetched only once the map is close, on a connection that can afford it.
  const [loop] = useState(() => motion && fastConnection());
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!loop || !map) return undefined;
    const approach = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: '120% 0px' });
    const view = new IntersectionObserver((entries) => setInView(entries.some((entry) => entry.isIntersecting)), { threshold: 0.15 });
    approach.observe(map);
    view.observe(map);
    return () => { approach.disconnect(); view.disconnect(); };
  }, [loop]);

  const showVideo = loop && near && !failed;
  // Plays only while the map is on screen; a refused autoplay keeps the still.
  useEffect(() => {
    const video = videoRef.current;
    if (!showVideo || !video) return undefined;
    if (!inView) { video.pause(); return undefined; }
    const played = video.play();
    if (played && typeof played.catch === 'function') played.catch(() => setFailed(true));
    return undefined;
  }, [showVideo, inView]);

  useGsapScene(mapRef, () => {
    const map = mapRef.current!;
    const trail = map.querySelector<SVGPathElement>('.venue-map-trail')!;
    const traveller = map.querySelector<HTMLElement>('.venue-map-traveller')!;
    const stops = [...map.querySelectorAll<HTMLElement>('.venue-map-stop')];
    const steps = [...map.querySelectorAll<HTMLElement>('.venue-map-step')];
    const length = typeof trail.getTotalLength === 'function' ? trail.getTotalLength() : 0;
    const state = { progress: 0 };
    const render = () => {
      trail.style.strokeDashoffset = `${1 - state.progress}`;
      if (length) {
        const point = trail.getPointAtLength(length * state.progress);
        traveller.style.left = percent(point.x, venueMapArt.width);
        traveller.style.top = percent(point.y, venueMapArt.height);
      }
      traveller.style.opacity = state.progress > 0.01 && state.progress < 0.995 ? '1' : '0';
      STOPS.forEach((stop, index) => {
        const reached = state.progress > 0.005 && state.progress >= stop.at - 0.03;
        stops[index]?.classList.toggle('is-reached', reached);
        steps[index]?.classList.toggle('is-reached', reached);
      });
    };
    render();
    gsap.to(state, {
      progress: 1,
      ease: 'none',
      onUpdate: render,
      scrollTrigger: { trigger: map, start: 'top 78%', end: 'bottom 72%', scrub: 0.5 },
    });
    return () => {
      trail.style.strokeDashoffset = '';
      traveller.style.opacity = '';
      [...stops, ...steps].forEach((element) => element.classList.remove('is-reached'));
    };
  }, motion);

  return (
    <div ref={mapRef} className={`venue-map${motion ? ' venue-map--motion' : ''}${live ? ' venue-map--live' : ''}`} aria-hidden="true">
      <div className="venue-map-scene">
        <picture>
          <source type="image/avif" srcSet={`${base}${venueMapArt.avif}`} />
          <img src={`${base}${venueMapArt.webp}`} width={venueMapArt.width} height={venueMapArt.height} alt="" loading="lazy" decoding="async" />
        </picture>
        {showVideo && <video ref={videoRef} className="venue-map-loop" src={`${base}${venueMapArt.video}`}
          muted loop playsInline preload="auto" disablePictureInPicture tabIndex={-1}
          onPlaying={() => setLive(true)} onError={() => { setLive(false); setFailed(true); }} />}
        <svg className="venue-map-overlay" viewBox={`0 0 ${venueMapArt.width} ${venueMapArt.height}`} preserveAspectRatio="none">
          <path d={ROUTE} className="venue-map-route" />
          <path d={ROUTE} className="venue-map-trail" pathLength={1} />
        </svg>
        <span className="venue-map-traveller" />
        {STOPS.map((stop, index) => (
          <span key={stop.name} className={`venue-map-stop${index === STOPS.length - 1 ? ' venue-map-stop--destination' : ''}`}
            style={{ left: percent(stop.x, venueMapArt.width), top: percent(stop.y, venueMapArt.height) }}>{index + 1}</span>
        ))}
      </div>
      <ol className="venue-map-steps">
        {STOPS.map((stop, index) => (
          <li key={stop.name} className="venue-map-step"><span>{index + 1}</span>{stop.name}</li>
        ))}
      </ol>
    </div>
  );
}
