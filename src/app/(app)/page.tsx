import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: clients, error } = await supabase
    .from("clients")
    .select("id,name,country,fiscal_year_end,created_at")
    .order("name")
    .range(0, 499);

  if (error) {
    return (
      <section className="panel">
        <h1>Clients</h1>
        <p role="alert">
          We couldn’t load the client list. Refresh the page or try again later.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Client portfolio</p>
          <h1>Clients</h1>
        </div>
        <p>{clients.length} records</p>
      </div>

      {clients.length === 0 ? (
        <div className="panel empty-state">
          <h2>No clients yet</h2>
          <p>Run the seed import to add the initial audit client portfolio.</p>
        </div>
      ) : (
        <div className="client-grid">
          {clients.map((client) => (
            <Link
              className="client-card"
              href={`/clients/${client.id}`}
              key={client.id}
            >
              <h2>{client.name}</h2>
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
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
