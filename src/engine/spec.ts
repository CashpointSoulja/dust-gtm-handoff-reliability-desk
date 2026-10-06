// Reproducible spec + regression case export. Re-running a case must reproduce every decision exactly.
import { createDesk, type DeskState } from "./desk";
import { fnv1a } from "./csv";

export interface Decision { record_id: string; rows: number[]; state: string; reasons: string[]; routed_owner_id: string | null; rule_id: string | null; missing_fields: string[]; sla_due_at: string | null; sla_status: string | null }

export function decisionsOf(s: DeskState, stage: "classified" | "current" = "classified"): Decision[] {
  const base = stage === "classified" ? createDesk(s.csv_text, s.csv_name, s.clock) : s;
  return base.leads.map((l) => ({
    record_id: l.record_id, rows: l.rows, state: l.state, reasons: l.reasons.map((r) => r.code), routed_owner_id: l.routed_owner_id,
    rule_id: l.rule_id, missing_fields: l.missing_fields, sla_due_at: l.sla?.due_at ?? null, sla_status: l.sla?.status ?? null,
  }));
}

export interface RegressionCase {
  case_version: "gtm-handoff-regression/1"; name: string; policy_version: string; clock: string; input_sha: string; input_csv: string;
  expected: { row_errors: { row: number; column: string }[]; decisions: Decision[] };
}

export function exportRegressionCase(s: DeskState, name: string): RegressionCase {
  return {
    case_version: "gtm-handoff-regression/1", name, policy_version: s.policy_version, clock: s.clock, input_sha: fnv1a(s.csv_text), input_csv: s.csv_text,
    expected: { row_errors: s.row_errors.map((e) => ({ row: e.row, column: e.column })), decisions: decisionsOf(s) },
  };
}

export function runRegression(c: RegressionCase): { pass: boolean; diffs: string[] } {
  const diffs: string[] = [];
  if (fnv1a(c.input_csv) !== c.input_sha) diffs.push("input_sha does not match input_csv");
  const s = createDesk(c.input_csv, c.name, c.clock);
  if (s.policy_version !== c.policy_version) diffs.push(`policy_version ${s.policy_version} ≠ ${c.policy_version}`);
  const got = JSON.stringify(s.row_errors.map((e) => ({ row: e.row, column: e.column })));
  if (got !== JSON.stringify(c.expected.row_errors)) diffs.push("row_errors differ");
  const now = decisionsOf(s);
  const exp = new Map(c.expected.decisions.map((d) => [d.record_id, d]));
  for (const d of now) {
    const e = exp.get(d.record_id);
    if (!e) { diffs.push(`${d.record_id}: unexpected record`); continue; }
    if (JSON.stringify(d) !== JSON.stringify(e)) diffs.push(`${d.record_id}: expected ${e.state}, got ${d.state}${JSON.stringify(d.reasons) !== JSON.stringify(e.reasons) ? ` (reasons ${d.reasons.join(",")})` : ""}`);
    exp.delete(d.record_id);
  }
  for (const id of exp.keys()) diffs.push(`${id}: missing from run`);
  return { pass: diffs.length === 0, diffs };
}

export function exportSpec(s: DeskState) {
  return {
    spec_version: "gtm-handoff-spec/1", generated_at: s.clock, policy_version: s.policy_version, input: { file: s.csv_name, sha: fnv1a(s.csv_text), total_rows: s.total_rows, valid_rows: s.valid_rows },
    row_errors: s.row_errors, decisions: decisionsOf(s, "current"),
    approvals: s.approvals, simulated_writes: s.writes, verifications: s.verifications.map((v) => ({ record_id: v.record_id, at: v.at, ok: v.ok, checks: v.checks })),
    events: s.events, note: "All writes and reads are SIMULATED. Synthetic data only.",
  };
}
