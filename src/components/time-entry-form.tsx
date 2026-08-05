"use client";

import { useActionState } from "react";
import { createTimeEntry } from "@/app/(app)/actions";
import { initialFormState } from "@/lib/forms";

export function TimeEntryForm({
  clientId,
  engagementId,
}: {
  clientId: string;
  engagementId: string;
}) {
  const [state, formAction, pending] = useActionState(createTimeEntry, initialFormState);

  return (
    <form action={formAction} className="time-form" noValidate>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="engagement_id" value={engagementId} />
      <div className="field">
        <label htmlFor={`hours-${engagementId}`}>Hours</label>
        <input
          id={`hours-${engagementId}`}
          name="hours"
          type="number"
          inputMode="decimal"
          min="0.01"
          step="0.01"
          required
          aria-describedby={state.fieldErrors?.hours ? `hours-error-${engagementId}` : undefined}
        />
        {state.fieldErrors?.hours ? (
          <p id={`hours-error-${engagementId}`} className="field-error">{state.fieldErrors.hours[0]}</p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor={`date-${engagementId}`}>Entry date</label>
        <input
          id={`date-${engagementId}`}
          name="entry_date"
          type="date"
          required
          aria-describedby={state.fieldErrors?.entry_date ? `date-error-${engagementId}` : undefined}
        />
        {state.fieldErrors?.entry_date ? (
          <p id={`date-error-${engagementId}`} className="field-error">{state.fieldErrors.entry_date[0]}</p>
        ) : null}
      </div>
      <div className="field grow">
        <label htmlFor={`description-${engagementId}`}>Description</label>
        <input
          id={`description-${engagementId}`}
          name="description"
          type="text"
          maxLength={1000}
          placeholder="Work completed"
          aria-describedby={state.fieldErrors?.description ? `description-error-${engagementId}` : undefined}
        />
        {state.fieldErrors?.description ? (
          <p id={`description-error-${engagementId}`} className="field-error">{state.fieldErrors.description[0]}</p>
        ) : null}
      </div>
      <button className="button secondary" type="submit" disabled={pending}>
        {pending ? "Saving time…" : "Save time entry"}
      </button>
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "success" : "field-error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
