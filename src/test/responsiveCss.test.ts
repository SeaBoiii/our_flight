import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('large-phone journey layout', () => {
  it('keeps the compact ticket stack and controls above 430px', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    const start = css.indexOf('@media (max-width: 480px)');
    const end = css.indexOf('@media (max-width: 360px)', start);
    const largePhoneRules = css.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(largePhoneRules).toContain('.ticket-field-passenger');
    expect(largePhoneRules).toContain('display: none;');
    expect(largePhoneRules).toContain('.journey-ticket { --journey-ticket-preferred-scale: 0.68; width: 116vw; }');
    expect(largePhoneRules).toContain('.ticket-stack.cabin-first');
    expect(largePhoneRules).not.toContain('--journey-ticket-lift');
    expect(largePhoneRules).toContain('.experience-back span { display: none; }');
  });
});
