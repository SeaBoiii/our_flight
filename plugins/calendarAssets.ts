import type { Plugin } from 'vite';
import { calendarContents, calendarFileName, calendarUrl } from '../src/calendar';
import { invitationEvents } from '../src/invitationEvents';
import type { Locale } from '../src/types';

const locales: Locale[] = ['en', 'ms'];

// Let the browser hand a regular HTTP calendar resource to the native calendar
// app instead of forcing a temporary blob download. Use the same files in dev.
export function calendarAssets(): Plugin {
  let base = '/';

  return {
    name: 'our-flight-calendar-assets',
    configResolved(config) {
      base = config.base;
    },
    configureServer(server) {
      const calendars = new Map(invitationEvents.flatMap((event) => locales.map((locale) => [
        calendarUrl(event, locale, base), calendarContents(event, locale),
      ])));

      server.middlewares.use((request, response, next) => {
        if (request.method !== 'GET' && request.method !== 'HEAD') return next();
        const pathname = request.url?.split('?')[0];
        const contents = pathname ? calendars.get(pathname) : undefined;
        if (contents === undefined) return next();

        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/calendar;charset=utf-8');
        response.setHeader('Cache-Control', 'no-cache');
        response.end(request.method === 'HEAD' ? undefined : contents);
      });
    },
    generateBundle() {
      for (const event of invitationEvents) {
        for (const locale of locales) {
          this.emitFile({
            type: 'asset',
            fileName: `calendar/${calendarFileName(event, locale)}`,
            source: calendarContents(event, locale),
          });
        }
      }
    },
  };
}
