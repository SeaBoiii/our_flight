import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiFailure, submitRsvp } from '../api';
import { copy } from '../copy';
import { clearDraft, readDraft, saveDraft } from '../storage';
import type { AccessCredential, Invitation, Locale, RsvpDraft } from '../types';
import { localized } from '../types';

type RsvpFormProps = {
  invitation: Invitation;
  accessCredential: AccessCredential;
  fingerprint: string;
  locale: Locale;
};

type Errors = Record<string, string>;
type SubmitState = 'idle' | 'sending' | 'success' | 'duplicate' | 'failed' | 'unconfirmed' | 'conflict';

function freshDraft(invitation: Invitation, saved: RsvpDraft | null): RsvpDraft {
  const savedAnswers = new Map(saved?.responses.map((answer) => [answer.eventId, answer]));
  const savedResponseId = saved?.responseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.responseId)
    ? saved.responseId
    : crypto.randomUUID();
  return {
    responseId: savedResponseId,
    inviteeName: saved?.inviteeName ?? '',
    message: saved?.message ?? '',
    responses: invitation.events.map((event) => {
      const answer = savedAnswers.get(event.id);
      return {
        eventId: event.id,
        attendance: answer?.attendance ?? '',
        partySize: answer?.partySize ?? '',
      };
    }),
  };
}

