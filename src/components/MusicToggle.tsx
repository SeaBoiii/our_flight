import { designCopy } from '../designCopy';
import { toggleMusic, useMusic } from '../music';
import type { Locale } from '../types';

export function MusicToggle({ locale }: { locale: Locale }) {
  const music = useMusic();
  const words = designCopy[locale];
  if (music.status === 'unavailable') return null;
  const playing = music.status === 'playing' || music.status === 'loading';
  return (
    <button
      className={`music-toggle${playing ? ' music-toggle--playing' : ''}`}
      type="button"
      aria-label={playing ? words.pauseMusic : words.playMusic}
      title={playing ? words.pauseMusic : words.playMusic}
      onClick={toggleMusic}
    >
      <span className="music-toggle-bars" aria-hidden="true"><span /><span /><span /><span /></span>
    </button>
  );
}
