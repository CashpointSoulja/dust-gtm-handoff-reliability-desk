// Dedupe → qualification → routing → SLA. Pure and deterministic for a given (rows, clock).
import type { Lead, LeadRow, Reason, SlaInfo } from "./types";
import {
  EVIDENCE_MAX_AGE_DAYS, QUALIFIED_STAGE, REQUIRED_EVIDENCE, SLA_WORK_MINUTES, TERRITORY_BY_COUNTRY,
  businessHoursFor, ownerById, routeFor, segmentFor,
} from "./policy";
import { addBusinessMinutes, formatLocal, parseIsoInstant } from "./time";

const COMPARED: (keyof LeadRow)[] = [
  "email", "first_name", "last_name", "company", "company_domain", "country", "employees", "source", "lifecycle_stage",
  "owner_id", "qualified_at", "first_touch_at", "pain", "budget_confirmed", "champion", "timeline", "evidence_source_id", "evidence_captured_at",
];

function differingFields(rows: LeadRow[]): (keyof LeadRow)[] {
  return COMPARED.filter((k) => new Set(rows.map((r) => String(r[k]))).size > 1);
}

interface Resolved { record_id: string; rows: number[]; data: LeadRow; reasons: Reason[]; notes: Reason[]; review: "conflict_review" | null }

/** Groups rows by the stable record_id only. Names and emails never cause a merge. */
export function dedupe(rows: LeadRow[]): Resolved[] {
  const groups = new Map<string, LeadRow[]>();
  for (const r of rows) {
    const g = groups.get(r.record_id);
    if (g) g.push(r); else groups.set(r.record_id, [r]);
  }
  const out: Resolved[] = [];
  for (const [record_id, g] of groups) {
    const res: Resolved = { record_id, rows: g.map((r) => r.row), data: g[0], reasons: [], notes: [], review: null };
    if (g.length > 1) {
      const diff = differingFields(g);
      const rowList = g.map((r) => r.row).join(", ");
      if (diff.length === 0) {
        res.notes.push({ code: "exact_duplicate_merged", detail: `Rows ${rowList} are identical for record_id ${record_id}; kept row ${g[0].row}.` });
      } else if (diff.includes("owner_id")) {
        res.review = "conflict_review";
        res.reasons.push({ code: "ownership_conflict", detail: `Rows ${rowList} share record_id ${record_id} but name different owners (${g.map((r) => r.owner_id || "blank").join(" vs ")}). Sent to human review; no reassignment.` });
      } else {
        const stamps = g.map((r) => parseIsoInstant(r.evidence_captured_at));
        const valid = stamps.every((s): s is number => s !== null);
        const max = valid ? Math.max(...stamps) : NaN;
        const winners = valid ? g.filter((_, i) => stamps[i] === max) : [];
        if (winners.length === 1) {
          res.data = winners[0];
          res.notes.push({ code: "field_conflict_resolved", detail: `Rows ${rowList} differ on ${diff.join(", ")}; kept row ${winners[0].row} (latest evidence_captured_at).` });
        } else {
          res.review = "conflict_review";
          res.reasons.push({ code: "field_conflict_unresolved", detail: `Rows ${rowList} differ on ${diff.join(", ")} and no single row has the latest evidence timestamp.` });
        }
      }
    }
    out.push(res);
  }
  return out;
}

export function evidenceGaps(d: LeadRow, nowMs: number): string[] {
  const missing: string[] = [];
  for (const f of REQUIRED_EVIDENCE) if (!String(d[f]).trim()) missing.push(f);
  if (d.budget_confirmed === "no") missing.push("budget_confirmed (answered no)");
  const cap = d.evidence_captured_at ? parseIsoInstant(d.evidence_captured_at) : null;
  if (cap !== null) {
    const ageDays = (nowMs - cap) / 86400000;
    if (ageDays > EVIDENCE_MAX_AGE_DAYS) missing.push(`evidence_captured_at (stale: ${Math.floor(ageDays)} days old, max ${EVIDENCE_MAX_AGE_DAYS})`);
    if (cap > nowMs) missing.push("evidence_captured_at (in the future)");
  }
  return missing;
}

