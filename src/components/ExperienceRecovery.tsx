import { useEffect, useRef } from 'react';
import { copy } from '../copy';
import { localized, type Invitation, type Locale } from '../types';
import { EventActions } from './EventActions';

type ExperienceRecoveryProps = {
  invitation: Invitation;
  locale: Locale;
  failed?: boolean;
  onBack: () => void;
};

export function ExperienceRecovery({ invitation, locale, failed = false, onBack }: ExperienceRecoveryProps) {
  const t = copy[locale];
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (failed) headingRef.current?.focus();
  }, [failed]);

  return (
    <main className={`experience-recovery cabin-${invitation.cabinClass}`}>
      <p className="eyebrow">Aleem &amp; Nurulain</p>
      <h1 ref={headingRef} tabIndex={-1}>{failed ? t.experienceUnavailable : t.experienceLoading}</h1>
      <p role={failed ? 'alert' : 'status'}>{failed ? t.experienceUnavailableBody : t.practicalDetails}</p>
      <div className="experience-recovery-actions">
        {failed ? <button className="button button-primary" type="button" onClick={() => window.location.reload()}>{t.reloadInvitation}</button> : null}
        <button className="button button-secondary" type="button" onClick={onBack}>{t.back}</button>
      </div>
      <section aria-labelledby="recovery-itinerary-title">
        <h2 id="recovery-itinerary-title">{t.itinerary}</h2>
        <p>{t.singaporeTime}</p>
        <p>{invitation.hotel}<br />{invitation.ballroom} · {t.terminal} {invitation.terminal}<br />{t.address}</p>
        <div className="experience-recovery-events">
          {invitation.events.map((event) => (
            <article key={event.id}>
              <p className="eyebrow">{event.flightCode}</p>
              <h3>{localized(event.title, locale)}</h3>
              <p><time dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time><br />{event.time}</p>
              <EventActions event={event} locale={locale} />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
