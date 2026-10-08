// Opt-in background music. Nothing is requested or played until the guest
// chooses it with a tap, which is also the gesture browsers require for audio.
import { useSyncExternalStore } from 'react';

export type MusicStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';
export type MusicSnapshot = { preferred: boolean; status: MusicStatus };

const PREFERENCE_KEY = 'our-flight:music';
const TARGET_VOLUME = 0.55;

let audio: HTMLAudioElement | null = null;
let fadeFrame = 0;
let snapshot: MusicSnapshot = { preferred: readPreference(), status: 'idle' };
const listeners = new Set<() => void>();

function readPreference(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PREFERENCE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePreference(preferred: boolean): void {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, preferred ? 'on' : 'off');
  } catch {
    // The choice still applies for this visit.
  }
}

function update(next: Partial<MusicSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function musicSource(): string {
  return `${import.meta.env.BASE_URL}audio/our-song.mp3`;
}

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.loop = true;
  audio.addEventListener('playing', () => update({ status: 'playing' }));
  audio.addEventListener('waiting', () => update({ status: 'loading' }));
  audio.addEventListener('pause', () => { if (snapshot.status !== 'unavailable') update({ status: 'paused' }); });
  audio.addEventListener('error', () => update({ status: 'unavailable' }));
  audio.src = musicSource();
  return audio;
}

function fadeTo(volume: number, duration: number, done?: () => void): void {
  const element = audio;
  if (!element) return;
  window.cancelAnimationFrame(fadeFrame);
  const from = element.volume;
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    try { element.volume = from + (volume - from) * t; } catch { /* iOS volume is read-only */ }
    if (t < 1) fadeFrame = window.requestAnimationFrame(step);
    else done?.();
  };
  fadeFrame = window.requestAnimationFrame(step);
}

/** Call from a tap handler. */
export function playMusic(fadeIn = 1200): void {
  const element = ensureAudio();
  if (snapshot.status === 'unavailable') return;
  update({ status: 'loading' });
  try { element.volume = 0; } catch { /* read-only on iOS */ }
  const played = element.play();
  const onPlaying = () => fadeTo(TARGET_VOLUME, fadeIn);
  if (played && typeof played.then === 'function') {
    played.then(onPlaying).catch(() => update({ status: element.error ? 'unavailable' : 'paused' }));
  } else {
    onPlaying();
  }
}

/** Fades out and pauses without changing the guest's preference. */
export function pauseMusic(fadeOut = 600): void {
  if (!audio || audio.paused) return;
  const element = audio;
  fadeTo(0, fadeOut, () => element.pause());
}

export function setMusicPreference(preferred: boolean): void {
  writePreference(preferred);
  update({ preferred });
}

/** Toggle from the navigation control: changes playback and preference. */
export function toggleMusic(): void {
  if (snapshot.status === 'playing' || snapshot.status === 'loading') {
    setMusicPreference(false);
    pauseMusic();
  } else {
    setMusicPreference(true);
    playMusic(800);
  }
}

export function clearMusicPreference(): void {
  try { window.localStorage.removeItem(PREFERENCE_KEY); } catch { /* ignore */ }
  pauseMusic(200);
  update({ preferred: false });
}

if (typeof document !== 'undefined') {
  // Never keep playing in a background tab or after the page is hidden.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseMusic(150); });
  window.addEventListener('pagehide', () => audio?.pause());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMusic(): MusicSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}
