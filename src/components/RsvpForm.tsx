import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiFailure, submitRsvp } from '../api';
import { createUuid } from '../browser';
import { copy } from '../copy';
import { designCopy } from '../designCopy';
import { clearDraft, clearRsvpReceipt, readRsvpDraftState, readRsvpReceiptState, saveDraft, saveRsvpReceipt, type SavedRsvpDraft, type SavedRsvpReceipt } from '../storage';
import { rsvpExperienceCopy } from '../rsvpExperienceCopy';
import type { AccessCredential, Invitation, Locale, RsvpDraft } from '../types';
import { localized } from '../types';
import { MinusIcon, PlusIcon } from './Icons';
import { RsvpConfirmation } from './RsvpConfirmation';

type RsvpFormProps = {
  invitation: Invitation;
  accessCredential: AccessCredential;
  fingerprint: string;
  locale: Locale;
  onReceiptChange?: (receipt: SavedRsvpReceipt | null) => void;
};

type ErrorMessage = 'nameError' | 'messageError' | 'attendanceError' | 'partyError';
type Errors = Record<string, ErrorMessage>;
type SubmitState = 'idle' | 'sending' | 'success' | 'duplicate' | 'failed' | 'unconfirmed' | 'conflict' | 'closed' | 'preview' | 'unavailable';

type Confirmation = {
  receipt: SavedRsvpReceipt;
  response: Pick<RsvpDraft, 'responses'> & { inviteeName?: string };
  duplicate: boolean;
  restored: boolean;
  saved: boolean;
};

