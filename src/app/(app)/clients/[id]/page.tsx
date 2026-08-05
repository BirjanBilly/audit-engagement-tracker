import Link from "next/link";
import { notFound } from "next/navigation";
import { EngagementForm } from "@/components/engagement-form";
import { StatusSelect } from "@/components/status-select";
import { TimeEntryForm } from "@/components/time-entry-form";
import { fiscalYearUrgency } from "@/lib/date-display";
import { createClient } from "@/lib/supabase/server";

type Entry = {
  id: string;
  hours: number | string;
  entry_date: string;
  description: string;
  created_at: string;
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: client, error: clientError }, { data: engagements, error }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id,name,country,fiscal_year_end")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("engagements")
        .select("id,status,created_at,time_entries(id,hours,entry_date,description,created_at)")
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (clientError) throw new Error("The client could not be loaded.");
  if (!client) notFound();
  if (error) throw new Error("The engagements could not be loaded.");

  const totalHours = engagements.reduce(
    (sum, engagement) =>
      sum +
      ((engagement.time_entries as Entry[] | null) ?? []).reduce(
        (entrySum, entry) => entrySum + Number(entry.hours),
        0,
      ),
    0,
  );

  return (
    <section className="stack large-gap">
      <Link className="back-link" href="/">← All clients</Link>
      <header className="client-hero">
        <div>
          <p className="eyebrow">Client workspace</p>
          <h1>{client.name}</h1>
          <p className="muted">
            {client.country ?? "Country not provided"} · Fiscal year end{" "}
            {client.fiscal_year_end ?? "not provided"}
          </p>
          <p className="deadline-cue hero-cue">
            {fiscalYearUrgency(client.fiscal_year_end)}
          </p>
        </div>
        <div className="summary-stat">
          <strong>{totalHours.toFixed(2)}</strong>
          <span>Total hours</span>
        </div>
      </header>

      <section className="panel" aria-labelledby="create-engagement-title">
        <div className="section-heading">
          <div>
            <h2 id="create-engagement-title">Create engagement</h2>
            <p className="muted">Start a new audit workstream for this client.</p>
          </div>
        </div>
        <EngagementForm clientId={client.id} />
      </section>

      <section className="stack" aria-labelledby="engagement-list-title">
        <div className="section-heading">
          <h2 id="engagement-list-title">Engagements</h2>
          <span className="record-count">{engagements.length}</span>
        </div>

        {engagements.length === 0 ? (
          <section className="state-card compact-state">
            <div className="empty-icon" aria-hidden="true">+</div>
            <h3>No engagements for this client</h3>
            <p>Use the form above to create the first audit engagement.</p>
            <a className="button" href="#create-engagement-title">Create engagement</a>
          </section>
        ) : (
          engagements.map((engagement) => {
            const entries = ((engagement.time_entries as Entry[] | null) ?? []).sort(
              (a, b) => b.entry_date.localeCompare(a.entry_date),
            );
            const engagementHours = entries.reduce(
              (sum, entry) => sum + Number(entry.hours),
              0,
            );

            return (
              <article className="panel engagement-panel" key={engagement.id}>
                <div className="engagement-heading">
                  <StatusSelect
                    engagementId={engagement.id}
                    clientId={client.id}
                    initialStatus={engagement.status}
                  />
                  <div className="summary-stat small">
                    <strong>{engagementHours.toFixed(2)}</strong>
                    <span>Hours logged</span>
                  </div>
                </div>

                <p className="muted engagement-date">
                  Created {new Date(engagement.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>

                <details className="time-entry-disclosure">
                  <summary>Log time</summary>
                  <TimeEntryForm clientId={client.id} engagementId={engagement.id} />
                </details>

                <div className="time-section">
                  <h3>Time entries</h3>
                  {entries.length === 0 ? (
                    <div className="inline-empty">
                      <p>No time has been logged.</p>
                      <p className="muted">Open “Log time” to record the first piece of work.</p>
                    </div>
                  ) : (
                    <ul className="time-list">
                      {entries.map((entry) => (
                        <li key={entry.id}>
                          <strong>{Number(entry.hours).toFixed(2)}h</strong>
                          <time dateTime={entry.entry_date}>
                            {new Date(`${entry.entry_date}T00:00:00Z`).toLocaleDateString("en-GB")}
                          </time>
                          <span>{entry.description || "No description"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}
