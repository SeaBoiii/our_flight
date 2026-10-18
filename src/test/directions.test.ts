import { describe, expect, it } from 'vitest';
import { googleMapsUrl, venueAddress, wazeUrl } from '../directions';
import { mapUrl } from '../venue';

describe('venue directions', () => {
  it('provides the complete hotel name and address', () => {
    expect(venueAddress).toBe('Crowne Plaza Changi Airport, 75 Airport Boulevard, Singapore 819664');
  });

  it('re-exports the established Google Maps URL', () => {
    expect(googleMapsUrl).toBe(mapUrl);
  });

  it.each([
    { name: 'Google Maps', link: googleMapsUrl, hostname: 'www.google.com', pathname: '/maps/search/', queryKey: 'query' },
    { name: 'Waze', link: wazeUrl, hostname: 'waze.com', pathname: '/ul', queryKey: 'q' },
  ])('provides a well-formed HTTPS $name URL with the encoded hotel and address', ({ link, hostname, pathname, queryKey }) => {
    const url = new URL(link);

    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe(hostname);
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get(queryKey)).toBe(venueAddress);
    expect(link).not.toContain(' ');
    expect(link).toContain('%2C');
    expect(link).toMatch(/Crowne(?:\+|%20)Plaza(?:\+|%20)Changi(?:\+|%20)Airport/);
    expect(link).toMatch(/75(?:\+|%20)Airport(?:\+|%20)Boulevard/);
    expect(link).toMatch(/Singapore(?:\+|%20)819664/);
  });

  it('asks Waze to navigate to the encoded venue', () => {
    expect(wazeUrl).toContain(`q=${encodeURIComponent(venueAddress)}`);
    expect(new URL(wazeUrl).searchParams.get('navigate')).toBe('yes');
  });
});
