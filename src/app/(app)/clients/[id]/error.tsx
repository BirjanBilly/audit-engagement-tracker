"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ClientError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("client-page-error", error.digest ?? error.name);
  }, [error]);

  return (
    <section className="state-card" role="alert">
      <div className="empty-icon error-icon" aria-hidden="true">!</div>
      <h1>We couldn’t open this client</h1>
      <p>The client data has not been changed.</p>
      <div className="button-row">
        <button className="button" type="button" onClick={reset}>Try again</button>
        <Link className="button ghost" href="/">Return to clients</Link>
      </div>
    </section>
  );
}
