import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventActions } from '../components/EventActions';
import { day21Full, day21Reception } from '../invitationEvents';
import { mapUrl } from '../venue';

describe('event calendar links', () => {
  it('uses a native same-tab calendar link with the deployment base and correct locale/scope', () => {
    vi.stubEnv('BASE_URL', '/our_flight/');
    const { rerender } = render(<EventActions event={day21Reception} locale="ms" />);
    const link = screen.getByRole('link', { name: 'Tambah ke kalendar' });
    expect(link.getAttribute('href')).toBe('/our_flight/calendar/aleem-nurulain-day21-reception-ms.ics');
    expect(link.hasAttribute('download')).toBe(false);
    expect(link.hasAttribute('target')).toBe(false);
    rerender(<EventActions event={day21Full} locale="en" />);
    expect(screen.getByRole('link', { name: 'Add to calendar' }).getAttribute('href'))
      .toBe('/our_flight/calendar/aleem-nurulain-day21-full-en.ics');
    expect(screen.getByRole('link', { name: /Get directions/ }).getAttribute('href')).toBe(mapUrl);
  });

  it('can omit directions on confirmation cards', () => {
    render(<EventActions event={day21Reception} locale="en" directions={false} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Add to calendar' })).toBeTruthy();
  });
});
