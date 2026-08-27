import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App';

describe('invitation gate', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('uses responsive Changi artwork as a decorative background', () => {
    const { container } = render(<App />);
    const picture = container.querySelector('.gate-background');
    const source = picture?.querySelector('source');
    const image = picture?.querySelector('img');

    expect(picture?.getAttribute('aria-hidden')).toBe('true');
    expect(source?.getAttribute('srcset')).toContain('gate/changi-jewel-landscape.webp');
    expect(image?.getAttribute('src')).toContain('gate/changi-jewel-portrait.webp');
    expect(image?.getAttribute('alt')).toBe('');
    expect(container.querySelector('.gate-pass')).not.toBeNull();
  });
});
