'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  Attendance,
  EventRsvp,
  Invitation,
  InvitationEvent,
  Locale,
} from '../../../lib/types';

type Step = 'gate' | 'ticket' | 'cabin' | 'clouds' | 'details';
type AttendanceChoice = Attendance | '';
type DraftEvent = { attendance: AttendanceChoice; partySize: string };
type RsvpDraft = {
  inviteeName: string;
  day21: DraftEvent;
  day22: DraftEvent;
  message: string;
};

const emptyDraft: RsvpDraft = {
  inviteeName: '',
  day21: { attendance: '', partySize: '' },
  day22: { attendance: '', partySize: '' },
  message: '',
};

const copy = {
  en: {
    languageName: 'English',
    alternateLanguage: 'Bahasa Melayu',
    invitationCheckIn: 'Invitation Check-in',
    gateBody: 'This invitation is for invited guests. Enter the passcode shared with you to continue.',
    passcode: 'Passcode',
    passcodePlaceholder: 'Enter passcode',
    viewInvitation: 'View invitation',
    checking: 'Checking in…',
    emptyPasscode: 'Enter your passcode to continue.',
    invalidPasscode: 'We couldn’t verify this invitation link or passcode. Check the details shared with you and try again.',
    flightTheme: 'A cloud-bound celebration',
    gateDate: '22 August 2027 · Singapore',
    ticketReady: 'Your boarding pass is ready.',
    boardFlight: 'Board Flight',
    passenger: 'Passenger',
    honouredGuest: 'Honoured Guest',
    flight: 'Flight',
    gate: 'Gate',
    terminal: 'Terminal',
    cabin: 'Cabin',
    eventTime: 'Event time',
    destination: 'Destination',
    ourForever: 'Our forever',
    from: 'From',
    singapore: 'Singapore',
    keepsake: 'Wedding keepsake · Not valid for travel',
    welcomeAboard: 'Welcome aboard',
    cabinBody: 'Please make yourself comfortable as we begin our journey above the clouds.',
    continue: 'Continue',
    cloudsTitle: 'Among the clouds, a new journey begins.',
    bismillah: 'Bismillahirrahmanirrahim',
    salam: 'Assalamu’alaikum Warahmatullahi Wabarakatuh',
    formalInvite: 'With gratitude to Allah SWT, together with our families, we warmly invite you to celebrate the marriage of',
    blessing: 'Your presence and prayers will bring joy to our celebration. May Allah SWT bless this union with love, mercy and lasting happiness.',
    continueItinerary: 'Continue to itinerary',
    skip: 'Skip journey',
    back: 'Back',
    reduceMotion: 'Reduce motion',
    reducedMotionOn: 'Reduced motion on',
    itinerary: 'Your itinerary',
    singaporeTime: 'All times are Singapore Time (SGT).',
    directions: 'Get directions',
    addCalendar: 'Add to calendar',
    venue: 'Venue',
    gettingHere: 'Getting here',
    mrt: 'MRT: Alight at Changi Airport station and follow signs to Terminal 3 and Crowne Plaza.',
    jewel: 'From Terminal 3 or Jewel: Follow the covered walkways and hotel signs to Crowne Plaza.',
    car: 'By car, taxi or private hire: Use Crowne Plaza Changi Airport, 75 Airport Boulevard, as your destination and alight at the hotel entrance.',
    parking: 'Parking: Follow signs to the hotel or Terminal 3 car parks. Availability and prevailing charges apply.',
    allowTime: 'Please allow extra time during busy airport periods.',
    confirm: 'Confirm your attendance',
    deadline: 'Kindly respond by Sunday, 8 August 2027.',
    name: 'Your name',
    namePlaceholder: 'Name on your invitation',
    day21Question: 'Will you attend the celebrations on Saturday, 21 August 2027—the Nikah and Bride’s Reception?',
    day21Note: 'One response covers both events on 21 August.',
    day22Question: 'Will you attend the Walimatul Urus on Sunday, 22 August 2027?',
    yes: 'Yes, I/we will attend',
    no: 'No, I/we cannot attend',
    party21: 'Number attending on 21 August, including you',
    party22: 'Number attending on 22 August, including you',
    partyPlaceholder: 'Enter number',
    message: 'Message for Aleem & Nurulain (optional)',
    messageHint: 'Up to 500 characters',
    send: 'Send RSVP',
    sending: 'Sending…',
    clear: 'Clear saved response',
    draftSaved: 'Your unfinished response is saved on this device so you can return later.',
    review: 'Please review the highlighted fields.',
    enterName: 'Enter your name.',
    select21: 'Select an attendance response for 21 August.',
    select22: 'Select an attendance response for 22 August.',
    partyError: 'Enter the number attending as a whole number of 1 or more.',
    messageError: 'Your message must be 500 characters or fewer.',
    success: 'Your RSVP has been received. Thank you for responding.',
    duplicate: 'This RSVP was already received. No duplicate response was created.',
    failed: 'We couldn’t send your RSVP. Your answers are still saved on this device. Check your connection and try again.',
    sessionExpired: 'Your invitation session has expired. Enter the passcode again; your saved response will remain on this device.',
    privacy: 'Your RSVP is stored in a private wedding response sheet. No advertising or analytics trackers are used.',
  },
  ms: {
    languageName: 'Bahasa Melayu',
    alternateLanguage: 'English',
    invitationCheckIn: 'Daftar Masuk Jemputan',
    gateBody: 'Jemputan ini adalah untuk tetamu yang diundang. Masukkan kod laluan yang dikongsikan dengan anda untuk meneruskan.',
    passcode: 'Kod laluan',
    passcodePlaceholder: 'Masukkan kod laluan',
    viewInvitation: 'Lihat jemputan',
    checking: 'Sedang mendaftar…',
    emptyPasscode: 'Masukkan kod laluan untuk meneruskan.',
    invalidPasscode: 'Kami tidak dapat mengesahkan pautan jemputan atau kod laluan ini. Semak maklumat yang dikongsikan dengan anda dan cuba lagi.',
    flightTheme: 'Sebuah perayaan di awan',
    gateDate: '22 Ogos 2027 · Singapura',
    ticketReady: 'Pas masuk anda sudah tersedia.',
    boardFlight: 'Naik Pesawat',
    passenger: 'Penumpang',
    honouredGuest: 'Tetamu Yang Dihormati',
    flight: 'Penerbangan',
    gate: 'Pintu',
    terminal: 'Terminal',
    cabin: 'Kelas Kabin',
    eventTime: 'Waktu Majlis',
    destination: 'Destinasi',
    ourForever: 'Selamanya',
    from: 'Dari',
    singapore: 'Singapura',
    keepsake: 'Kenang-kenangan perkahwinan · Tidak sah untuk perjalanan',
    welcomeAboard: 'Selamat datang ke pesawat',
    cabinBody: 'Silakan duduk dengan selesa sementara kita memulakan perjalanan di atas awan.',
    continue: 'Teruskan',
    cloudsTitle: 'Di antara awan, bermulalah sebuah perjalanan baharu.',
    bismillah: 'Bismillahirrahmanirrahim',
    salam: 'Assalamu’alaikum Warahmatullahi Wabarakatuh',
    formalInvite: 'Dengan penuh kesyukuran ke hadrat Allah SWT, kami bersama keluarga dengan sukacitanya menjemput Tuan/Puan untuk meraikan pernikahan',
    blessing: 'Kehadiran serta doa restu Tuan/Puan akan menyerikan majlis kami. Semoga Allah SWT memberkati ikatan ini dengan kasih sayang, rahmat dan kebahagiaan yang berkekalan.',
    continueItinerary: 'Lihat jadual majlis',
    skip: 'Langkau perjalanan',
    back: 'Kembali',
    reduceMotion: 'Kurangkan animasi',
    reducedMotionOn: 'Animasi dikurangkan',
    itinerary: 'Jadual majlis anda',
    singaporeTime: 'Semua waktu mengikut Waktu Singapura (SGT).',
    directions: 'Dapatkan arah',
    addCalendar: 'Tambah ke kalendar',
    venue: 'Lokasi',
    gettingHere: 'Cara ke sini',
    mrt: 'MRT: Turun di Stesen MRT Changi Airport, kemudian ikut papan tanda ke Terminal 3 dan Crowne Plaza.',
    jewel: 'Dari Terminal 3 atau Jewel: Ikuti laluan berbumbung serta papan tanda hotel ke Crowne Plaza.',
    car: 'Kereta, teksi atau khidmat sewa persendirian: Tetapkan Crowne Plaza Changi Airport, 75 Airport Boulevard, sebagai destinasi dan turun di pintu masuk hotel.',
    parking: 'Tempat letak kereta: Ikut papan tanda ke tempat letak kereta hotel atau Terminal 3. Tertakluk pada ketersediaan dan kadar semasa.',
    allowTime: 'Sila luangkan masa tambahan ketika lapangan terbang sibuk.',
    confirm: 'Sila Sahkan Kehadiran',
    deadline: 'Sila sahkan kehadiran selewat-lewatnya Ahad, 8 Ogos 2027.',
    name: 'Nama anda',
    namePlaceholder: 'Nama pada jemputan anda',
    day21Question: 'Adakah anda akan menghadiri majlis pada Sabtu, 21 Ogos 2027—Majlis Nikah dan Resepsi Sebelah Pengantin Perempuan?',
    day21Note: 'Satu jawapan merangkumi kedua-dua majlis pada 21 Ogos.',
    day22Question: 'Adakah anda akan menghadiri Walimatul Urus pada Ahad, 22 Ogos 2027?',
    yes: 'Ya, saya/kami akan hadir',
    no: 'Tidak, saya/kami tidak dapat hadir',
    party21: 'Bilangan yang hadir pada 21 Ogos, termasuk anda',
    party22: 'Bilangan yang hadir pada 22 Ogos, termasuk anda',
    partyPlaceholder: 'Masukkan bilangan',
    message: 'Ucapan untuk Aleem & Nurulain (pilihan)',
    messageHint: 'Sehingga 500 aksara',
    send: 'Hantar RSVP',
    sending: 'Sedang menghantar…',
    clear: 'Padam jawapan tersimpan',
    draftSaved: 'Jawapan yang belum dihantar disimpan pada peranti ini supaya anda boleh menyambung kemudian.',
    review: 'Sila semak ruangan yang ditandakan.',
    enterName: 'Masukkan nama anda.',
    select21: 'Pilih jawapan kehadiran untuk 21 Ogos.',
    select22: 'Pilih jawapan kehadiran untuk 22 Ogos.',
    partyError: 'Masukkan bilangan yang hadir sebagai nombor bulat 1 atau lebih.',
    messageError: 'Ucapan anda mestilah 500 aksara atau kurang.',
    success: 'RSVP anda telah diterima. Terima kasih atas maklum balas anda.',
    duplicate: 'RSVP ini telah diterima sebelum ini. Tiada jawapan pendua direkodkan.',
    failed: 'Kami tidak dapat menghantar RSVP anda. Jawapan anda masih tersimpan pada peranti ini. Semak sambungan internet dan cuba lagi.',
    sessionExpired: 'Sesi jemputan anda telah tamat. Masukkan semula kod laluan; jawapan tersimpan akan kekal pada peranti ini.',
    privacy: 'RSVP anda disimpan dalam helaian maklum balas perkahwinan peribadi. Tiada pengiklanan atau penjejak analitik digunakan.',
  },
} as const;

