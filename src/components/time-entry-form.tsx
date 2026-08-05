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
  const [state, formAction, pending] = useActionState(
    createTimeEntry,
    initialFormState,
  );

  return (
    <form action={formAction} className="time-form">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="engagement_id" value={engagementId} />
      <div className="field">
        <label htmlFor={`hours-${engagementId}`}>Hours</label>
        <input
          id={`hours-${engagementId}`}
          name="hours"
          type="number"
          min="0.01"
          step="0.01"
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`date-${engagementId}`}>Entry date</label>
        <input
          id={`date-${engagementId}`}
          name="entry_date"
          type="date"
          required
        />
      </div>
      <div className="field grow">
        <label htmlFor={`description-${engagementId}`}>Description</label>
        <input
          id={`description-${engagementId}`}
          name="description"
          type="text"
          maxLength={1000}
        />
      </div>
      <button className="button secondary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Log time"}
      </button>
      {state.message ? (
        <p role="status" className={state.ok ? "success" : "field-error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
