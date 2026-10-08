import { useLayoutEffect, useRef, type CSSProperties } from 'react';

const LETTER_WHEEL = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DIGIT_WHEEL = '0123456789';
const FLIP_MS = 62;

type SplitFlapProps = {
  text: string;
  /** Delay before the first reveal, in ms. Later changes flip immediately. */
  delay?: number;
  className?: string;
};

/** The glyphs a real flap shows between two characters: forward round its wheel. */
function wheelSteps(from: string, to: string): string[] {
  const wheel = /\d/.test(from) && /\d/.test(to) ? DIGIT_WHEEL : LETTER_WHEEL;
  let index = Math.max(0, wheel.indexOf(from));
  const steps: string[] = [];
  for (let guard = 0; guard < wheel.length && wheel[index] !== to; guard += 1) {
    index = (index + 1) % wheel.length;
    steps.push(wheel[index]);
  }
  return steps.slice(0, -1);
}

function revealSteps(target: string, index: number): string[] {
  if (target === ' ') return [];
  const count = 4 + ((index * 7) % 5);
  return Array.from({ length: count }, (_, step) => LETTER_WHEEL[1 + ((step * 11 + target.charCodeAt(0)) % (LETTER_WHEEL.length - 1))]);
}

/**
 * A decorative departures-board word. Always aria-hidden: the caller supplies
 * the readable text. On first paint every flap shuffles in; when `text`
 * changes, only the flaps that differ turn, forward round their wheel, as on a
 * real board (1 → 2 is one flip; 2 → 1 rolls through 3…9, 0). Runs on
 * requestAnimationFrame without GSAP, so it can live on the check-in page.
 */
export function SplitFlap({ text, delay = 0, className = '' }: SplitFlapProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const shownRef = useRef<string | null>(null);
  const characters = text.toUpperCase().split('');
  const key = characters.join('');

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cells = Array.from(root.querySelectorAll<HTMLElement>('.split-flap-cell'));
    const previous = shownRef.current;
    shownRef.current = key;

    const plans = cells.map((cell, index) => {
      const target = key[index] ?? ' ';
      const from = previous === null ? null : (previous[index] ?? ' ');
      // A flap animates when it first appears (unless blank) or when its glyph changes.
      const animate = !reduced && (from === null ? target !== ' ' : from !== target);
      const steps = !animate ? [] : from === null ? revealSteps(target, index) : wheelSteps(from, target);
      const start = from === null ? delay + index * 55 : index * 30;
      cell.dataset.char = target;
      cell.textContent = !animate ? target : from === null ? ' ' : from;
      return { cell, target, steps, start, done: !animate };
    });
    if (plans.every((plan) => plan.done)) return undefined;

    let frame = 0;
    let begin = -1;
    const tick = (now: number) => {
      if (begin < 0) begin = now;
      const elapsed = now - begin;
      let pending = false;
      for (const plan of plans) {
        if (plan.done) continue;
        const step = Math.floor((elapsed - plan.start) / FLIP_MS);
        if (step < 0) { pending = true; continue; }
        const glyph = step >= plan.steps.length ? plan.target : plan.steps[step];
        if (plan.cell.textContent !== glyph) {
          plan.cell.textContent = glyph;
          plan.cell.classList.remove('is-flipping');
          // Restart the flip keyframe for each new glyph.
          void plan.cell.offsetWidth;
          plan.cell.classList.add('is-flipping');
        }
        if (step >= plan.steps.length) plan.done = true;
        else pending = true;
      }
      if (pending) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      plans.forEach(({ cell, target }) => { cell.textContent = target; });
    };
  }, [key, delay]);

  // Cells are filled imperatively so React never rewrites a flap mid-turn.
  return (
    <span ref={rootRef} className={`split-flap ${className}`.trim()} aria-hidden="true">
      {characters.map((_, index) => (
        <span className="split-flap-cell" key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </span>
  );
}
