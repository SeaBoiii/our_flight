import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('cinematic scroll layout', () => {
  it('uses native scrolling with stable mobile viewport dimensions and responsive artwork', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/journey.css'), 'utf8');
    expect(css).toContain('height: 600svh');
    expect(css).toContain('height: 700svh');
    expect(css).toContain('position: sticky; top: 0');
    expect(css).toContain('height: 100svh');
    expect(css).toContain('object-position: var(--portrait-focus)');
    expect(css).toContain('object-position: var(--landscape-focus)');
    expect(css).not.toContain('scroll-snap');
    const animations = [...css.matchAll(/animation:\s*([^;]+);/g)].map(([, value]) => value.trim());
    expect(animations.every(value => value === 'none')).toBe(true);
  });
});
