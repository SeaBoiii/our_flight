import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('cloud video viewport sizing', () => {
  it('fills the dynamic viewport without overscan or scroll-driven zoom', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const journey = readFileSync(resolve(process.cwd(), 'src/components/Journey.tsx'), 'utf8');
    const videoRule = css.match(/\.journey-cloud-video\s*\{([^}]*)\}/)?.[1] ?? '';
    const stageRule = css.match(/\.journey-stage\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(stageRule).toContain('height: 100dvh');
    expect(videoRule).toContain('inset: 0');
    expect(videoRule).toContain('width: 100%');
    expect(videoRule).toContain('height: 100%');
    expect(videoRule).toContain('object-fit: cover');
    expect(videoRule).toContain('transform: none');
    expect(videoRule).not.toContain('calc(');
    expect(videoRule).not.toContain('scale(');
    expect(journey).not.toContain("setProperty('--cloud-x'");
    expect(journey).not.toContain("setProperty('--cloud-y'");
    expect(journey).toContain('stage.clientWidth');
    expect(journey).toContain('stage.clientHeight');
    expect(journey).not.toContain('getWindowExitScale(window.innerWidth');
    expect(journey).not.toContain('rect.height - window.innerHeight');
  });
});
