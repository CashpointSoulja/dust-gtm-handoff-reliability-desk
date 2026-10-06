import { describe, expect, it } from "vitest";
import { importCsv, parseCsv, toCsv } from "../src/engine/csv";
import { CSV_COLUMNS } from "../src/engine/types";
import { SAMPLE_CSV } from "../src/engine/sample";

describe("CSV import and row validation", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n1,2,3\r\n')).toEqual([["a", "b, c", 'd "e"'], ["1", "2", "3"]]);
    expect(parseCsv(toCsv([["x,y", 'q"'], ["1", ""]]))).toEqual([["x,y", 'q"'], ["1", ""]]);
  });
  it("refuses an empty file and a file missing required columns", () => {
    expect(importCsv("").headerError).toMatch(/empty/);
    expect(importCsv("record_id,email\n1,a@b.co\n").headerError).toMatch(/Missing required column/);
  });
  it("reports per-row errors with row and column, and keeps valid rows", () => {
    const r = importCsv(SAMPLE_CSV);
    expect(r.totalDataRows).toBe(19);
    expect(r.rows).toHaveLength(18);
    expect(r.errors.map((e) => [e.row, e.column])).toEqual([[14, "email"], [14, "qualified_at"]]);
  });
  it("flags wrong field counts, unknown owners, bad sources and budget values", () => {
    const header = CSV_COLUMNS.join(",");
    const good = ["200001", "a@x.example", "A", "B", "Co", "x.example", "FR", "10", "event", "salesqualifiedlead", "", "2026-10-05T10:00:00+02:00", "", "p", "yes", "c", "t", "n-1", "2026-10-05T09:00:00+02:00"];
    const bad = [...good]; bad[0] = "200002"; bad[10] = "o-nobody"; bad[8] = "cold_call"; bad[14] = "maybe";
    const r = importCsv(`${header}\n${good.join(",")}\n${bad.join(",")}\n1,2,3\n`);
    expect(r.rows.map((x) => x.record_id)).toEqual(["200001"]);
    expect(r.errors.map((e) => e.column).sort()).toEqual(["*", "budget_confirmed", "owner_id", "source"]);
  });
});
