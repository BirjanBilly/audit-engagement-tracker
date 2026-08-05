import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card empty-state">
        <p className="eyebrow">404</p>
        <h1>We couldn’t find that record</h1>
        <p className="muted">
          It may have been removed or the link may be incorrect.
        </p>
        <Link className="button" href="/">
          Return to clients
        </Link>
      </section>
    </main>
  );
}
