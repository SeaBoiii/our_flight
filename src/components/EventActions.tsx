import { useId, useState } from 'react';
import { downloadCalendar } from '../calendar';
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
  const [failed, setFailed] = useState(false);
  const errorId = useId();
  const t = copy[locale];

  const handleCalendar = () => {
    setFailed(false);
    try {
      downloadCalendar(event, locale);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className={className}>
      <button className="button button-secondary" type="button" onClick={handleCalendar} aria-describedby={failed ? errorId : undefined}>
        {t.calendar}
      </button>
      {directions ? (
        <a className="button button-secondary" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`${t.directions} (${t.newTab})`}>
          {t.directions}
        </a>
      ) : null}
      {failed ? <p id={errorId} className="field-error" role="alert">{t.calendarFailed}</p> : null}
    </div>
  );
}
