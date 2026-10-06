// Desk state machine: import → classify → (human approval) → simulated CRM write → simulated fresh read → verified.
// Every write and read here is SIMULATED and deterministic; nothing leaves the browser.
import type { Lead, RowError } from "./types";
import { importCsv } from "./csv";
import { classify } from "./pipeline";
import { POLICY_VERSION, SIM_CLOCK, ownerById } from "./policy";
import { parseIsoInstant } from "./time";

export interface CrmTask { task_id: string; idempotency_key: string; subject: string; owner_id: string; due_at: string }
export interface CrmRecord { record_id: string; hubspot_owner_id: string; tasks: CrmTask[]; version: number }

export interface WriteEntry {
  seq: number; at: string; record_id: string; idempotency_key: string;
  op: "update_contact.hubspot_owner_id" | "create_task";
  result: "applied" | "unchanged" | "noop_replay"; detail: string;
}

export interface DeskEvent { seq: number; at: string; type: string; record_id: string | null; actor: string; payload: Record<string, unknown> }

export interface Approval { record_id: string; idempotency_key: string; approver: string; at: string; owner_id: string }

export interface Verification { record_id: string; at: string; ok: boolean; checks: { name: string; ok: boolean; detail: string }[]; read: CrmRecord }

export interface DeskState {
  clock: string; policy_version: string; csv_name: string; csv_text: string;
  header_error: string | null; row_errors: RowError[]; total_rows: number; valid_rows: number;
  leads: Lead[]; crm: Record<string, CrmRecord>; approvals: Approval[]; writes: WriteEntry[];
  verifications: Verification[]; events: DeskEvent[]; seq: number;
}

function stamp(s: DeskState): string {
  s.seq++;
  return new Date(parseIsoInstant(s.clock)! + s.seq * 1000).toISOString();
}

function emit(s: DeskState, type: string, record_id: string | null, actor: string, payload: Record<string, unknown> = {}): void {
  const at = stamp(s);
  s.events.push({ seq: s.seq, at, type, record_id, actor, payload });
}

export function createDesk(csvText: string, csvName = "import.csv", clock = SIM_CLOCK): DeskState {
  const imp = importCsv(csvText);
  const leads = imp.headerError ? [] : classify(imp.rows, clock);
  const s: DeskState = {
    clock, policy_version: POLICY_VERSION, csv_name: csvName, csv_text: csvText, header_error: imp.headerError,
    row_errors: imp.errors, total_rows: imp.totalDataRows, valid_rows: imp.rows.length, leads, crm: {}, approvals: [], writes: [],
    verifications: [], events: [], seq: 0,
  };
  for (const l of leads) s.crm[l.record_id] = { record_id: l.record_id, hubspot_owner_id: l.current_owner_id, tasks: [], version: 1 };
  emit(s, "csv_imported", null, "operator", { file: csvName, total_rows: imp.totalDataRows, valid_rows: imp.rows.length, row_errors: imp.errors.length, header_error: imp.headerError });
  for (const l of leads) emit(s, "lead_classified", l.record_id, "desk", { state: l.state, reasons: l.reasons.map((r) => r.code), rule_id: l.rule_id });
  return s;
}

export const idempotencyKey = (l: Lead) => `${l.record_id}:${l.routed_owner_id}:${POLICY_VERSION}`;
const clone = (s: DeskState): DeskState => structuredClone(s);
const find = (s: DeskState, id: string) => s.leads.find((l) => l.record_id === id);

export type ActionResult = { ok: true; status: string; message: string } | { ok: false; status: "refused"; message: string };

export function approve(prev: DeskState, record_id: string, approver: string): { state: DeskState; result: ActionResult } {
  const s = clone(prev);
  const l = find(s, record_id);
  if (!l) return { state: prev, result: { ok: false, status: "refused", message: `Unknown record_id ${record_id}.` } };
  const name = approver.trim();
  if (!name) return { state: prev, result: { ok: false, status: "refused", message: "Approval needs the approver's name." } };
  const key = idempotencyKey(l);
  if (s.approvals.some((a) => a.idempotency_key === key)) {
    emit(s, "approval_duplicate_ignored", record_id, name, { idempotency_key: key });
    return { state: s, result: { ok: true, status: "duplicate_ignored", message: `Already approved under key ${key}. Nothing new was created.` } };
  }
  if (l.state !== "packet_ready") {
    emit(s, "approval_refused", record_id, name, { state: l.state });
    return { state: s, result: { ok: false, status: "refused", message: `Only packet_ready handoffs can be approved; this one is ${l.state}.` } };
  }
  const at = stamp(s);
  s.approvals.push({ record_id, idempotency_key: key, approver: name, at, owner_id: l.routed_owner_id! });
  l.state = "approved";
  s.events.push({ seq: s.seq, at, type: "handoff_approved", record_id, actor: name, payload: { idempotency_key: key, owner_id: l.routed_owner_id } });
  return { state: s, result: { ok: true, status: "approved", message: `Approved by ${name}. Key ${key}.` } };
}