function freshDraft(invitation: Invitation, saved: SavedRsvpDraft | null): SavedRsvpDraft {
  const savedAnswers = new Map(saved?.responses.map((answer) => [answer.eventId, answer]));
  const savedResponseId = saved?.responseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.responseId)
    ? saved.responseId
    : createUuid();
  return {
    responseId: savedResponseId,
    inviteeName: saved?.inviteeName ?? '',
    message: saved?.message ?? '',
    ...(saved?.submissionLocale ? { submissionLocale: saved.submissionLocale } : {}),
    // Older drafts stored the submission language but not its delivery state.
    // Treat them as uncertain until the unchanged response is acknowledged.
    ...(saved?.submissionState || saved?.submissionLocale ? { submissionState: saved.submissionState ?? 'unconfirmed' } : {}),
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
  onReceiptChange,
}: RsvpFormProps) {
  const t = copy[locale];
  const experience = rsvpExperienceCopy[locale];
  const design = designCopy[locale];
  const [{ draft, draftSaved }, setDraftState] = useState<{ draft: SavedRsvpDraft; draftSaved: boolean | null }>(() => {
    const saved = readRsvpDraftState(fingerprint);
    return { draft: freshDraft(invitation, saved?.draft ?? null), draftSaved: saved?.persisted ?? null };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitState, setSubmitState] = useState<SubmitState>(draft.submissionState ?? 'idle');
  const [confirmedResponse, setConfirmedResponse] = useState<Confirmation | null>(() => {
    const saved = readRsvpReceiptState(fingerprint, invitation.events.map((event) => event.id));
    return saved ? {
      receipt: saved.receipt,
      response: { responses: saved.receipt.responses, inviteeName: saved.receipt.guestName },
      duplicate: false,
      restored: true,
      saved: saved.persisted,
    } : null;
  });
  const [startingAnotherGuest, setStartingAnotherGuest] = useState(false);
  const sendingRef = useRef(false);
  const submissionRef = useRef<AbortController | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const anotherGuestRef = useRef<HTMLButtonElement>(null);
  const pendingResponse = draft.submissionState !== undefined;
  const submitDisabled = invitation.rsvpStatus !== 'open'
    || ['sending', 'success', 'duplicate', 'conflict', 'closed', 'preview'].includes(submitState);
  const formDisabled = submitDisabled || pendingResponse;

  useEffect(() => () => submissionRef.current?.abort(), []);
  useEffect(() => { onReceiptChange?.(confirmedResponse?.receipt ?? null); }, [confirmedResponse, onReceiptChange]);

  const updateDraft = (next: SavedRsvpDraft) => {
    if (formDisabled) return;
    setDraftState({ draft: next, draftSaved: saveDraft(fingerprint, next) });
    setSubmitState('idle');
  };

  const clearErrors = (...fields: string[]) => {
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))));
  };

  const updateAnswer = (eventId: string, field: 'attendance' | 'partySize', value: string) => {
    updateDraft({
      ...draft,
      responses: draft.responses.map((answer) => {
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
    });
    const index = invitation.events.findIndex((event) => event.id === eventId);
    clearErrors(...(field === 'attendance' ? [`attendance-${index}`, `party-${index}`] : [`party-${index}`]));
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!draft.inviteeName.trim() || draft.inviteeName.trim().length > 100) next.inviteeName = 'nameError';
    if (draft.message.length > 500) next.message = 'messageError';
    draft.responses.forEach((answer, index) => {
      if (!answer.attendance) next[`attendance-${index}`] = 'attendanceError';
      if (answer.attendance === 'attending') {
        const partySize = Number(answer.partySize);
        if (!/^\d+$/.test(answer.partySize) || !Number.isSafeInteger(partySize) || partySize < 1) {
          next[`party-${index}`] = 'partyError';
        }
      }
    });
    return next;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitDisabled || sendingRef.current || confirmedResponse) return;
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    // Keep the confirmation tied to the exact answers sent, including retries.
    const submissionLocale = draft.submissionLocale ?? locale;
    const submittedResponse: SavedRsvpDraft = {
      ...draft,
      // Locale is part of the server's idempotency digest, even when answers
      // are unchanged. Preserve the first submission's locale across retries.
      submissionLocale,
      submissionState: 'unconfirmed',
      responses: draft.responses.map((answer) => ({ ...answer })),
    };
    setDraftState({ draft: submittedResponse, draftSaved: saveDraft(fingerprint, submittedResponse) });
    sendingRef.current = true;
    const controller = new AbortController();
    submissionRef.current = controller;
    setSubmitState('sending');
    try {
      const result = await submitRsvp(accessCredential, submissionLocale, submittedResponse, controller.signal);
      if (controller.signal.aborted) return;
      const receipt: SavedRsvpReceipt = {
        version: 2,
        guestName: submittedResponse.inviteeName.trim(),
        responseId: submittedResponse.responseId,
        confirmedAt: new Date().toISOString(),
        responses: submittedResponse.responses.map((answer) => ({ ...answer })),
      };
      const receiptSaved = saveRsvpReceipt(fingerprint, receipt);
      clearDraft(fingerprint);
      setConfirmedResponse({ receipt, response: submittedResponse, duplicate: Boolean(result.duplicate), restored: false, saved: receiptSaved });
      setSubmitState(result.duplicate ? 'duplicate' : 'success');
    } catch (error) {
      if (controller.signal.aborted) return;
      let handledValidation = false;
      if (error instanceof ApiFailure && error.status === 422) {
        const serverErrors: Errors = {};
        for (const field of error.fields) {
          if (field === 'inviteeName') serverErrors.inviteeName = 'nameError';
          if (field === 'message') serverErrors.message = 'messageError';
          invitation.events.forEach((inviteEvent, index) => {
            if (!field.includes(inviteEvent.id)) return;
            if (field.endsWith('.partySize')) serverErrors[`party-${index}`] = 'partyError';
            else serverErrors[`attendance-${index}`] = 'attendanceError';
          });
        }
        if (Object.keys(serverErrors).length && !draft.submissionState) {
          handledValidation = true;
          setErrors(serverErrors);
          window.requestAnimationFrame(() => summaryRef.current?.focus());
        }
      }
      let nextState: SubmitState;
      if (error instanceof ApiFailure && error.code === 'idempotency_conflict') nextState = 'conflict';
      else if (error instanceof ApiFailure && error.code === 'closed') nextState = 'closed';
      else if (error instanceof ApiFailure && error.code === 'preview') nextState = 'preview';
      else if (error instanceof ApiFailure && error.code === 'not_configured') nextState = 'unavailable';
      else if (handledValidation) nextState = 'idle';
      else if (error instanceof ApiFailure && error.code === 'submission_failed') nextState = 'failed';
      else nextState = 'unconfirmed';
      // A definite rejection of this retry cannot tell us whether an earlier
      // uncertain attempt arrived. Keep that earlier response intact.
      const nextSubmissionState = nextState === 'unconfirmed' || nextState === 'conflict'
        ? nextState
        : draft.submissionState;
      const recoveredDraft: SavedRsvpDraft = {
        responseId: submittedResponse.responseId,
        inviteeName: submittedResponse.inviteeName,
        message: submittedResponse.message,
        responses: submittedResponse.responses,
        ...(nextSubmissionState
          ? { submissionLocale, submissionState: nextSubmissionState }
          : {}),
      };
      setDraftState({ draft: recoveredDraft, draftSaved: saveDraft(fingerprint, recoveredDraft) });
      setSubmitState(nextState);
    } finally {
      if (submissionRef.current === controller) submissionRef.current = null;
      sendingRef.current = false;
    }
  };

  const handleClear = () => {
    if (pendingResponse || submitState === 'sending') return;
    clearDraft(fingerprint);
    setDraftState({ draft: freshDraft(invitation, null), draftSaved: null });
    setErrors({});
    setSubmitState((current) => current === 'closed' || current === 'preview' ? current : 'idle');
  };

  const handleAnotherGuest = () => {
    clearRsvpReceipt(fingerprint);
    clearDraft(fingerprint);
    setConfirmedResponse(null);
    setStartingAnotherGuest(false);
    setDraftState({ draft: freshDraft(invitation, null), draftSaved: null });
    setErrors({});
    setSubmitState('idle');
    window.requestAnimationFrame(() => document.getElementById('invitee-name')?.focus());
  };

  const statusMessage = submitState === 'success'
    ? t.success
    : submitState === 'duplicate'
      ? t.duplicate
      : submitState === 'failed'
        ? t.failed
        : submitState === 'unconfirmed'
          ? experience.unconfirmed
          : submitState === 'conflict'
            ? experience.conflict
            : submitState === 'closed' || submitState === 'preview' || submitState === 'unavailable'
              ? experience[submitState]
              : '';

  const errorTarget = (field: string): string => {
    if (field === 'inviteeName') return 'invitee-name';
    if (field === 'message') return 'guest-message';
    if (field.startsWith('attendance-')) return `${field}-yes`;
    if (field.startsWith('party-')) return `party-size-${field.slice('party-'.length)}`;
    return 'rsvp-title';
  };

  if (confirmedResponse) {
    return (
      <section id="rsvp" className="rsvp-section" aria-labelledby="rsvp-title">
        <RsvpConfirmation
          invitation={invitation}
          locale={locale}
          response={confirmedResponse.response}
          duplicate={confirmedResponse.duplicate}
          restored={confirmedResponse.restored}
          receiptSaved={confirmedResponse.saved}
        />
        {invitation.rsvpStatus === 'open' ? (
          <div className="rsvp-new-guest">
            <button ref={anotherGuestRef} className="button button-text" type="button" onClick={() => setStartingAnotherGuest(!startingAnotherGuest)} aria-expanded={startingAnotherGuest} aria-controls="another-guest-details">{experience.anotherGuest}</button>
              <div id="another-guest-details" role="group" aria-label={experience.anotherGuest} hidden={!startingAnotherGuest}>
                <p>{experience.anotherGuestBody}</p>
                <p>{experience.corrections}</p>
                <div className="form-actions">
                  <button className="button button-secondary" type="button" onClick={handleAnotherGuest}>{experience.startAnotherGuest}</button>
                  <button className="button button-text" type="button" onClick={() => { setStartingAnotherGuest(false); anotherGuestRef.current?.focus(); }}>{experience.cancel}</button>
                </div>
              </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section id="rsvp" className="rsvp-section" aria-labelledby="rsvp-title">
      <div className="section-heading">
        <h2 id="rsvp-title" tabIndex={-1}>{t.rsvpTitle}</h2>
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
                <li key={field}><a href={`#${errorTarget(field)}`}>{t[message]}</a></li>
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
                updateDraft({ ...draft, inviteeName: event.target.value });
                clearErrors('inviteeName');
              }}
            />
            {errors.inviteeName ? <span id="invitee-name-error" className="field-error">{t[errors.inviteeName]}</span> : null}
          </div>

          {invitation.events.map((inviteEvent, index) => {
            const answer = draft.responses[index];
            const attendanceError = errors[`attendance-${index}`];
            const partyError = errors[`party-${index}`];
            return (
              <fieldset className="attendance-card" key={inviteEvent.id}>
                <legend>
                  <span>{localized(inviteEvent.dateLabel, locale)}</span>
                  <span>{localized(inviteEvent.title, locale)}</span>
                  {t.attendanceQuestion}
                </legend>
                {inviteEvent.segments.length > 1 ? <p className="field-help">{t.oneAnswer}</p> : null}
                <div className="attendance-choices">
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
                </div>
                {attendanceError ? <span id={`attendance-error-${index}`} className="field-error">{t[attendanceError]}</span> : null}
                {answer?.attendance === 'attending' ? (
                  <div className="form-field form-field--party">
                    <label htmlFor={`party-size-${index}`}>{t.partySize}</label>
                    <div className="party-stepper">
                      <button
                        type="button"
                        aria-label={design.decreaseParty}
                        disabled={!/^\d+$/.test(answer.partySize) || Number(answer.partySize) <= 1}
                        onClick={() => updateAnswer(inviteEvent.id, 'partySize', String(Math.max(1, Number(answer.partySize) - 1)))}
                      ><MinusIcon /></button>
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
                      <button
                        type="button"
                        aria-label={design.increaseParty}
                        onClick={() => updateAnswer(inviteEvent.id, 'partySize', String(/^\d+$/.test(answer.partySize) ? Number(answer.partySize) + 1 : 1))}
                      ><PlusIcon /></button>
                    </div>
                    {partyError ? <span id={`party-error-${index}`} className="field-error">{t[partyError]}</span> : null}
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
                updateDraft({ ...draft, message: event.target.value });
                clearErrors('message');
              }}
            />
            <span className="character-count">{draft.message.length}/500 &middot; {t.characters}</span>
            {errors.message ? <span id="guest-message-error" className="field-error">{t[errors.message]}</span> : null}
          </div>
        </fieldset>

        {statusMessage ? (
          <div className={`submission-status submission-status--${submitState}`} role="status" aria-live="polite">
            {statusMessage}
          </div>
        ) : null}

        <div className="form-actions">
          <button className="button button-primary" type="submit" disabled={submitDisabled}>
            {submitState === 'sending' ? t.sending : t.send}
          </button>
          <button className="button button-text" type="button" onClick={handleClear} disabled={submitState === 'sending' || pendingResponse}>
            {t.clear}
          </button>
        </div>
        {draftSaved !== null ? <p className="form-note" role={draftSaved ? undefined : 'status'}>{pendingResponse
          ? draftSaved ? experience.pendingSaved : experience.pendingNotSaved
          : draftSaved ? t.saved : t.draftNotSaved}</p> : null}
        <p className="form-note">{t.privacy}</p>
      </form>
    </section>
  );
}
