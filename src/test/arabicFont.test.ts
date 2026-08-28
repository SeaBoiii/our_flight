import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Arabic invitation typography', () => {
  it('bundles the Google Fonts Amiri Arabic subset locally', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const font = readFileSync(resolve(
      process.cwd(),
      'src/assets/fonts/amiri-arabic-400.woff2',
    ));

    expect(css).toContain('font-family: "Amiri"');
    expect(css).toContain('url("./assets/fonts/amiri-arabic-400.woff2")');
    expect(css).toContain('font-display: swap');
    expect(font.subarray(0, 4).toString('ascii')).toBe('wOF2');
  });
});
