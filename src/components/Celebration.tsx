import { useEffect, useRef } from 'react';
import { hapticTap } from '../haptics';

type Particle = {
  x: number; y: number; vx: number; vy: number;
  rotation: number; spin: number; size: number;
  kind: 'plane' | 'petal'; color: string; wobble: number;
};

const COLORS = ['#d9b472', '#ead3a2', '#efbf90', '#f6dcbc', '#ffffff', '#a9834a'];
const DURATION = 1700;

function drawPlane(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.moveTo(size, 0);
  context.lineTo(-size * 0.8, -size * 0.55);
  context.lineTo(-size * 0.35, 0);
  context.lineTo(-size * 0.8, size * 0.55);
  context.closePath();
  context.fill();
}

function drawPetal(context: CanvasRenderingContext2D, size: number) {
  context.beginPath();
  context.ellipse(0, 0, size * 0.55, size, 0, 0, Math.PI * 2);
  context.fill();
}

/**
 * A short burst of paper planes and petals when an attending RSVP is confirmed.
 * Skipped entirely with reduced motion; never blocks reading or focus.
 */
export function Celebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const context = canvas?.getContext?.('2d');
    if (!canvas || !context || reduced) {
      if (canvas) canvas.dataset.done = 'true';
      return undefined;
    }
    hapticTap([10, 40, 14]);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);

    const particles: Particle[] = Array.from({ length: 46 }, (_, index) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = 5 + Math.random() * 7;
      return {
        x: width / 2 + (Math.random() - 0.5) * 60,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        size: 5 + Math.random() * 6,
        kind: index % 4 === 0 ? 'plane' : 'petal',
        color: COLORS[index % COLORS.length],
        wobble: Math.random() * Math.PI * 2,
      };
    });

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const fade = Math.max(0, 1 - Math.max(0, elapsed - DURATION * 0.55) / (DURATION * 0.45));
      context.clearRect(0, 0, width, height);
      for (const particle of particles) {
        particle.vy += 0.22;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.wobble += 0.12;
        particle.x += particle.vx + Math.sin(particle.wobble) * 0.6;
        particle.y += particle.vy;
        particle.rotation += particle.spin;
        context.save();
        context.globalAlpha = fade;
        context.translate(particle.x, particle.y);
        context.rotate(particle.kind === 'plane' ? Math.atan2(particle.vy, particle.vx) : particle.rotation);
        context.fillStyle = particle.color;
        if (particle.kind === 'plane') drawPlane(context, particle.size * 1.4);
        else drawPetal(context, particle.size);
        context.restore();
      }
      if (elapsed < DURATION) frame = window.requestAnimationFrame(tick);
      else {
        context.clearRect(0, 0, width, height);
        canvas.dataset.done = 'true';
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="celebration-canvas" aria-hidden="true" />;
}
