"use client";

import { useId, useState } from "react";
import { updateEngagementStatus } from "@/app/(app)/actions";

const statuses = ["planning", "fieldwork", "review", "complete"] as const;
type Status = (typeof statuses)[number];

export function StatusSelect({
  engagementId,
  clientId,
  initialStatus,
}: {
  engagementId: string;
  clientId: string;
  initialStatus: Status;
}) {
  const id = useId();
  const [displayedStatus, setDisplayedStatus] = useState<Status>(initialStatus);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function changeStatus(nextStatus: Status) {
    const previousStatus = displayedStatus;
    setDisplayedStatus(nextStatus); // optimistic update
    setPending(true);
    setMessage("");
    setFailed(false);

    try {
      const result = await updateEngagementStatus({
        engagementId,
        clientId,
        status: nextStatus,
      });

      if (!result.ok) {
        setDisplayedStatus(previousStatus); // visible rollback
        setFailed(true);
      }
      setMessage(result.message);
    } catch {
      setDisplayedStatus(previousStatus); // network/server-action rollback
      setFailed(true);
      setMessage(
        "We couldn’t save the new status. Your previous status has been restored.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="status-control">
      <label htmlFor={id}>Engagement status</label>
      <div className="status-row">
        <span className={`status status-${displayedStatus}`} aria-hidden="true">
          {displayedStatus}
        </span>
        <select
          id={id}
          value={displayedStatus}
          disabled={pending}
          onChange={(event) => changeStatus(event.target.value as Status)}
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status[0].toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
        {pending ? <span className="muted">Saving…</span> : null}
      </div>
      {message ? (
        <p className={failed ? "rollback-message" : "success"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
