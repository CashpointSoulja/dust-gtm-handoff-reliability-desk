import { CSV_COLUMNS, type CsvColumn, type LeadRow, type RowError } from "./types";
import { SOURCES, ownerById, type LeadSource } from "./policy";
import { parseIsoInstant } from "./time";

/** RFC 4180-style parser: quoted fields, escaped quotes, CRLF/LF. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(f); f = "";
      if (row.some((x) => x.trim() !== "")) out.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim() !== "")) out.push(row);
  return out;
}

export interface ImportResult { rows: LeadRow[]; errors: RowError[]; headerError: string | null; totalDataRows: number }

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[a-z]{2,}$/i;

export function importCsv(text: string): ImportResult {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], errors: [], headerError: "The file is empty.", totalDataRows: 0 };
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], errors: [], headerError: `Missing required column(s): ${missing.join(", ")}.`, totalDataRows: grid.length - 1 };
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<CsvColumn, number>;
  const rows: LeadRow[] = [];
  const errors: RowError[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const n = r;
    if (cells.length !== header.length) { errors.push({ row: n, column: "*", message: `Expected ${header.length} fields, found ${cells.length}.` }); continue; }
    const v = (c: CsvColumn) => (cells[idx[c]] ?? "").trim();
    const errs: RowError[] = [];
    const err = (column: CsvColumn, message: string) => errs.push({ row: n, column, message });
    if (!/^\d{3,12}$/.test(v("record_id"))) err("record_id", "Stable record_id is required (3–12 digits).");
    if (!EMAIL.test(v("email"))) err("email", "Not a valid email address.");
    if (!/^[A-Za-z]{2}$/.test(v("country"))) err("country", "Use an ISO 3166-1 alpha-2 code.");
    const emp = v("employees");
    if (!/^\d+$/.test(emp)) err("employees", "Must be a whole number.");
    if (!(SOURCES as readonly string[]).includes(v("source"))) err("source", `Must be one of ${SOURCES.join(", ")}.`);
    if (!v("lifecycle_stage")) err("lifecycle_stage", "Required.");
    if (v("owner_id") && !ownerById(v("owner_id"))) err("owner_id", `Unknown owner_id "${v("owner_id")}" (not in roster).`);
    for (const c of ["qualified_at", "first_touch_at", "evidence_captured_at"] as const) {
      const x = v(c);
      if (c === "qualified_at" && !x) { err(c, "Required."); continue; }
      if (x && parseIsoInstant(x) === null) err(c, "Timestamp needs ISO-8601 with an explicit offset, e.g. 2026-10-05T09:15:00+01:00.");
    }
    const bc = v("budget_confirmed").toLowerCase();
    if (bc && bc !== "yes" && bc !== "no") err("budget_confirmed", 'Use "yes", "no" or leave blank.');
    if (errs.length) { errors.push(...errs); continue; }
    rows.push({
      row: n, record_id: v("record_id"), email: v("email").toLowerCase(), first_name: v("first_name"), last_name: v("last_name"),
      company: v("company"), company_domain: v("company_domain").toLowerCase(), country: v("country").toUpperCase(),
      employees: Number(emp), source: v("source") as LeadSource, lifecycle_stage: v("lifecycle_stage").toLowerCase(),
      owner_id: v("owner_id"), qualified_at: v("qualified_at"), first_touch_at: v("first_touch_at"), pain: v("pain"),
      budget_confirmed: bc, champion: v("champion"), timeline: v("timeline"), evidence_source_id: v("evidence_source_id"),
      evidence_captured_at: v("evidence_captured_at"),
    });
  }
  return { rows, errors, headerError: null, totalDataRows: grid.length - 1 };
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n";
}

/** FNV-1a 32-bit, hex. Used to fingerprint inputs in exported specs. */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
