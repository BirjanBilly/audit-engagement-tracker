"use client";

import { useActionState } from "react";
import { createEngagement } from "@/app/(app)/actions";
import { initialFormState } from "@/lib/forms";

export function EngagementForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(createEngagement, initialFormState);

  return (
    <form action={formAction} className="inline-form" noValidate>
      <input type="hidden" name="client_id" value={clientId} />
      <div className="field">
        <label htmlFor="new-status">Starting status</label>
        <select
          id="new-status"
          name="status"
          defaultValue="planning"
          aria-describedby={state.fieldErrors?.status ? "new-status-error" : undefined}
        >
          <option value="planning">Planning</option>
          <option value="fieldwork">Fieldwork</option>
          <option value="review">Review</option>
          <option value="complete">Complete</option>
        </select>
        {state.fieldErrors?.status ? (
          <p id="new-status-error" className="field-error">{state.fieldErrors.status[0]}</p>
        ) : null}
      </div>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Creating engagement…" : "Create engagement"}
      </button>
      {state.message ? (
        <p role={state.ok ? "status" : "alert"} className={state.ok ? "success" : "field-error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
