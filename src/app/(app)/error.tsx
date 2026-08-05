"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("application-error", error.digest ?? error.name);
  }, [error]);

  return (
    <section className="state-card" role="alert">
      <div className="empty-icon error-icon" aria-hidden="true">!</div>
      <h1>Something didn’t load correctly</h1>
      <p>Your data has not been changed. Try the request again.</p>
      <button className="button" type="button" onClick={reset}>Try again</button>
    </section>
  );
}