const mapUrl =
  'https://www.google.com/maps/search/?api=1&query=Crowne+Plaza+Changi+Airport%2C+75+Airport+Boulevard%2C+Singapore+819664';

function localized(value: { en: string; ms: string }, locale: Locale): string {
  return value[locale];
}

function localTime(value: string, locale: Locale): string {
  if (locale === 'en') {
    return value
      .replace('10:00 – 12:00', '10:00 am–12:00 pm')
      .replace('12:00 – 16:00', '12:00 pm–4:00 pm')
      .replace('10:00 – 16:00', '10:00 am–4:00 pm');
  }
  return value
    .replace('10:00 – 12:00', '10:00 pagi–12:00 tengah hari')
    .replace('12:00 – 16:00', '12:00 tengah hari–4:00 petang')
    .replace('10:00 – 16:00', '10:00 pagi–4:00 petang');
}

function Monogram() {
  return (
    <div className="type-monogram" aria-label="Aleem and Nurulain">
      A<span>&amp;</span>N
    </div>
  );
}

function BoardingPass({
  invitation,
  locale,
}: {
  invitation: Invitation;
  locale: Locale;
}) {
  const c = copy[locale];
  return (
    <div className="ticket-stack">
      {invitation.events.map((event) => (
        <article className="boarding-pass full-ticket" key={event.id} aria-label={localized(event.title, locale)}>
          <div className="ticket-main">
            <div className="ticket-topline">
              <span>OUR FLIGHT · ALEEM &amp; NURULAIN</span>
              <span>{localized(invitation.cabinLabel, locale)}</span>
            </div>
            <div className="route-row">
              <div>
                <span className="field-label">{c.from}</span>
                <strong>SIN</strong>
                <span>{c.singapore}</span>
              </div>
              <div className="route-line" aria-hidden="true"><span>✦</span></div>
              <div className="route-destination">
                <span className="field-label">{c.destination}</span>
                <strong>∞</strong>
                <span>{c.ourForever}</span>
              </div>
            </div>
            <dl className="ticket-fields">
              <div><dt>{c.passenger}</dt><dd>{c.honouredGuest}</dd></div>
              <div><dt>{c.flight}</dt><dd>{event.id === 'day21' ? 'AN2108' : 'AN2208'}</dd></div>
              <div><dt>{c.eventTime}</dt><dd>{localTime(event.time, locale)}</dd></div>
              <div><dt>{c.gate}</dt><dd>Chengal</dd></div>
              <div><dt>{c.terminal}</dt><dd>3</dd></div>
            </dl>
          </div>
          <div className="ticket-stub">
            <span className="stub-date">{event.id === 'day21' ? '21' : '22'}</span>
            <span>{locale === 'en' ? 'AUG' : 'OGOS'}</span>
            <span>2027</span>
            <i aria-hidden="true" />
            <small>{c.keepsake}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function ActionButton({ children, onClick, secondary = false }: { children: ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button className={secondary ? 'button secondary' : 'button primary'} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function ItineraryCard({ event, locale }: { event: InvitationEvent; locale: Locale }) {
  const c = copy[locale];
  return (
    <article className="itinerary-card">
      <div className="itinerary-date" aria-hidden="true">
        <strong>{event.id === 'day21' ? '21' : '22'}</strong>
        <span>{locale === 'en' ? 'AUG' : 'OGOS'}</span>
      </div>
      <div className="itinerary-copy">
        <p className="micro-label">{localized(event.dateLabel, locale)}</p>
        <h3>{localized(event.title, locale)}</h3>
        <div className="segment-list">
          {event.segments.map((segment) => (
            <div key={`${segment.time}-${segment.title.en}`}>
              <span>{localized(segment.title, locale)}</span>
              <strong>{localTime(segment.time, locale)}</strong>
            </div>
          ))}
        </div>
        <a className="text-link" href={event.calendarHref}>{c.addCalendar}</a>
      </div>
    </article>
  );
}

function AttendanceFields({
  id,
  question,
  note,
  partyLabel,
  value,
  locale,
  invalid,
  onChange,
}: {
  id: 'day21' | 'day22';
  question: string;
  note?: string;
  partyLabel: string;
  value: DraftEvent;
  locale: Locale;
  invalid: boolean;
  onChange: (value: DraftEvent) => void;
}) {
  const c = copy[locale];
  return (
    <fieldset className={`attendance-fieldset ${invalid ? 'field-invalid' : ''}`}>
      <legend>{question}</legend>
      {note ? <p className="field-note">{note}</p> : null}
      <div className="attendance-options">
        <label>
          <input
            type="radio"
            name={`${id}-attendance`}
            value="attending"
            checked={value.attendance === 'attending'}
            onChange={() => onChange({ ...value, attendance: 'attending' })}
          />
          <span>{c.yes}</span>
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-attendance`}
            value="not-attending"
            checked={value.attendance === 'not-attending'}
            onChange={() => onChange({ attendance: 'not-attending', partySize: '' })}
          />
          <span>{c.no}</span>
        </label>
      </div>
      {value.attendance === 'attending' ? (
        <label className="party-size-label">
          <span>{partyLabel}</span>
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            placeholder={c.partyPlaceholder}
            value={value.partySize}
            aria-invalid={invalid}
            onChange={(event) => onChange({ ...value, partySize: event.target.value })}
          />
        </label>
      ) : null}
    </fieldset>
  );
}

function RsvpForm({
  invitation,
  locale,
  token,
  onSessionExpired,
}: {
  invitation: Invitation;
  locale: Locale;
  token: string;
  onSessionExpired: () => void;
}) {
  const c = copy[locale];
  const [draft, setDraft] = useState<RsvpDraft>(emptyDraft);
  const [draftReady, setDraftReady] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'duplicate' | 'failed'>('idle');
  const errorRef = useRef<HTMLDivElement>(null);
  const storageKey = `our-flight:${token}:rsvp-draft`;
  const responseKey = `our-flight:${token}:response-id`;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setDraft({ ...emptyDraft, ...(JSON.parse(saved) as Partial<RsvpDraft>) });
      } catch {
        // Ignore an unreadable device-local draft.
      }
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!draftReady) return;
    localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, draftReady, storageKey]);

  function validateDraft(): string[] {
    const nextErrors: string[] = [];
    if (!draft.inviteeName.trim()) nextErrors.push('inviteeName');
    if (invitation.scope === 'both-days' && !draft.day21.attendance) nextErrors.push('day21');
    if (!draft.day22.attendance) nextErrors.push('day22');
    for (const [id, value] of [['day21', draft.day21], ['day22', draft.day22]] as const) {
      if (id === 'day21' && invitation.scope !== 'both-days') continue;
      if (value.attendance === 'attending') {
        const partySize = Number(value.partySize);
        if (!Number.isSafeInteger(partySize) || partySize < 1) nextErrors.push(`${id}.partySize`);
      }
    }
    if (draft.message.length > 500) nextErrors.push('message');
    return nextErrors;
  }

  function responseId(): string {
    const existing = localStorage.getItem(responseKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(responseKey, created);
    return created;
  }

  function toEventRsvp(value: DraftEvent): EventRsvp {
    return value.attendance === 'attending'
      ? { attendance: 'attending', partySize: Number(value.partySize) }
      : { attendance: 'not-attending' };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateDraft();
    setErrors(nextErrors);
    if (nextErrors.length) {
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }

    setStatus('sending');
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: responseId(),
          locale,
          inviteeName: draft.inviteeName.trim(),
          day21: invitation.scope === 'both-days' ? toEventRsvp(draft.day21) : undefined,
          day22: toEventRsvp(draft.day22),
          message: draft.message.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { duplicate?: boolean; error?: string; fields?: string[] };
      if (response.status === 401) {
        setStatus('failed');
        setErrors(['session']);
        requestAnimationFrame(() => errorRef.current?.focus());
        window.setTimeout(onSessionExpired, 1800);
        return;
      }
      if (response.status === 422) {
        setStatus('idle');
        setErrors(result.fields ?? ['form']);
        requestAnimationFrame(() => errorRef.current?.focus());
        return;
      }
      if (!response.ok) throw new Error(result.error ?? 'submission_failed');
      setStatus(result.duplicate ? 'duplicate' : 'success');
      setErrors([]);
    } catch {
      setStatus('failed');
      setErrors(['network']);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  function clearDraft() {
    setDraft(emptyDraft);
    setErrors([]);
    setStatus('idle');
    localStorage.removeItem(storageKey);
    localStorage.removeItem(responseKey);
  }

  const day21Invalid = errors.some((error) => error.startsWith('day21'));
  const day22Invalid = errors.some((error) => error.startsWith('day22'));

  return (
    <section className="rsvp-card" aria-labelledby="rsvp-heading">
      <p className="micro-label">RSVP · 08.08.2027</p>
      <h2 id="rsvp-heading">{c.confirm}</h2>
      <p className="rsvp-deadline">{c.deadline}</p>

      <form onSubmit={submit} noValidate>
        {errors.length ? (
          <div className="form-alert" role="alert" tabIndex={-1} ref={errorRef}>
            <strong>{c.review}</strong>
            <ul>
              {errors.includes('inviteeName') ? <li>{c.enterName}</li> : null}
              {errors.some((error) => error.startsWith('day21')) ? <li>{errors.includes('day21') ? c.select21 : c.partyError}</li> : null}
              {errors.some((error) => error.startsWith('day22')) ? <li>{errors.includes('day22') ? c.select22 : c.partyError}</li> : null}
              {errors.includes('message') ? <li>{c.messageError}</li> : null}
              {errors.includes('session') ? <li>{c.sessionExpired}</li> : null}
              {errors.includes('network') ? <li>{c.failed}</li> : null}
            </ul>
          </div>
        ) : null}

        <label className={`text-field ${errors.includes('inviteeName') ? 'field-invalid' : ''}`}>
          <span>{c.name}</span>
          <input
            type="text"
            autoComplete="name"
            maxLength={100}
            placeholder={c.namePlaceholder}
            value={draft.inviteeName}
            aria-invalid={errors.includes('inviteeName')}
            onChange={(event) => setDraft((current) => ({ ...current, inviteeName: event.target.value }))}
          />
        </label>

        {invitation.scope === 'both-days' ? (
          <AttendanceFields
            id="day21"
            question={c.day21Question}
            note={c.day21Note}
            partyLabel={c.party21}
            value={draft.day21}
            locale={locale}
            invalid={day21Invalid}
            onChange={(value) => setDraft((current) => ({ ...current, day21: value }))}
          />
        ) : null}

        <AttendanceFields
          id="day22"
          question={c.day22Question}
          partyLabel={c.party22}
          value={draft.day22}
          locale={locale}
          invalid={day22Invalid}
          onChange={(value) => setDraft((current) => ({ ...current, day22: value }))}
        />

        <label className={`text-field ${errors.includes('message') ? 'field-invalid' : ''}`}>
          <span>{c.message}</span>
          <textarea
            rows={4}
            maxLength={500}
            value={draft.message}
            aria-invalid={errors.includes('message')}
            onChange={(event) => setDraft((current) => ({ ...current, message: event.target.value }))}
          />
          <small>{draft.message.length}/500 · {c.messageHint}</small>
        </label>

        <p className="draft-note">{c.draftSaved}</p>
        <div className="form-actions">
          <button className="button primary" type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? c.sending : c.send}
          </button>
          <button className="button ghost" type="button" onClick={clearDraft}>{c.clear}</button>
        </div>
        <div className="submission-status" role="status" aria-live="polite">
          {status === 'success' ? c.success : null}
          {status === 'duplicate' ? c.duplicate : null}
          {status === 'failed' && !errors.includes('session') ? c.failed : null}
        </div>
        <p className="privacy-note">{c.privacy}</p>
      </form>
    </section>
  );
}

export default function InvitationExperience({ token }: { token: string }) {
  const [locale, setLocale] = useState<Locale>('en');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [step, setStep] = useState<Step>('gate');
  const [passcode, setPasscode] = useState('');
  const [gateError, setGateError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const c = copy[locale];

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const storedLocale = localStorage.getItem('our-flight:language');
      if (storedLocale === 'ms' || storedLocale === 'en') setLocale(storedLocale);
      const storedMotion = localStorage.getItem('our-flight:reduced-motion');
      setReducedMotion(storedMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    });

    const resume = async () => {
      try {
        const response = await fetch(`/api/invitation?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const result = (await response.json()) as { invitation: Invitation };
        setInvitation(result.invitation);
        setStep('ticket');
      } catch {
        // The passcode gate remains usable when session restoration fails.
      }
    };
    void resume();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    document.documentElement.lang = locale === 'ms' ? 'ms-SG' : 'en-SG';
    localStorage.setItem('our-flight:language', locale);
  }, [locale]);

  useEffect(() => {
    localStorage.setItem('our-flight:reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [step, reducedMotion]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passcode) {
      setGateError(c.emptyPasscode);
      return;
    }
    setUnlocking(true);
    setGateError('');
    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, passcode }),
      });
      if (!response.ok) throw new Error('invalid');
      const result = (await response.json()) as { invitation: Invitation };
      setInvitation(result.invitation);
      setPasscode('');
      setStep('ticket');
    } catch {
      setGateError(c.invalidPasscode);
    } finally {
      setUnlocking(false);
    }
  }

  function changeLocale() {
    setLocale((current) => (current === 'en' ? 'ms' : 'en'));
  }

  const theme = invitation ? `theme-${invitation.cabinClass}` : 'theme-locked';
  const stepOrder: Step[] = ['ticket', 'cabin', 'clouds', 'details'];
  const currentProgress = invitation ? stepOrder.indexOf(step) : -1;

  return (
    <main
      className={`experience ${theme}`}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      ref={mainRef}
      tabIndex={-1}
    >
      <div className="ambient-clouds" aria-hidden="true"><span /><span /><span /></div>
      <header className="experience-header">
        <Monogram />
        {invitation ? (
          <div className="journey-progress" aria-label={`${currentProgress + 1} of ${stepOrder.length}`}>
            {stepOrder.map((item, index) => <span className={index <= currentProgress ? 'active' : ''} key={item} />)}
          </div>
        ) : <span className="header-route">SIN <i>✦</i> ∞</span>}
        <div className="header-actions">
          {invitation ? (
            <button
              className="utility-button motion-toggle"
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => setReducedMotion((current) => !current)}
            >
              {reducedMotion ? c.reducedMotionOn : c.reduceMotion}
            </button>
          ) : null}
          <button className="utility-button" type="button" onClick={changeLocale}>
            {c.alternateLanguage}
          </button>
        </div>
      </header>

      {step === 'gate' ? (
        <section className="gate-stage" aria-labelledby="gate-title">
          <div className="gate-ticket-teaser" aria-hidden="true">
            <span className="teaser-flight">AN2208</span>
            <span className="teaser-route">SIN <i>✦</i> ∞</span>
            <span className="teaser-date">22 · 08 · 27</span>
          </div>
          <div className="gate-copy">
            <p className="micro-label">{c.flightTheme}</p>
            <h1 id="gate-title">{c.invitationCheckIn}</h1>
            <p>{c.gateBody}</p>
            <form className="unlock-form" onSubmit={unlock}>
              <label htmlFor="passcode">{c.passcode}</label>
              <input
                id="passcode"
                name="passcode"
                type="password"
                autoComplete="one-time-code"
                value={passcode}
                placeholder={c.passcodePlaceholder}
                aria-invalid={Boolean(gateError)}
                onChange={(event) => setPasscode(event.target.value)}
              />
              {gateError ? <p className="gate-error" role="alert">{gateError}</p> : null}
              <button className="button primary" type="submit" disabled={unlocking}>
                {unlocking ? c.checking : c.viewInvitation}
              </button>
            </form>
            <p className="gate-date">{c.gateDate}</p>
          </div>
        </section>
      ) : null}

      {invitation && step === 'ticket' ? (
        <section className="journey-stage ticket-stage" aria-labelledby="ticket-title">
          <div className="stage-copy compact-copy">
            <p className="micro-label">{localized(invitation.cabinLabel, locale)} · {invitation.flightCode}</p>
            <h1 id="ticket-title">{c.ticketReady}</h1>
          </div>
          <BoardingPass invitation={invitation} locale={locale} />
          <div className="stage-actions">
            <ActionButton onClick={() => setStep('cabin')}>{c.boardFlight}</ActionButton>
            <ActionButton secondary onClick={() => setStep('details')}>{c.skip}</ActionButton>
          </div>
        </section>
      ) : null}

      {invitation && step === 'cabin' ? (
        <section className="journey-stage cabin-stage" aria-labelledby="cabin-title">
          <div className="cabin-scene" aria-hidden="true">
            <div className="cabin-ceiling"><i /><i /><i /></div>
            <div className="seat-row left"><span /><span /><span /></div>
            <div className="seat-row right"><span /><span /><span /></div>
            <div className="cabin-door"><div className="door-window" /></div>
            <div className="aisle-light" />
          </div>
          <div className="scene-overlay">
            <p className="micro-label">{localized(invitation.cabinLabel, locale)}</p>
            <h1 id="cabin-title">{c.welcomeAboard}</h1>
            <p>{c.cabinBody}</p>
            <div className="stage-actions">
              <ActionButton onClick={() => setStep('clouds')}>{c.continue}</ActionButton>
              <ActionButton secondary onClick={() => setStep('ticket')}>{c.back}</ActionButton>
              <ActionButton secondary onClick={() => setStep('details')}>{c.skip}</ActionButton>
            </div>
          </div>
        </section>
      ) : null}

      {invitation && step === 'clouds' ? (
        <section className="journey-stage cloud-stage" aria-labelledby="cloud-title">
          <div className="plane-window" aria-hidden="true">
            <div className="window-sky"><span /><span /><span /></div>
          </div>
          <div className="formal-card">
            <p className="bismillah">{c.bismillah}</p>
            <p className="salam">{c.salam}</p>
            <h1 id="cloud-title">{c.cloudsTitle}</h1>
            <p>{c.formalInvite}</p>
            <strong>Aleem &amp; Nurulain</strong>
            <p>{c.blessing}</p>
            <div className="stage-actions">
              <ActionButton onClick={() => setStep('details')}>{c.continueItinerary}</ActionButton>
              <ActionButton secondary onClick={() => setStep('cabin')}>{c.back}</ActionButton>
            </div>
          </div>
        </section>
      ) : null}

      {invitation && step === 'details' ? (
        <div className="details-page">
          <section className="details-hero" aria-labelledby="itinerary-title">
            <p className="micro-label">{localized(invitation.cabinLabel, locale)} · {invitation.flightCode}</p>
            <h1 id="itinerary-title">{c.itinerary}</h1>
            <p>{c.singaporeTime}</p>
            <div className="stage-actions details-navigation">
              <ActionButton secondary onClick={() => setStep('clouds')}>{c.back}</ActionButton>
            </div>
          </section>

          <section className="itinerary-grid" aria-label={c.itinerary}>
            {invitation.events.map((event) => <ItineraryCard event={event} locale={locale} key={event.id} />)}
          </section>

          <section className="venue-card" aria-labelledby="venue-title">
            <div>
              <p className="micro-label">Terminal 3 · Singapore</p>
              <h2 id="venue-title">{c.venue}</h2>
              <strong>Chengal Ballroom</strong>
              <span>Crowne Plaza Changi Airport</span>
              <span>75 Airport Boulevard, Singapore 819664</span>
              <a className="button primary inline-button" href={mapUrl} target="_blank" rel="noreferrer">{c.directions}</a>
            </div>
            <div className="venue-window" aria-hidden="true"><span>✦</span></div>
          </section>

          <details className="travel-card">
            <summary>{c.gettingHere}</summary>
            <ul>
              <li>{c.mrt}</li>
              <li>{c.jewel}</li>
              <li>{c.car}</li>
              <li>{c.parking}</li>
              <li>{c.allowTime}</li>
            </ul>
          </details>

          <RsvpForm
            invitation={invitation}
            locale={locale}
            token={token}
            onSessionExpired={() => {
              setInvitation(null);
              setStep('gate');
            }}
          />

          <footer className="invitation-footer">
            <Monogram />
            <p>
              Aleem &amp; Nurulain · {invitation.scope === 'both-days' ? '21—22.08.2027' : '22.08.2027'}
            </p>
            <button className="text-link" type="button" onClick={() => setStep('ticket')}>{c.ticketReady}</button>
          </footer>
        </div>
      ) : null}
    </main>
  );
}