export function RsvpForm({
  invitation,
  accessCredential,
  fingerprint,
  locale,
}: RsvpFormProps) {
  const t = copy[locale];
  const [draft, setDraft] = useState<RsvpDraft>(() => freshDraft(invitation, readDraft(fingerprint)));
  const [errors, setErrors] = useState<Errors>({});
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const summaryRef = useRef<HTMLDivElement>(null);
  const formDisabled = invitation.rsvpStatus !== 'open' || submitState === 'sending' || submitState === 'success' || submitState === 'duplicate';

  useEffect(() => {
    saveDraft(fingerprint, draft);
  }, [draft, fingerprint]);

  const updateAnswer = (eventId: string, field: 'attendance' | 'partySize', value: string) => {
    setDraft((current) => ({
      ...current,
      responses: current.responses.map((answer) => {
        if (answer.eventId !== eventId) return answer;
        if (field === 'attendance') {
          return {
            ...answer,
            attendance: value === 'attending' || value === 'not-attending' ? value : '',
            partySize: value === 'attending' ? answer.partySize : '',
          };
        }
        return { ...answer, partySize: value };
      }),
    }));
    setSubmitState('idle');
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!draft.inviteeName.trim()) next.inviteeName = t.nameError;
    if (draft.message.length > 500) next.message = t.messageError;
    draft.responses.forEach((answer, index) => {
      if (!answer.attendance) next[`attendance-${index}`] = t.attendanceError;
      if (answer.attendance === 'attending') {
        const partySize = Number(answer.partySize);
        if (!/^\d+$/.test(answer.partySize) || !Number.isSafeInteger(partySize) || partySize < 1) {
          next[`party-${index}`] = t.partyError;
        }
      }
    });
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invitation.rsvpStatus !== 'open') return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    setSubmitState('sending');
    try {
      const result = await submitRsvp(accessCredential, locale, draft);
      clearDraft(fingerprint);
      setSubmitState(result.duplicate ? 'duplicate' : 'success');
    } catch (error) {
      let handledValidation = false;
      if (error instanceof ApiFailure && error.status === 422) {
        const serverErrors: Errors = {};
        for (const field of error.fields) {
          if (field === 'inviteeName') serverErrors.inviteeName = t.nameError;
          if (field === 'message') serverErrors.message = t.messageError;
          invitation.events.forEach((inviteEvent, index) => {
            if (!field.includes(inviteEvent.id)) return;
            if (field.endsWith('.partySize')) serverErrors[`party-${index}`] = t.partyError;
            else serverErrors[`attendance-${index}`] = t.attendanceError;
          });
        }
        if (Object.keys(serverErrors).length) {
          handledValidation = true;
          setErrors(serverErrors);
          window.requestAnimationFrame(() => summaryRef.current?.focus());
        }
      }
      if (error instanceof ApiFailure && error.code === 'unconfirmed') setSubmitState('unconfirmed');
      else if (error instanceof ApiFailure && error.code === 'idempotency_conflict') setSubmitState('conflict');
      else if (handledValidation) setSubmitState('idle');
      else setSubmitState('failed');
    }
  };

  const handleClear = () => {
    clearDraft(fingerprint);
    setDraft(freshDraft(invitation, null));
    setErrors({});
    setSubmitState('idle');
  };

  const statusMessage = submitState === 'success'
    ? t.success
    : submitState === 'duplicate'
      ? t.duplicate
      : submitState === 'failed'
        ? t.failed
        : submitState === 'unconfirmed'
          ? t.unconfirmed
          : submitState === 'conflict'
            ? t.conflict
            : '';

  const errorTarget = (field: string): string => {
    if (field === 'inviteeName') return 'invitee-name';
    if (field === 'message') return 'guest-message';
    if (field.startsWith('attendance-')) return `${field}-yes`;
    if (field.startsWith('party-')) return `party-size-${field.slice('party-'.length)}`;
    return 'rsvp-title';
  };

  return (
    <section id="rsvp" className="rsvp-section" aria-labelledby="rsvp-title">
      <div className="section-heading">
        <p className="eyebrow">RSVP</p>
        <h2 id="rsvp-title">{t.rsvpTitle}</h2>
        <p>{localized(invitation.rsvpDeadline, locale)}</p>
      </div>

      {invitation.rsvpStatus === 'preview' ? (
        <div className="status-callout status-callout--preview" role="status">
          <span aria-hidden="true">i</span>
          <div><strong>{t.previewTitle}</strong><p>{t.previewBody}</p></div>
        </div>
      ) : null}
      {invitation.rsvpStatus === 'closed' ? (
        <div className="status-callout" role="status">
          <span aria-hidden="true">i</span>
          <div><strong>{t.closedTitle}</strong><p>{t.closedBody}</p></div>
        </div>
      ) : null}

      <form className="rsvp-form" onSubmit={handleSubmit} noValidate>
        {Object.keys(errors).length ? (
          <div ref={summaryRef} className="error-summary" role="alert" tabIndex={-1}>
            <strong>{t.review}</strong>
            <ul>
              {Object.entries(errors).map(([field, message]) => (
                <li key={field}><a href={`#${errorTarget(field)}`}>{message}</a></li>
              ))}
            </ul>
          </div>
        ) : null}

        <fieldset disabled={formDisabled}>
          <div className="form-field">
            <label htmlFor="invitee-name">{t.name}</label>
            <input
              id="invitee-name"
              name="inviteeName"
              value={draft.inviteeName}
              maxLength={100}
              autoComplete="name"
              aria-invalid={Boolean(errors.inviteeName)}
              aria-describedby={errors.inviteeName ? 'invitee-name-error' : undefined}
              onChange={(event) => {
                setDraft((current) => ({ ...current, inviteeName: event.target.value }));
                setSubmitState('idle');
              }}
            />
            {errors.inviteeName ? <span id="invitee-name-error" className="field-error">{errors.inviteeName}</span> : null}
          </div>

          {invitation.events.map((inviteEvent, index) => {
            const answer = draft.responses[index];
            const attendanceError = errors[`attendance-${index}`];
            const partyError = errors[`party-${index}`];
            return (
              <fieldset className="attendance-card" key={inviteEvent.id}>
                <legend>
                  <span>{localized(inviteEvent.dateLabel, locale)}</span>
                  {t.attendanceQuestion}
                </legend>
                {inviteEvent.segments.length > 1 ? <p className="field-help">{t.oneAnswer}</p> : null}
                <label className="radio-option">
                  <input
                    id={`attendance-${index}-yes`}
                    type="radio"
                    name={`attendance-${index}`}
                    value="attending"
                    checked={answer?.attendance === 'attending'}
                    aria-invalid={Boolean(attendanceError)}
                    aria-describedby={attendanceError ? `attendance-error-${index}` : undefined}
                    onChange={(event) => updateAnswer(inviteEvent.id, 'attendance', event.target.value)}
                  />
                  <span>{t.attending}</span>
                </label>
                <label className="radio-option">
                  <input
                    id={`attendance-${index}-no`}
                    type="radio"
                    name={`attendance-${index}`}
                    value="not-attending"
                    checked={answer?.attendance === 'not-attending'}
                    aria-invalid={Boolean(attendanceError)}
                    aria-describedby={attendanceError ? `attendance-error-${index}` : undefined}
                    onChange={(event) => updateAnswer(inviteEvent.id, 'attendance', event.target.value)}
                  />
                  <span>{t.declining}</span>
                </label>
                {attendanceError ? <span id={`attendance-error-${index}`} className="field-error">{attendanceError}</span> : null}
                {answer?.attendance === 'attending' ? (
                  <div className="form-field form-field--party">
                    <label htmlFor={`party-size-${index}`}>{t.partySize}</label>
                    <input
                      id={`party-size-${index}`}
                      type="number"
                      inputMode="numeric"
                      min="1"
                      step="1"
                      value={answer.partySize}
                      aria-invalid={Boolean(partyError)}
                      aria-describedby={partyError ? `party-error-${index}` : undefined}
                      onChange={(event) => updateAnswer(inviteEvent.id, 'partySize', event.target.value)}
                    />
                    {partyError ? <span id={`party-error-${index}`} className="field-error">{partyError}</span> : null}
                  </div>
                ) : null}
              </fieldset>
            );
          })}

          <div className="form-field">
            <label htmlFor="guest-message">{t.message}</label>
            <textarea
              id="guest-message"
              name="message"
              rows={5}
              maxLength={500}
              value={draft.message}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? 'guest-message-error' : undefined}
              onChange={(event) => {
                setDraft((current) => ({ ...current, message: event.target.value }));
                setSubmitState('idle');
              }}
            />
            <span className="character-count">{draft.message.length}/500 &middot; {t.characters}</span>
            {errors.message ? <span id="guest-message-error" className="field-error">{errors.message}</span> : null}
          </div>
        </fieldset>

        {statusMessage ? (
          <div className={`submission-status submission-status--${submitState}`} role="status" aria-live="polite">
            {statusMessage}
          </div>
        ) : null}

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={formDisabled}>
            {submitState === 'sending' ? t.sending : t.send}
          </button>
          <button className="button button-text" type="button" onClick={handleClear} disabled={submitState === 'sending'}>
            {t.clear}
          </button>
        </div>
        {submitState !== 'success' && submitState !== 'duplicate' ? <p className="form-note">{t.saved}</p> : null}
        <p className="form-note">{t.privacy}</p>
      </form>
    </section>
  );
}
