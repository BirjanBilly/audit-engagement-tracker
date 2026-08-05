import { describe, expect, it } from "vitest";
import {
  canonicalizeRow,
  parseFiscalYearEnd,
  parseHours,
  parseStrictDate,
} from "./seed-utils";

describe("seed normalization", () => {
  it("normalizes British dates without accepting impossible dates", () => {
    expect(parseStrictDate("31/12/2026")).toBe("2026-12-31");
    expect(parseStrictDate("31/06/2026")).toBeNull();
    expect(parseStrictDate("2026-13-45")).toBeNull();
  });

  it("stores malformed fiscal year ends as null with an issue", () => {
    const parsed = parseFiscalYearEnd("Dec 31st");
    expect(parsed.value).toBeNull();
    expect(parsed.issue?.code).toBe("INVALID_FISCAL_YEAR_END");
  });

  it("never fabricates zero hours", () => {
    expect(parseHours("many").value).toBeNull();
    expect(parseHours("-5").value).toBeNull();
    expect(parseHours("0").value).toBeNull();
    expect(parseHours("3.25").value).toBe(3.25);
  });

  it("deduplicates case and whitespace variants", () => {
    const first = canonicalizeRow({
      client_name: " Kestrel   Audit ",
      country: "gb",
      fiscal_year_end: "2026-06-30",
      engagement_status: "Complete",
      hours_logged: "53.6",
      entry_date: "2026-09-30",
    });
    const second = canonicalizeRow({
      client_name: "kestrel audit",
      country: "GB",
      fiscal_year_end: "2026-06-30",
      engagement_status: "complete",
      hours_logged: "53.6",
      entry_date: "2026-09-30",
    });
    expect(first.sourceRowHash).toBe(second.sourceRowHash);
    expect(first.clientKey).toBe(second.clientKey);
  });
});
