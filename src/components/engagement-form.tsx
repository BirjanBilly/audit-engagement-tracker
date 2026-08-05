"use client";

import { useActionState } from "react";
import { createEngagement } from "@/app/(app)/actions";
import { initialFormState } from "@/lib/forms";

export function EngagementForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(
    createEngagement,
    initialFormState,
  );

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="client_id" value={clientId} />
      <label htmlFor="new-status">New engagement status</label>
      <select id="new-status" name="status" defaultValue="planning">
        <option value="planning">Planning</option>
        <option value="fieldwork">Fieldwork</option>
        <option value="review">Review</option>
        <option value="complete">Complete</option>
      </select>
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create engagement"}
      </button>
      {state.message ? (
        <p role="status" className={state.ok ? "success" : "field-error"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
