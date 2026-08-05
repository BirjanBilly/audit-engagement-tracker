import { createHash } from "node:crypto";

export type RawSeedRow = {
  client_name: string;
  country: string;
  fiscal_year_end: string;
  engagement_status: string;
  hours_logged: string;
  entry_date: string;
};

export type ImportIssue = {
  field: keyof RawSeedRow | "row";
  code: string;
  message: string;
  original_value?: string;
};

export const VALID_STATUSES = [
  "planning",
  "fieldwork",
  "review",
  "complete",
] as const;

export type EngagementStatus = (typeof VALID_STATUSES)[number];

export function normalizeWhitespace(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeName(value: unknown): string {
  return normalizeWhitespace(value);
}

export function normalizeCountry(value: unknown): string | null {
  const country = normalizeWhitespace(value).toUpperCase();
  return country || null;
}

export function normalizeStatus(value: unknown): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function sha256(parts: Array<string | number | null>): string {
  const canonical = parts
    .map((value) => (value === null ? "" : String(value)))
    .join("|");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function parseStrictDate(value: unknown): string | null {
  const raw = normalizeWhitespace(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    const [, yearText, monthText, dayText] = iso;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    return isRealDate(year, month, day)
      ? `${yearText}-${monthText}-${dayText}`
      : null;
  }

  const british = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (british) {
    const [, dayText, monthText, yearText] = british;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    return isRealDate(year, month, day)
      ? `${yearText}-${monthText}-${dayText}`
      : null;
  }

  return null;
}

export function parseFiscalYearEnd(
  value: unknown,
): { value: string | null; issue?: ImportIssue } {
  const raw = normalizeWhitespace(value);
  if (!raw || raw.toUpperCase() === "N/A") {
    return {
      value: null,
      issue: {
        field: "fiscal_year_end",
        code: "MISSING_FISCAL_YEAR_END",
        message: "Fiscal year end was missing or marked N/A; stored as NULL.",
        original_value: raw,
      },
    };
  }

  const parsed = parseStrictDate(raw);
  if (parsed) {
    const normalized = parsed !== raw;
    return {
      value: parsed,
      issue: normalized
        ? {
            field: "fiscal_year_end",
            code: "NORMALIZED_DATE_FORMAT",
            message: "Fiscal year end was converted to ISO YYYY-MM-DD.",
            original_value: raw,
          }
        : undefined,
    };
  }

  return {
    value: null,
    issue: {
      field: "fiscal_year_end",
      code: "INVALID_FISCAL_YEAR_END",
      message: "Fiscal year end was not a real supported date; stored as NULL.",
      original_value: raw,
    },
  };
}

export function parseHours(
  value: unknown,
): { value: number | null; issue?: ImportIssue } {
  const raw = normalizeWhitespace(value);
  if (!raw) {
    return {
      value: null,
      issue: {
        field: "hours_logged",
        code: "MISSING_HOURS",
        message: "Hours were missing; no time entry was created.",
        original_value: raw,
      },
    };
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return {
      value: null,
      issue: {
        field: "hours_logged",
        code: "NON_NUMERIC_HOURS",
        message: "Hours were not numeric; no time entry was created.",
        original_value: raw,
      },
    };
  }

  if (parsed <= 0) {
    return {
      value: null,
      issue: {
        field: "hours_logged",
        code: "NON_POSITIVE_HOURS",
        message: "Hours must be greater than zero; no time entry was created.",
        original_value: raw,
      },
    };
  }

  return { value: Math.round(parsed * 100) / 100 };
}

export function canonicalizeRow(raw: RawSeedRow) {
  const name = normalizeName(raw.client_name);
  const country = normalizeCountry(raw.country);
  const fiscal = parseFiscalYearEnd(raw.fiscal_year_end);
  const status = normalizeStatus(raw.engagement_status);
  const hours = parseHours(raw.hours_logged);
  const entryDate = parseStrictDate(raw.entry_date);
  const issues: ImportIssue[] = [];

  if (!name) {
    issues.push({
      field: "client_name",
      code: "MISSING_CLIENT_NAME",
      message: "Client name is required; the business row cannot be created.",
      original_value: raw.client_name,
    });
  }

  if (country && !/^[A-Z]{2}$/.test(country)) {
    issues.push({
      field: "country",
      code: "INVALID_COUNTRY",
      message: "Country was not a two-letter code; stored as NULL.",
      original_value: raw.country,
    });
  }

  if (fiscal.issue) issues.push(fiscal.issue);
  if (hours.issue) issues.push(hours.issue);

  if (!VALID_STATUSES.includes(status as EngagementStatus)) {
    issues.push({
      field: "engagement_status",
      code: "INVALID_STATUS",
      message: "Engagement status was outside the allowed enum.",
      original_value: raw.engagement_status,
    });
  }

  if (!entryDate) {
    issues.push({
      field: "entry_date",
      code: "INVALID_ENTRY_DATE",
      message: "Entry date was not a real supported date; no time entry was created.",
      original_value: raw.entry_date,
    });
  }

  const safeCountry = country && /^[A-Z]{2}$/.test(country) ? country : null;
  const clientKey = sha256([name.toLocaleLowerCase("en-GB"), safeCountry, fiscal.value]);
  const sourceRowHash = sha256([
    name.toLocaleLowerCase("en-GB"),
    safeCountry,
    normalizeWhitespace(raw.fiscal_year_end).toLowerCase(),
    status,
    normalizeWhitespace(raw.hours_logged).toLowerCase(),
    normalizeWhitespace(raw.entry_date),
  ]);

  return {
    name,
    country: safeCountry,
    fiscalYearEnd: fiscal.value,
    status,
    hours: hours.value,
    entryDate,
    issues,
    clientKey,
    sourceRowHash,
  };
}