/** SIMULATED HubSpot write. Safe to call repeatedly: the idempotency key makes replays no-ops. */
export function simulatedWrite(prev: DeskState, record_id: string): { state: DeskState; result: ActionResult } {
  const s = clone(prev);
  const l = find(s, record_id);
  if (!l) return { state: prev, result: { ok: false, status: "refused", message: `Unknown record_id ${record_id}.` } };
  const key = idempotencyKey(l);
  const approval = s.approvals.find((a) => a.idempotency_key === key);
  if (!approval) {
    emit(s, "write_refused", record_id, "desk", { reason: "no_approval" });
    return { state: s, result: { ok: false, status: "refused", message: "No human approval on record for this key. Nothing was written." } };
  }
  const rec = s.crm[record_id];
  const owner = ownerById(approval.owner_id)!;
  const entry = (op: WriteEntry["op"], result: WriteEntry["result"], detail: string) => {
    const at = stamp(s);
    s.writes.push({ seq: s.seq, at, record_id, idempotency_key: key, op, result, detail });
    s.events.push({ seq: s.seq, at, type: "simulated_write", record_id, actor: "desk", payload: { op, result, idempotency_key: key } });
  };
  const replay = s.writes.some((w) => w.idempotency_key === key);
  if (replay) {
    entry("update_contact.hubspot_owner_id", "noop_replay", "Key already applied; owner left as is.");
    entry("create_task", "noop_replay", "Key already applied; no second task.");
    return { state: s, result: { ok: true, status: "noop_replay", message: `Replay of ${key}: no duplicate assignment or task.` } };
  }
  if (rec.hubspot_owner_id === owner.id) entry("update_contact.hubspot_owner_id", "unchanged", `Owner already ${owner.id}.`);
  else {
    const from = rec.hubspot_owner_id || "blank";
    rec.hubspot_owner_id = owner.id;
    rec.version++;
    entry("update_contact.hubspot_owner_id", "applied", `${from} → ${owner.id} (${owner.name}).`);
  }
  rec.tasks.push({ task_id: `task-${record_id}-1`, idempotency_key: key, subject: `First touch: ${l.data.first_name} ${l.data.last_name} (${l.data.company})`, owner_id: owner.id, due_at: l.sla?.due_at ?? "" });
  rec.version++;
  entry("create_task", "applied", `task-${record_id}-1 for ${owner.id}, due ${l.sla?.due_at ?? "n/a"}.`);
  l.state = "written";
  return { state: s, result: { ok: true, status: "written", message: `Simulated write applied under ${key}.` } };
}

/** SIMULATED fresh read of the CRM record, then explicit checks against the approved intent. */
export function verify(prev: DeskState, record_id: string): { state: DeskState; result: ActionResult } {
  const s = clone(prev);
  const l = find(s, record_id);
  if (!l) return { state: prev, result: { ok: false, status: "refused", message: `Unknown record_id ${record_id}.` } };
  const key = idempotencyKey(l);
  const approval = s.approvals.find((a) => a.idempotency_key === key);
  if (!approval || !s.writes.some((w) => w.idempotency_key === key)) {
    return { state: prev, result: { ok: false, status: "refused", message: "Nothing to verify: no approved write for this record." } };
  }
  const read = structuredClone(s.crm[record_id]);
  const tasks = read.tasks.filter((t) => t.idempotency_key === key);
  const checks = [
    { name: "owner matches approval", ok: read.hubspot_owner_id === approval.owner_id, detail: `read ${read.hubspot_owner_id || "blank"}, expected ${approval.owner_id}` },
    { name: "exactly one first-touch task", ok: tasks.length === 1, detail: `${tasks.length} task(s) with key ${key}` },
    { name: "task owned by new owner", ok: tasks.every((t) => t.owner_id === approval.owner_id), detail: tasks.map((t) => t.owner_id).join(", ") || "none" },
  ];
  const ok = checks.every((c) => c.ok);
  const at = stamp(s);
  s.verifications.push({ record_id, at, ok, checks, read });
  l.state = ok ? "verified" : "verification_failed";
  s.events.push({ seq: s.seq, at, type: ok ? "handoff_verified" : "verification_failed", record_id, actor: "desk", payload: { checks: checks.map((c) => [c.name, c.ok]) } });
  return { state: s, result: { ok: true, status: l.state, message: ok ? "Fresh read matches the approved change." : "Fresh read does not match. Escalate." } };
}

/** Test hook: simulate an out-of-band change in the CRM between write and fresh read. */
export function tamperCrm(prev: DeskState, record_id: string, owner_id: string): DeskState {
  const s = clone(prev);
  s.crm[record_id].hubspot_owner_id = owner_id;
  s.crm[record_id].version++;
  emit(s, "simulated_out_of_band_change", record_id, "test", { owner_id });
  return s;
}
