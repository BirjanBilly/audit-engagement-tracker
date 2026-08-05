import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { canonicalizeRow, type RawSeedRow } from "./seed-utils";

const filePath = path.resolve(process.argv[2] ?? "data/seed_data.csv");
const text = await readFile(filePath, "utf8");
const rows = parse(text, {
  columns: true,
  skip_empty_lines: true,
  bom: true,
  trim: false,
}) as RawSeedRow[];

const uniqueRows = new Map<string, ReturnType<typeof canonicalizeRow>>();
let duplicateRows = 0;

for (const raw of rows) {
  const canonical = canonicalizeRow(raw);
  if (uniqueRows.has(canonical.sourceRowHash)) {
    duplicateRows += 1;
    continue;
  }
  uniqueRows.set(canonical.sourceRowHash, canonical);
}

const unique = [...uniqueRows.values()];
const issueCounts = new Map<string, number>();
for (const row of unique) {
  for (const issue of row.issues) {
    issueCounts.set(issue.code, (issueCounts.get(issue.code) ?? 0) + 1);
  }
}

const summary = {
  input_rows: rows.length,
  canonical_duplicate_rows: duplicateRows,
  unique_source_rows: unique.length,
  unique_clients: new Set(unique.map((row) => row.clientKey)).size,
  engagements_to_create: unique.filter((row) =>
    ["planning", "fieldwork", "review", "complete"].includes(row.status),
  ).length,
  valid_time_entries: unique.filter(
    (row) => row.hours !== null && row.entryDate !== null,
  ).length,
  issue_counts: Object.fromEntries([...issueCounts.entries()].sort()),
};

console.log(JSON.stringify(summary, null, 2));
