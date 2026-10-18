import type { ReactNode } from 'react';
import { departureStatus, eventWindow } from '../departure';
import { dockCopy } from '../dockCopy';
import type { InvitationEvent, Locale } from '../types';
import { useMinuteClock } from '../useMinuteClock';
import { SplitFlap } from './SplitFlap';
import '../dock.css';

const singaporeTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false });

const pad = (value: number, size: number) => String(value).padStart(size, '0');

/**
 * A departures board that counts down to the guest's next event, in Singapore
 * time. It turns to TODAY on the day, NOW BOARDING during the event and
 * LANDED afterwards, so it never freezes at zero.
 */
export function DepartureBoard({ events, locale }: { events: readonly InvitationEvent[]; locale: Locale }) {
  const now = useMinuteClock();
  const d = dockCopy[locale];
  const status = departureStatus(events, now);
  const flight = status.event?.flightCode ?? events.map((event) => event.flightCode).join(' / ');

  let label: string;
  let body: ReactNode;
  let summary: string;
  if (status.phase === 'countdown' || status.phase === 'between') {
    label = status.phase === 'between' ? d.nextDepartureIn : d.departsIn;
    summary = d.countdownSummary(flight, status.days, status.hours, status.minutes);
    body = (
      <div className="departure-units">
        <span><SplitFlap text={pad(status.days, 3)} className="departure-flap" delay={200} /><small>{d.days}</small></span>
        <span><SplitFlap text={pad(status.hours, 2)} className="departure-flap" delay={380} /><small>{d.hours}</small></span>
        <span><SplitFlap text={pad(status.minutes, 2)} className="departure-flap" delay={500} /><small>{d.minutes}</small></span>
      </div>
    );
  } else if (status.phase === 'today' && status.event) {
    const time = singaporeTime.format(eventWindow(status.event).start);
    label = d.boardsToday;
    summary = d.todaySummary(flight, time);
    body = <div className="departure-status"><SplitFlap text={d.flapToday} className="departure-flap split-flap--status" delay={200} /><p>{time}</p></div>;
  } else if (status.phase === 'boarding' && status.event) {
    const time = singaporeTime.format(eventWindow(status.event).end);
    label = d.boardStatus;
    summary = d.boardingSummary(flight, time);
    body = <div className="departure-status"><SplitFlap text={d.flapBoarding} className="departure-flap split-flap--status" delay={200} /><p>{d.boardingUntil(time)}</p></div>;
  } else {
    label = d.boardStatus;
    summary = d.landedSummary;
    body = <div className="departure-status"><SplitFlap text={d.flapLanded} className="departure-flap split-flap--status" delay={200} /><p>{d.landedBody}</p></div>;
  }

  return (
    <section className={`departure-board departure-board--${status.phase}`} aria-label={d.board}>
      <header className="departure-board-head" aria-hidden="true">
        <span>{d.board}</span>
        <span>{d.boardTerminal}</span>
      </header>
      <div className="departure-board-row" aria-hidden="true">
        <span className="departure-board-label">{label}</span>
        <span className="departure-board-flight">{status.phase === 'landed' ? '' : flight}</span>
      </div>
      <div aria-hidden="true">{body}</div>
      <p className="visually-hidden">{summary}</p>
    </section>
  );
}
