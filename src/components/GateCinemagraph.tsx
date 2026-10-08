import { useEffect, useMemo, useRef, useState } from 'react';
import { networkConnection } from '../network';

type GateCinemagraphProps = { reducedMotion: boolean; lowData: boolean };

const PORTRAIT_QUERY = '(max-width: 799px)';

function connectionIsFast(): boolean {
  // effectiveType is the browser's own smoothed estimate; raw downlink values
  // fluctuate too much to gate on. Browsers without the API (Safari) are allowed.
  const network = networkConnection();
  if (!network) return true;
  if (network.saveData) return false;
  return !network.effectiveType || network.effectiveType === '4g';
}

/**
 * A quiet, looping cinemagraph of the check-in photograph (twinkling apron
 * lights, shimmering reflections). Purely decorative and strictly optional:
 * the still photograph underneath is the poster and the LCP image. The video
 * is requested only after the page has settled, only on phones in portrait,
 * only on fast connections, and never with reduced motion or data saver.
 * If autoplay is refused (Low Power Mode, some in-app browsers) it is removed.
 */
export function GateCinemagraph({ reducedMotion, lowData }: GateCinemagraphProps) {
  const [source, setSource] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (reducedMotion || lowData || typeof window.matchMedia !== 'function') return undefined;
    if (!window.matchMedia(PORTRAIT_QUERY).matches || !connectionIsFast()) return undefined;
    let timer = 0;
    const begin = () => {
      timer = window.setTimeout(() => setSource(`${import.meta.env.BASE_URL}flight/gate-cinemagraph-portrait.mp4`), 900);
    };
    if (document.readyState === 'complete') begin();
    else window.addEventListener('load', begin, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', begin);
    };
  }, [reducedMotion, lowData]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return undefined;
    const attempt = () => {
      const played = video.play();
      if (played && typeof played.catch === 'function') played.catch(() => setSource(null));
    };
    const onVisibility = () => { if (document.hidden) video.pause(); else attempt(); };
    attempt();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      video.pause();
    };
  }, [source]);

  // Join the photograph's slow push-in at its current point (measured once),
  // so the cross-fade never shows two different scales.
  const animationDelay = useMemo(() => {
    if (!source) return '0s';
    const still = document.querySelector('.gate-background img');
    return `${-Number(still?.getAnimations?.()[0]?.currentTime ?? 0) / 1000}s`;
  }, [source]);

  if (!source) return null;
  return (
    <video
      ref={videoRef}
      style={{ animationDelay }}
      className={`gate-cinemagraph${playing ? ' gate-cinemagraph--playing' : ''}`}
      src={source}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onError={() => setSource(null)}
    />
  );
}
