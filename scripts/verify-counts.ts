import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const useSsl = !/localhost|127\.0\.0\.1/.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});

try {
  const result = await pool.query<{ relation: string; row_count: string }>(`
    select 'public.clients' as relation, count(*)::text as row_count from public.clients
    union all
    select 'public.engagements', count(*)::text from public.engagements
    union all
    select 'public.time_entries', count(*)::text from public.time_entries
    union all
    select 'public.seed_client_keys', count(*)::text from public.seed_client_keys
    union all
    select 'public.seed_import_rows', count(*)::text from public.seed_import_rows
    union all
    select 'auth.users', count(*)::text from auth.users
    union all
    select 'auth.identities', count(*)::text from auth.identities
    union all
    select 'storage.buckets', count(*)::text from storage.buckets
    union all
    select 'storage.objects', count(*)::text from storage.objects
    order by relation
  `);

  console.table(
    result.rows.map((row) => ({
      relation: row.relation,
      row_count: Number(row.row_count),
    })),
  );
} finally {
  await pool.end();
}
