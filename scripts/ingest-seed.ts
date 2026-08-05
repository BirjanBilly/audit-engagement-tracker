import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import pg from "pg";
import {
  canonicalizeRow,
  VALID_STATUSES,
  type EngagementStatus,
  type RawSeedRow,
} from "./seed-utils";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Put it in .env.local or the shell.");
}

const filePath = path.resolve(process.argv[2] ?? "data/seed_data.csv");
const sourceFile = path.basename(filePath);
const csv = await readFile(filePath, "utf8");
const rows = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  trim: false,
}) as RawSeedRow[];

const useSsl = !/localhost|127\.0\.0\.1/.test(databaseUrl);
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  max: 4,
});

const seenInFile = new Set<string>();
const totals = {
  inputRows: rows.length,
  duplicateRowsInFile: 0,
  previouslyImported: 0,
  clientsCreated: 0,
  engagementsCreated: 0,
  timeEntriesCreated: 0,
  rejectedRows: 0,
};

try {
  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const sourceLine = index + 2;
    const normalized = canonicalizeRow(raw);

    if (seenInFile.has(normalized.sourceRowHash)) {
      totals.duplicateRowsInFile += 1;
      continue;
    }
    seenInFile.add(normalized.sourceRowHash);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [normalized.sourceRowHash],
      );

      const imported = await client.query<{ source_row_hash: string }>(
        "select source_row_hash from public.seed_import_rows where source_row_hash = $1",
        [normalized.sourceRowHash],
      );
      if (imported.rowCount) {
        totals.previouslyImported += 1;
        await client.query("commit");
        continue;
      }

      if (!normalized.name) {
        await client.query(
          `insert into public.seed_import_rows
             (source_row_hash, source_file, raw_row, issues, outcome, source_line)
           values ($1, $2, $3::jsonb, $4::jsonb, $5, $6)`,
          [
            normalized.sourceRowHash,
            sourceFile,
            JSON.stringify(raw),
            JSON.stringify(normalized.issues),
            "rejected_missing_client_name",
            sourceLine,
          ],
        );
        totals.rejectedRows += 1;
        await client.query("commit");
        continue;
      }

      await client.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        [normalized.clientKey],
      );

      const existingClient = await client.query<{ client_id: string }>(
        "select client_id from public.seed_client_keys where client_key = $1",
        [normalized.clientKey],
      );

      let clientId: string;
      if (existingClient.rows[0]) {
        clientId = existingClient.rows[0].client_id;
      } else {
        const createdClient = await client.query<{ id: string }>(
          `insert into public.clients (name, country, fiscal_year_end)
           values ($1, $2, $3)
           returning id`,
          [normalized.name, normalized.country, normalized.fiscalYearEnd],
        );
        clientId = createdClient.rows[0].id;
        await client.query(
          `insert into public.seed_client_keys (client_key, client_id)
           values ($1, $2)`,
          [normalized.clientKey, clientId],
        );
        totals.clientsCreated += 1;
      }

      if (!VALID_STATUSES.includes(normalized.status as EngagementStatus)) {
        await client.query(
          `insert into public.seed_import_rows
             (source_row_hash, source_file, raw_row, issues, outcome, source_line, client_id)
           values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
          [
            normalized.sourceRowHash,
            sourceFile,
            JSON.stringify(raw),
            JSON.stringify(normalized.issues),
            "rejected_invalid_status",
            sourceLine,
            clientId,
          ],
        );
        totals.rejectedRows += 1;
        await client.query("commit");
        continue;
      }

      const engagement = await client.query<{ id: string }>(
        `insert into public.engagements (client_id, status)
         values ($1, $2::public.engagement_status)
         returning id`,
        [clientId, normalized.status],
      );
      const engagementId = engagement.rows[0].id;
      totals.engagementsCreated += 1;

      let timeEntryId: string | null = null;
      if (normalized.hours !== null && normalized.entryDate !== null) {
        const timeEntry = await client.query<{ id: string }>(
          `insert into public.time_entries
             (engagement_id, hours, entry_date, description)
           values ($1, $2, $3, $4)
           returning id`,
          [
            engagementId,
            normalized.hours,
            normalized.entryDate,
            "Imported from seed_data.csv",
          ],
        );
        timeEntryId = timeEntry.rows[0].id;
        totals.timeEntriesCreated += 1;
      }

      const outcome = timeEntryId
        ? "engagement_and_time_entry_created"
        : "engagement_created_without_time_entry";

      await client.query(
        `insert into public.seed_import_rows
           (source_row_hash, source_file, raw_row, issues, outcome, source_line,
            client_id, engagement_id, time_entry_id)
         values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)`,
        [
          normalized.sourceRowHash,
          sourceFile,
          JSON.stringify(raw),
          JSON.stringify(normalized.issues),
          outcome,
          sourceLine,
          clientId,
          engagementId,
          timeEntryId,
        ],
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw new Error(`Seed import failed at CSV line ${sourceLine}`, {
        cause: error,
      });
    } finally {
      client.release();
    }
  }

  const counts = await pool.query<{
    clients: string;
    engagements: string;
    time_entries: string;
    import_rows: string;
  }>(`
    select
      (select count(*) from public.clients)::text as clients,
      (select count(*) from public.engagements)::text as engagements,
      (select count(*) from public.time_entries)::text as time_entries,
      (select count(*) from public.seed_import_rows)::text as import_rows
  `);

  console.log(
    JSON.stringify(
      {
        ...totals,
        finalDatabaseCounts: counts.rows[0],
        expectedForProvidedFile: {
          clients: 388,
          engagements: 420,
          time_entries: 401,
          import_rows: 420,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
