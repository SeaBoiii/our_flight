import type { Ref } from 'react';
import { copy } from '../copy';
import { localized, type Invitation, type Locale } from '../types';
import { EventActions } from './EventActions';
import '../dashboard.css';

type FlightDashboardProps = {
  invitation: Invitation;
  locale: Locale;
  headingRef?: Ref<HTMLHeadingElement>;
};

export function FlightDashboard({ invitation, locale, headingRef }: FlightDashboardProps) {
  const t = copy[locale];
  return (
    <section id="flight-dashboard" className="flight-dashboard" aria-labelledby="flight-dashboard-title">
      <div className="section-heading">
        <p className="eyebrow">Aleem &amp; Nurulain · {localized(invitation.cabinLabel, locale)}</p>
        <h2 id="flight-dashboard-title" ref={headingRef} tabIndex={-1}>{t.flightDashboard}</h2>
        <p>{t.singaporeTime}</p>
      </div>
      <div className="dashboard-flights">
        {invitation.events.map((event) => (
          <article className="dashboard-flight" key={event.id} aria-labelledby={`dashboard-${event.id}-title`}>
            <div className="dashboard-flight-band">
              <span><span className="visually-hidden">{t.flight} </span>{event.flightCode}</span>
              <span>{localized(invitation.cabinLabel, locale)}</span>
            </div>
            <div className="dashboard-flight-body">
              <time className="dashboard-date" dateTime={event.dateIso}>{localized(event.dateLabel, locale)}</time>
              <h3 id={`dashboard-${event.id}-title`}>{localized(event.title, locale)}</h3>
              <p className="dashboard-time"><span className="visually-hidden">{t.eventTime}: </span>{event.time}</p>
              <div className="dashboard-venue">
                <p>{invitation.hotel}</p>
                <p>{locale === 'ms' ? `${t.ballroom} ${invitation.ballroom}` : `${invitation.ballroom} ${t.ballroom}`} · {t.terminal} {invitation.terminal}</p>
              </div>
              <EventActions event={event} locale={locale} />
            </div>
          </article>
        ))}
      </div>
      <a className="dashboard-rsvp button button-text" href="#rsvp">{t.rsvpTitle}<span aria-hidden="true"> ↓</span></a>
    </section>
  );
}
