import { copy } from '../copy';
import { googleMapsUrl, wazeUrl } from '../directions';
import { dockCopy } from '../dockCopy';
import { localized, type Locale } from '../types';
import { programmeMoment, type WeddingDay } from '../weddingDay';
import { ArrowUpRightIcon } from './Icons';

type TodayPanelProps = {
  day: WeddingDay;
  landed: boolean;
  gallery: string;
  now: Date;
  locale: Locale;
};

/**
 * Wedding-day gate card under the departures board. On an event day it puts
 * today's programme and directions first; once the celebration has started,
 * and after the last event, it points guests to the photo gallery.
 */
export function TodayPanel({ day, landed, gallery, now, locale }: TodayPanelProps) {
  const d = dockCopy[locale];
  const t = copy[locale];
  if (!day && !(landed && gallery)) return null;

  const photos = gallery ? (
    <a className="button button-primary today-photos" href={gallery} target="_blank" rel="noreferrer" aria-label={`${d.sharePhotos} (${t.newTab})`}>
      {d.sharePhotos}<span className="button-icon"><ArrowUpRightIcon /></span>
    </a>
  ) : null;

  if (!day) {
    return (
      <section className="today-panel today-panel--landed" aria-labelledby="today-title">
        <h3 id="today-title">{d.landedTitle}</h3>
        <p className="today-note">{d.landedPhotosBody}</p>
        {photos}
      </section>
    );
  }

  const moment = programmeMoment(day.event, now);
  const title = day.stage === 'before' ? d.todayBefore : day.stage === 'during' ? d.todayDuring : d.todayAfter;
  const rows = day.stage === 'after' ? [] : [
    moment.current ? { label: d.nowLabel, item: moment.current, live: true } : null,
    moment.next ? { label: moment.current ? d.nextLabel : d.firstUp, item: moment.next, live: false } : null,
  ].filter((row) => row !== null);

  return (
    <section className={`today-panel today-panel--${day.stage}`} aria-labelledby="today-title">
      <p className="today-eyebrow">{d.todayEyebrow(localized(day.event.dateLabel, locale))}</p>
      <h3 id="today-title">{title}</h3>
      {rows.length ? (
        <ol className="today-programme">
          {rows.map(({ label, item, live }) => (
            <li key={label} className={live ? 'is-live' : undefined}>
              <span className="today-programme-label">{label}</span>
              <span className="today-programme-time">{item.time}</span>
              <span className="today-programme-title">{localized(item.title, locale)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="today-actions">
        {day.stage !== 'after' ? (
          <>
            <a className="button button-primary" href={googleMapsUrl} target="_blank" rel="noreferrer" aria-label={`${d.googleMaps} (${t.newTab})`}>
              {d.googleMaps}<span className="button-icon"><ArrowUpRightIcon /></span>
            </a>
            <a className="button button-secondary" href={wazeUrl} target="_blank" rel="noreferrer" aria-label={`${d.waze} (${t.newTab})`}>
              {d.waze}<span className="button-icon"><ArrowUpRightIcon /></span>
            </a>
          </>
        ) : null}
        {day.stage !== 'before' ? photos : null}
      </div>
    </section>
  );
}
