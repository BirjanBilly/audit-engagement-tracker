import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;
const oldUrl = process.env.OLD_DATABASE_URL;
const newUrl = process.env.NEW_DATABASE_URL;
if (!oldUrl || !newUrl) {
  throw new Error("OLD_DATABASE_URL and NEW_DATABASE_URL are required.");
}

type RelationSpec = {
  label: string;
  query: string;
};

const relations: RelationSpec[] = [
  { label: "public.clients", query: "select * from public.clients order by id" },
  {
    label: "public.engagements",
    query: "select * from public.engagements order by id",
  },
  {
    label: "public.time_entries",
    query: "select * from public.time_entries order by id",
  },
  {
    label: "public.seed_client_keys",
    query: "select * from public.seed_client_keys order by client_key",
  },
  {
    label: "public.seed_import_rows",
    query: "select * from public.seed_import_rows order by source_row_hash",
  },
  {
    label: "public.user_preferences",
    query: "select * from public.user_preferences order by user_id",
  },
  {
    label: "auth.users",
    query: "select * from auth.users order by id",
  },
  {
    label: "auth.identities",
    query: "select * from auth.identities order by id",
  },
  {
    label: "storage.buckets",
    query: "select * from storage.buckets order by id",
  },
  {
    label: "storage.objects",
    query: "select * from storage.objects order by id",
  },
];

function poolFor(url: string) {
  const useSsl = !/localhost|127\.0\.0\.1/.test(url);
  return new Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function digest(rows: unknown[]): string {
  return createHash("sha256").update(stableJson(rows)).digest("hex");
}

async function inspect(pool: pg.Pool, spec: RelationSpec) {
  const result = await pool.query(spec.query);
  return { count: result.rowCount ?? result.rows.length, digest: digest(result.rows) };
}

const oldPool = poolFor(oldUrl);
const newPool = poolFor(newUrl);
const reportRows: Array<{
  relation: string;
  oldCount: number;
  newCount: number;
  countMatch: boolean;
  digestMatch: boolean;
}> = [];

try {
  for (const relation of relations) {
    const [oldState, newState] = await Promise.all([
      inspect(oldPool, relation),
      inspect(newPool, relation),
    ]);
    reportRows.push({
      relation: relation.label,
      oldCount: oldState.count,
      newCount: newState.count,
      countMatch: oldState.count === newState.count,
      digestMatch: oldState.digest === newState.digest,
    });
  }

  console.table(reportRows);
  const failed = reportRows.filter(
    (row) => !row.countMatch || !row.digestMatch,
  );

  const markdown = [
    "# Generated Migration Verification",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "The digests compare complete rows without printing sensitive auth data.",
    "",
    "| Relation | Old | New | Count match | Full-row digest match |",
    "|---|---:|---:|:---:|:---:|",
    ...reportRows.map(
      (row) =>
        `| \`${row.relation}\` | ${row.oldCount} | ${row.newCount} | ${row.countMatch ? "Yes" : "No"} | ${row.digestMatch ? "Yes" : "No"} |`,
    ),
    "",
  ].join("\n");

  const outputDirectory = path.resolve("migration-artifacts");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "verification-report.md"),
    markdown,
    "utf8",
  );

  if (failed.length) {
    throw new Error(
      `Migration verification failed for: ${failed.map((row) => row.relation).join(", ")}`,
    );
  }
  console.log("All compared row counts and full-row digests match.");
} finally {
  await Promise.all([oldPool.end(), newPool.end()]);
}
