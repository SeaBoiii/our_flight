import { useEffect, useRef, useState, type ReactNode } from 'react';
import { calendarUrl } from '../calendar';
import { copy } from '../copy';
import { designCopy } from '../designCopy';
import { googleMapsUrl, venueAddress, wazeUrl } from '../directions';
import { dockCopy } from '../dockCopy';
import { localized, type InvitationEvent, type Locale } from '../types';
import { ArrowUpRightIcon } from './Icons';
import '../dock.css';

type Sheet = 'directions' | 'calendar' | null;

// Same drawn family as Icons.tsx: 1.6px round strokes on a 24px grid.
const DockIcon = ({ children }: { children: ReactNode }) => (
  <svg className="icon dock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{children}</svg>
);
const ItineraryIcon = () => <DockIcon><path d="M5 4h14v16H5zM8.5 8.5h7M8.5 12h7M8.5 15.5h4" /></DockIcon>;
const PinIcon = () => <DockIcon><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></DockIcon>;
const CalendarIcon = () => <DockIcon><path d="M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4" /></DockIcon>;
const PlaneIcon = () => <DockIcon><path d="M3 13.5 21 6l-4.2 13-4.6-5.2L3 13.5Zm9.2.3L21 6" /></DockIcon>;

/** Shown once the guest reaches the itinerary; hidden while the RSVP form or footer is on screen. */
function useDockVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const itinerary = document.getElementById('itinerary')?.getBoundingClientRect();
      const rsvp = document.getElementById('rsvp')?.getBoundingClientRect();
      const footer = document.querySelector('.site-footer')?.getBoundingClientRect();
      const reached = !!itinerary && itinerary.top < viewport * 0.6;
      const overForm = !!rsvp && rsvp.top < viewport && rsvp.bottom > 0;
      const overFooter = !!footer && footer.top < viewport - 40;
      setVisible(reached && !overForm && !overFooter);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  return visible;
}

function goTo(id: string, focusId: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => document.getElementById(focusId)?.focus({ preventScroll: true }), 450);
}

type BoardingDockProps = {
  locale: Locale;
  checkedIn: boolean;
  /** Days the guest has confirmed attending. Calendars follow an attending RSVP, as elsewhere on the site. */
  calendarEvents: readonly InvitationEvent[];
};

/**
 * A ticket-stub dock in the thumb zone: itinerary, directions, check-in and,
 * once the guest has confirmed attending, calendar. Directions and a
 * two-day calendar open a sheet.
 */
export function BoardingDock({ locale, checkedIn, calendarEvents }: BoardingDockProps) {
  const d = dockCopy[locale];
  const t = copy[locale];
  const visible = useDockVisible();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const singleEvent = calendarEvents.length === 1 ? calendarEvents[0] : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (sheet && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
    if (!sheet && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [sheet]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(venueAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // The address stays visible in the sheet for a manual copy.
    }
  };

  return (
    <>
      {/* A modal sheet already makes the rest of the page inert; keeping the dock in place lets
          the dialog hand focus back to the button that opened it without moving the page. */}
      <nav className={`boarding-dock${visible ? ' boarding-dock--visible' : ''}`} aria-label={d.dock} aria-hidden={!visible} inert={!visible ? true : undefined}>
        <button type="button" className="dock-item" onClick={() => goTo('itinerary', 'itinerary-title')}>
          <ItineraryIcon /><span>{d.dockItinerary}</span>
        </button>
        <button type="button" className="dock-item" onClick={() => setSheet('directions')} aria-haspopup="dialog">
          <PinIcon /><span>{d.dockDirections}</span>
        </button>
        {singleEvent ? (
          <a className="dock-item" href={calendarUrl(singleEvent, locale, import.meta.env.BASE_URL)}>
            <CalendarIcon /><span>{d.dockCalendar}</span>
          </a>
        ) : calendarEvents.length > 1 ? (
          <button type="button" className="dock-item" onClick={() => setSheet('calendar')} aria-haspopup="dialog">
            <CalendarIcon /><span>{d.dockCalendar}</span>
          </button>
        ) : null}
        <button type="button" className="dock-item dock-item--primary" onClick={() => goTo('rsvp', 'rsvp-title')}>
          <PlaneIcon /><span>{checkedIn ? d.dockCheckedIn : d.dockCheckIn}</span>
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        className="dock-sheet"
        aria-labelledby="dock-sheet-title"
        onClose={() => setSheet(null)}
        onClick={(event) => { if (event.target === event.currentTarget) setSheet(null); }}
      >
        <div className="dock-sheet-paper">
          <span className="dock-sheet-grip" aria-hidden="true" />
          {sheet === 'calendar' ? (
            <>
              <h2 id="dock-sheet-title">{d.calendarTitle}</h2>
              <div className="dock-sheet-actions">
                {calendarEvents.map((event) => (
                  <a key={event.id} className="button button-secondary" href={calendarUrl(event, locale, import.meta.env.BASE_URL)}>
                    {event.flightCode} · {localized(event.dateLabel, locale)}
                  </a>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 id="dock-sheet-title">{d.directionsTitle}</h2>
              <address>{venueAddress}</address>
              <div className="dock-sheet-actions">
                <a className="button button-primary" href={googleMapsUrl} target="_blank" rel="noreferrer" aria-label={`${d.googleMaps} (${t.newTab})`}>
                  {d.googleMaps}<span className="button-icon"><ArrowUpRightIcon /></span>
                </a>
                <a className="button button-secondary" href={wazeUrl} target="_blank" rel="noreferrer" aria-label={`${d.waze} (${t.newTab})`}>
                  {d.waze}<span className="button-icon"><ArrowUpRightIcon /></span>
                </a>
                <button className="button button-text" type="button" onClick={() => { void copyAddress(); }}>
                  {copied ? designCopy[locale].addressCopied : designCopy[locale].copyAddress}
                </button>
              </div>
              <p className="visually-hidden" role="status">{copied ? designCopy[locale].addressCopied : ''}</p>
            </>
          )}
          <button className="dock-sheet-close button button-text" type="button" onClick={() => setSheet(null)}>{d.sheetClose}</button>
        </div>
      </dialog>
    </>
  );
}
