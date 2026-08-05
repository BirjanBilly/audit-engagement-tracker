import { completeOnboarding } from "@/app/(app)/actions";

export function OnboardingEmptyState() {
  return (
    <section className="hero-empty" aria-labelledby="welcome-title">
      <div className="empty-icon" aria-hidden="true">✓</div>
      <p className="eyebrow">Workspace ready</p>
      <h1 id="welcome-title">No clients opened yet</h1>
      <p>
        The imported portfolio is ready. Browse it to review deadlines, create
        engagements, and log audit time.
      </p>
      <form action={completeOnboarding}>
        <button className="button" type="submit">Browse all clients</button>
      </form>
    </section>
  );
}
