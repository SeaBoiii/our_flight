import { describe, expect, it, vi } from 'vitest';
import { calendarAssets } from '../../plugins/calendarAssets';
import { calendarContents, calendarUrl } from '../calendar';
import { calendarEventVariants } from '../invitationEvents';

describe('hosted calendar assets', () => {
  it('emits both original and invitation-aware calendars with matching contents', () => {
    const plugin = calendarAssets();
    const hook = plugin.generateBundle;
    const generateBundle = typeof hook === 'function' ? hook : hook?.handler;
    expect(generateBundle).toBeDefined();
    const emitFile = vi.fn<(asset: { type: string; fileName: string; source: string }) => void>();
    Reflect.apply(generateBundle!, { emitFile }, [{}, {}, false]);

    const files = new Map(emitFile.mock.calls.map(([asset]) => [asset.fileName, asset]));
    expect(files.size).toBe(12);
    for (const event of calendarEventVariants) {
      for (const locale of ['en', 'ms'] as const) {
        expect(files.get(calendarUrl(event, locale).slice(1))).toEqual({
          type: 'asset',
          fileName: calendarUrl(event, locale).slice(1),
          source: calendarContents(event, locale),
        });
      }
    }
  });

  it('serves the same calendar variants under the deployment base during development', () => {
    const plugin = calendarAssets();
    const resolved = plugin.configResolved;
    Reflect.apply((typeof resolved === 'function' ? resolved : resolved?.handler)!, plugin, [{ base: '/our_flight/' }]);
    type Request = { method: string; url: string };
    type Response = { statusCode: number; setHeader: (key: string, value: string) => void; end: (body?: string) => void };
    const use = vi.fn<(handler: (request: Request, response: Response, next: () => void) => void) => void>();
    const configure = plugin.configureServer;
    Reflect.apply((typeof configure === 'function' ? configure : configure?.handler)!, plugin, [{ middlewares: { use } }]);
    const middleware = use.mock.calls[0][0];
    for (const event of calendarEventVariants) {
      for (const locale of ['en', 'ms'] as const) {
        const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
        const next = vi.fn();
        const url = calendarUrl(event, locale, '/our_flight/');
        middleware({ method: 'GET', url }, response, next);
        expect(response.statusCode).toBe(200);
        expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/calendar;charset=utf-8');
        expect(response.end).toHaveBeenCalledWith(calendarContents(event, locale));
        expect(next).not.toHaveBeenCalled();
        response.end.mockClear();
        middleware({ method: 'HEAD', url }, response, next);
        expect(response.end).toHaveBeenCalledWith(undefined);
      }
    }
    const next = vi.fn();
    middleware({ method: 'GET', url: '/our_flight/calendar/missing.ics' }, { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
