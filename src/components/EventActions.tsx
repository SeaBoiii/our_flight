import { calendarUrl } from '../calendar';
import { copy } from '../copy';
import type { InvitationEvent, Locale } from '../types';
import { mapUrl } from '../venue';

type EventActionsProps = {
  event: InvitationEvent;
  locale: Locale;
  directions?: boolean;
  className?: string;
};

export function EventActions({ event, locale, directions = true, className = 'event-actions' }: EventActionsProps) {
  const t = copy[locale];

  return (
    <div className={className}>
      <a className="button button-secondary" href={calendarUrl(event, locale, import.meta.env.BASE_URL)}>
        {t.calendar}
      </a>
      {directions ? (
        <a className="button button-secondary" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${t.directions} (${t.newTab})`}>
          {t.directions}
        </a>
      ) : null}
    </div>
  );
}
