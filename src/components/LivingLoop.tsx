import { useEffect, useRef, useState, type RefObject } from 'react';

type LivingLoopProps = {
  /** The element whose approach and visibility decide loading and playback. */
  watch: RefObject<HTMLElement | null>;
  src: string;
  className: string;
  /** False keeps the still underneath: reduced motion, low data, slow network. */
  enabled: boolean;
};

/**
 * A small muted loop laid over a still photograph. It is fetched only as its
 * scene draws near, plays only while that scene is on screen, and gains the
 * class `is-live` once it is really playing. If autoplay is refused or the
 * file fails, it removes itself and the still remains.
 */
export function LivingLoop({ watch, src, className, enabled }: LivingLoopProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const scene = watch.current;
    if (!enabled || !scene || typeof IntersectionObserver === 'undefined') return undefined;
    const approach = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { rootMargin: '120% 0px' });
    const view = new IntersectionObserver((entries) => setInView(entries.some((entry) => entry.isIntersecting)), { threshold: 0.12 });
    approach.observe(scene);
    view.observe(scene);
    return () => { approach.disconnect(); view.disconnect(); };
  }, [enabled, watch]);

  const show = enabled && near && !failed;
  useEffect(() => {
    const video = videoRef.current;
    if (!show || !video) return undefined;
    if (!inView) { video.pause(); return undefined; }
    const played = video.play();
    if (played && typeof played.catch === 'function') played.catch(() => setFailed(true));
    return undefined;
  }, [show, inView]);

  if (!show) return null;
  return (
    <video ref={videoRef} className={`${className}${live ? ' is-live' : ''}`} src={src}
      muted loop playsInline preload="auto" disablePictureInPicture aria-hidden="true" tabIndex={-1}
      onPlaying={() => setLive(true)} onError={() => { setLive(false); setFailed(true); }} />
  );
}