export function computeSla(qualifiedAt: string, firstTouchAt: string, ownerId: string, nowMs: number): SlaInfo | null {
  const owner = ownerById(ownerId);
  const q = parseIsoInstant(qualifiedAt);
  if (!owner || q === null) return null;
  const due = addBusinessMinutes(q, SLA_WORK_MINUTES, businessHoursFor(owner));
  const touch = firstTouchAt ? parseIsoInstant(firstTouchAt) : null;
  let status: SlaInfo["status"];
  if (touch !== null) status = touch <= due ? "met" : "breached";
  else status = nowMs > due ? "overdue" : "open";
  return {
    owner_tz: owner.tz, qualified_at: qualifiedAt, due_at: new Date(due).toISOString(), due_local: formatLocal(due, owner.tz),
    status, minutes_to_due: Math.round((due - nowMs) / 60000),
  };
}

export function classify(rows: LeadRow[], nowIso: string): Lead[] {
  const nowMs = parseIsoInstant(nowIso)!;
  const resolved = dedupe(rows);

  const byEmail = new Map<string, string[]>();
  for (const r of resolved) byEmail.set(r.data.email, [...(byEmail.get(r.data.email) ?? []), r.record_id]);
  const byName = new Map<string, Resolved[]>();
  for (const r of resolved) {
    const k = `${r.data.first_name}|${r.data.last_name}|${r.data.company}`.toLowerCase();
    byName.set(k, [...(byName.get(k) ?? []), r]);
  }

  return resolved.map((r): Lead => {
    const d = r.data;
    const territory = TERRITORY_BY_COUNTRY[d.country] ?? null;
    const segment = segmentFor(d.employees);
    const reasons = [...r.reasons];
    const notes = [...r.notes];
    const missing = evidenceGaps(d, nowMs);
    let state: Lead["state"] | null = r.review;

    const sameEmail = (byEmail.get(d.email) ?? []).filter((id) => id !== r.record_id);
    if (sameEmail.length) {
      reasons.push({ code: "email_collision", detail: `Email ${d.email} also appears on record_id ${sameEmail.join(", ")}. Not merged: identity is the stable record_id; a human must confirm.` });
      state ??= "duplicate_review";
    }
    const sameName = (byName.get(`${d.first_name}|${d.last_name}|${d.company}`.toLowerCase()) ?? []).filter((x) => x.record_id !== r.record_id && x.data.email !== d.email);
    if (sameName.length) notes.push({ code: "name_match_not_merged", detail: `Same name and company as record_id ${sameName.map((x) => x.record_id).join(", ")}, different stable id and email. Not merged.` });

    let routed: string | null = null;
    let rule: string | null = null;
    if (territory) {
      const rr = routeFor(territory, segment);
      if (rr) { routed = rr.owner_id; rule = rr.rule_id; }
    }

    if (!state && d.lifecycle_stage !== QUALIFIED_STAGE) {
      state = "not_qualified";
      reasons.push({ code: "not_sql", detail: `lifecycle_stage is "${d.lifecycle_stage}", not "${QUALIFIED_STAGE}". Not a handoff.` });
    }
    if (!state && !territory) {
      state = "refused_unknown_territory";
      reasons.push({ code: "unknown_territory", detail: `Country "${d.country}" has no territory in ${"routing policy"}. Refused: no owner is guessed.` });
    }
    if (!state && missing.length) {
      state = "blocked_evidence";
      reasons.push({ code: "evidence_incomplete", detail: `Cannot advance until fixed: ${missing.join("; ")}.` });
    }
    if (!state && d.owner_id && routed && d.owner_id !== routed) {
      state = "ownership_review";
      reasons.push({ code: "owner_mismatch", rule: rule ?? undefined, detail: `CRM owner ${d.owner_id} differs from rule ${rule} → ${routed}. Human review; the Desk will not reassign.` });
    }
    if (!state) {
      state = "packet_ready";
      reasons.push(d.owner_id
        ? { code: "owner_confirmed", rule: rule ?? undefined, detail: `Existing owner ${d.owner_id} matches rule ${rule}.` }
        : { code: "routed", rule: rule ?? undefined, detail: `${territory} × ${segment} → rule ${rule} → ${routed}.` });
    }

    const sla = state === "packet_ready" && routed ? computeSla(d.qualified_at, d.first_touch_at, routed, nowMs) : null;
    return {
      record_id: r.record_id, rows: r.rows, data: d, territory, segment, state, reasons, notes, missing_fields: missing,
      current_owner_id: d.owner_id, routed_owner_id: routed, rule_id: rule, sla,
    };
  });
}
