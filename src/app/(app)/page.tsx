import Link from "next/link";
import { OnboardingEmptyState } from "@/components/onboarding-empty-state";
import { fiscalYearUrgency } from "@/lib/date-display";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const search = q.trim();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  const preference = userId
    ? await supabase
        .from("user_preferences")
        .select("onboarding_complete")
        .eq("user_id", userId)
        .maybeSingle()
    : { data: null, error: null };

  if (preference.error) {
    console.error("preference lookup", preference.error.code);
  }
  if (!preference.data?.onboarding_complete) {
    return <OnboardingEmptyState />;
  }

  let query = supabase
    .from("clients")
    .select("id,name,country,fiscal_year_end,created_at")
    .order("name")
    .range(0, 499);
  if (search) query = query.ilike("name", `%${search}%`);
  const { data: clients, error } = await query;

  if (error) {
    return (
      <section className="state-card" role="alert">
        <div className="empty-icon error-icon" aria-hidden="true">!</div>
        <h1>We couldn&apos;t load clients</h1>
        <p>The data is safe. Refresh the page, or try again in a moment.</p>
        <Link className="button" href="/">Try again</Link>
      </section>
    );
  }

  return (
    <section className="stack large-gap">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Client portfolio</p>
          <h1>Clients</h1>
          <p className="muted">Review year ends and open engagement workspaces.</p>
        </div>
        <span className="record-count">{clients.length} shown</span>
      </div>

      <form className="search-bar" role="search">
        <label htmlFor="client-search">Search clients</label>
        <div>
          <input
            id="client-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search by client name"
          />
          <button className="button" type="submit">Search</button>
          {search ? <Link className="clear-link" href="/">Clear</Link> : null}
        </div>
      </form>

      {clients.length === 0 ? (
        <section className="state-card">
          <div className="empty-icon" aria-hidden="true">🔍</div>
          <h2>{search ? "No matching clients" : "No clients yet"}</h2>
          <p>
            {search
              ? `No client names matched '${search}'. Try a shorter search.`
              : "Import the seed file to create the initial audit portfolio."}
          </p>
          {search ? <Link className="button" href="/">Show all clients</Link> : null}
        </section>
      ) : (
        <div className="client-grid">
          {clients.map((client) => (
            <Link className="client-card" href={`/clients/${client.id}`} key={client.id}>
              <div className="client-card-top">
                <h2>{client.name}</h2>
                <span aria-hidden="true">&rarr;</span>
              </div>
              <dl>
                <div>
                  <dt>Country</dt>
                  <dd>{client.country ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Fiscal year end</dt>
                  <dd>{client.fiscal_year_end ?? "Not provided"}</dd>
                </div>
              </dl>
              <p className="deadline-cue">{fiscalYearUrgency(client.fiscal_year_end)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}