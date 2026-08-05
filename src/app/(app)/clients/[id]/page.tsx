import Link from "next/link";
import { notFound } from "next/navigation";
import { EngagementForm } from "@/components/engagement-form";
import { TimeEntryForm } from "@/components/time-entry-form";
import { createClient } from "@/lib/supabase/server";

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
        .select(
          "id,status,created_at,time_entries(id,hours,entry_date,description,created_at)",
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (clientError) {
    throw new Error("Client lookup failed.");
  }
  if (!client) notFound();
  if (error) throw new Error("Engagement lookup failed.");

  return (
    <section className="stack large-gap">
      <Link href="/">← All clients</Link>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Client</p>
          <h1>{client.name}</h1>
          <p className="muted">
            {client.country ?? "Country not provided"} · Fiscal year end{" "}
            {client.fiscal_year_end ?? "not provided"}
          </p>
        </div>
      </div>

      <section className="panel">
        <h2>Create engagement</h2>
        <EngagementForm clientId={client.id} />
      </section>

      <section className="stack">
        <h2>Engagements</h2>
        {engagements.length === 0 ? (
          <div className="panel empty-state">
            <h3>No engagements</h3>
            <p>Create this client’s first engagement above.</p>
          </div>
        ) : (
          engagements.map((engagement) => {
            const entries = engagement.time_entries ?? [];
            const total = entries.reduce(
              (sum, entry) => sum + Number(entry.hours),
              0,
            );
            return (
              <article className="panel" key={engagement.id}>
                <div className="engagement-heading">
                  <div>
                    <span className={`status status-${engagement.status}`}>
                      {engagement.status}
                    </span>
                    <p className="muted">
                      Created {new Date(engagement.created_at).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                  <strong>{total.toFixed(2)} hours</strong>
                </div>
                <TimeEntryForm
                  clientId={client.id}
                  engagementId={engagement.id}
                />
                {entries.length ? (
                  <ul className="time-list">
                    {entries.map((entry) => (
                      <li key={entry.id}>
                        <strong>{Number(entry.hours).toFixed(2)}h</strong>
                        <span>{entry.entry_date}</span>
                        <span>{entry.description || "No description"}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No time has been logged.</p>
                )}
              </article>
            );
          })
        )}
      </section>
    </section>
  );
}
