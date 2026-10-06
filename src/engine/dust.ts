// Export contract for the native Dust agent "GTMHandoffBrief", and validation of whatever comes back.
// The Desk never calls Dust. A response is either pasted by the operator or a deterministic fixture.
import type { Lead } from "./types";
import { POLICY_VERSION, ownerById } from "./policy";
import { fnv1a } from "./csv";

export const PACKET_CONTRACT = "gtm-handoff-packet/1";
export const BRIEF_CONTRACT = "gtm-handoff-brief/1";
export const FIXTURE_LABEL = "deterministic fixture; Dust adapter unconnected";

export type PacketStatus = "ready" | "missing_evidence" | "ownership_conflict" | "unknown_territory" | "duplicate_review" | "not_qualified";
export interface EvidenceItem { source_id: string; field: string; value: string; captured_at: string | null }

export interface HandoffPacket {
  contract_version: typeof PACKET_CONTRACT; packet_id: string; policy_version: string; generated_at: string;
  packet_status: PacketStatus;
  lead: { record_id: string; contact_name: string; email_domain: string; company: string; company_domain: string; country: string; territory: string | null; segment: string; source: string; qualified_at: string };
  routing: { rule_id: string | null; routed_owner_id: string | null; routed_owner_name: string | null; current_owner_id: string | null; decision: string };
  sla: { due_at: string; due_local: string; status: string } | null;
  evidence: EvidenceItem[]; missing_fields: string[]; conflicts: string[];
  instructions: string[];
}

export function packetStatusFor(l: Lead): PacketStatus {
  switch (l.state) {
    case "blocked_evidence": return "missing_evidence";
    case "ownership_review": case "conflict_review": return "ownership_conflict";
    case "refused_unknown_territory": return "unknown_territory";
    case "duplicate_review": return "duplicate_review";
    case "not_qualified": return "not_qualified";
    default: return "ready";
  }
}

export function buildPacket(l: Lead, clock: string): HandoffPacket {
  const d = l.data;
  const cap = d.evidence_captured_at || null;
  const ev: EvidenceItem[] = [
    { source_id: `crm:contact:${d.record_id}`, field: "contact", value: `${d.first_name} ${d.last_name}, ${d.company} (${d.country}, ${d.employees} employees, source ${d.source})`, captured_at: d.qualified_at },
  ];
  if (d.evidence_source_id) {
    const note = `note:${d.evidence_source_id}`;
    for (const f of ["pain", "budget_confirmed", "champion", "timeline"] as const) if (d[f]) ev.push({ source_id: note, field: f, value: d[f], captured_at: cap });
  }
  if (l.rule_id) ev.push({ source_id: `policy:${l.rule_id}`, field: "routing_rule", value: `${l.territory} × ${l.segment} → ${l.routed_owner_id}`, captured_at: null });
  const status = packetStatusFor(l);
  const owner = l.routed_owner_id ? ownerById(l.routed_owner_id) : undefined;
  const body = {
    contract_version: PACKET_CONTRACT, policy_version: POLICY_VERSION, generated_at: clock, packet_status: status,
    lead: { record_id: d.record_id, contact_name: `${d.first_name} ${d.last_name}`, email_domain: d.email.split("@")[1] ?? "", company: d.company, company_domain: d.company_domain, country: d.country, territory: l.territory, segment: l.segment, source: d.source, qualified_at: d.qualified_at },
    routing: { rule_id: l.rule_id, routed_owner_id: l.routed_owner_id, routed_owner_name: owner?.name ?? null, current_owner_id: l.current_owner_id || null, decision: l.reasons.map((r) => r.detail).join(" ") },
    sla: l.sla ? { due_at: l.sla.due_at, due_local: l.sla.due_local, status: l.sla.status } : null,
    evidence: ev, missing_fields: l.missing_fields, conflicts: l.reasons.filter((r) => /conflict|mismatch|collision/.test(r.code)).map((r) => r.detail),
    instructions: [
      "Draft only. Do not send messages, change owners, or create CRM records.",
      'If packet_status is not "ready", return outcome "refused" with refusal_reason equal to packet_status and list missing_fields.',
      "Cite only source_id values that appear in evidence. Do not invent facts.",
      "brief.owner_id must equal routing.routed_owner_id.",
    ],
  };
  const packet_id = `pkt-${d.record_id}-${fnv1a(JSON.stringify(body))}`;
  return { ...body, packet_id } as HandoffPacket;
}

export interface BriefContext { text: string; source_ids: string[] }
export interface BriefResponse {
  contract_version: string; packet_id: string; outcome: "draft" | "refused";
  refusal_reason: PacketStatus | "insufficient_context" | null; missing_fields: string[];
  brief: { headline: string; owner_id: string; context: BriefContext[]; suggested_first_touch: string; open_questions: string[] } | null;
  cited_source_ids: string[];
}

export interface ValidationIssue { code: string; message: string }
export interface ValidationResult {
  accepted: boolean; outcome: "draft" | "refused" | null; errors: ValidationIssue[]; warnings: ValidationIssue[];
  provenance: "fixture" | "pasted"; provenance_label: string; response: BriefResponse | null;
}

const TOP_KEYS = ["contract_version", "packet_id", "outcome", "refusal_reason", "missing_fields", "brief", "cited_source_ids"];
const BRIEF_KEYS = ["headline", "owner_id", "context", "suggested_first_touch", "open_questions"];
const REASONS = ["missing_evidence", "ownership_conflict", "unknown_territory", "duplicate_review", "not_qualified", "insufficient_context"];
const isStrArr = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === "string");

export function validateResponse(packet: HandoffPacket, text: string, provenance: "fixture" | "pasted"): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const label = provenance === "fixture" ? FIXTURE_LABEL : "pasted response: provenance not verified by the Desk";
  const fail = (): ValidationResult => ({ accepted: false, outcome: null, errors, warnings, provenance, provenance_label: label, response: null });
  if (!text.trim()) { errors.push({ code: "empty", message: "Paste the agent's JSON response first." }); return fail(); }
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { errors.push({ code: "json_parse", message: `Not valid JSON: ${(e as Error).message}` }); return fail(); }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) { errors.push({ code: "not_object", message: "Top level must be a JSON object." }); return fail(); }
  const o = raw as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!TOP_KEYS.includes(k)) errors.push({ code: "unknown_key", message: `Unexpected field "${k}". The contract allows only ${TOP_KEYS.join(", ")}.` });
  for (const k of TOP_KEYS) if (!(k in o)) errors.push({ code: "missing_key", message: `Missing field "${k}".` });
  if (errors.length) return fail();
  if (o.contract_version !== BRIEF_CONTRACT) errors.push({ code: "contract_version", message: `contract_version must be "${BRIEF_CONTRACT}".` });
  if (o.packet_id !== packet.packet_id) errors.push({ code: "packet_mismatch", message: `packet_id ${String(o.packet_id)} does not match exported packet ${packet.packet_id}.` });
  if (o.outcome !== "draft" && o.outcome !== "refused") errors.push({ code: "outcome", message: 'outcome must be "draft" or "refused".' });
  if (!(o.refusal_reason === null || (typeof o.refusal_reason === "string" && REASONS.includes(o.refusal_reason)))) errors.push({ code: "refusal_reason", message: `refusal_reason must be null or one of ${REASONS.join(", ")}.` });
  if (!isStrArr(o.missing_fields)) errors.push({ code: "missing_fields_type", message: "missing_fields must be an array of strings." });
  if (!isStrArr(o.cited_source_ids)) errors.push({ code: "cited_type", message: "cited_source_ids must be an array of strings." });
  if (errors.length) return fail();
  const r = o as unknown as BriefResponse;
  const known = new Set(packet.evidence.map((e) => e.source_id));
  for (const id of r.cited_source_ids) if (!known.has(id)) errors.push({ code: "unknown_source_id", message: `Cited source_id "${id}" is not in the packet's evidence.` });

  if (r.outcome === "refused") {
    if (r.brief !== null) errors.push({ code: "brief_on_refusal", message: "A refusal must have brief: null." });
    if (r.refusal_reason === null) errors.push({ code: "refusal_reason_missing", message: "A refusal needs a refusal_reason." });
    if (packet.packet_status !== "ready" && r.refusal_reason !== packet.packet_status) errors.push({ code: "refusal_reason_mismatch", message: `Packet status is ${packet.packet_status}; refusal_reason was ${String(r.refusal_reason)}.` });
    if (packet.packet_status === "missing_evidence") {
      const lacking = packet.missing_fields.filter((f) => !r.missing_fields.includes(f));
      if (lacking.length) errors.push({ code: "missing_fields_incomplete", message: `Refusal must list every missing field; absent: ${lacking.join("; ")}.` });
    }
    if (packet.packet_status === "ready") warnings.push({ code: "refused_ready_packet", message: "The agent refused a ready packet. A human decides; approval is still available." });
  } else if (r.outcome === "draft") {
    if (packet.packet_status !== "ready") errors.push({ code: "draft_on_blocked_packet", message: `Packet status is ${packet.packet_status}: the agent must refuse, not draft.` });
    if (r.refusal_reason !== null) errors.push({ code: "reason_on_draft", message: "A draft must have refusal_reason: null." });
    const b = r.brief as unknown;
    if (typeof b !== "object" || b === null) errors.push({ code: "brief_missing", message: "A draft needs a brief object." });
    else {
      const bo = b as Record<string, unknown>;
      for (const k of Object.keys(bo)) if (!BRIEF_KEYS.includes(k)) errors.push({ code: "unknown_brief_key", message: `Unexpected brief field "${k}".` });
      for (const k of BRIEF_KEYS) if (!(k in bo)) errors.push({ code: "missing_brief_key", message: `brief.${k} is missing.` });
      if (typeof bo.headline !== "string" || !bo.headline.trim() || bo.headline.length > 200) errors.push({ code: "headline", message: "brief.headline must be 1–200 characters." });
      if (typeof bo.suggested_first_touch !== "string" || bo.suggested_first_touch.length > 1200) errors.push({ code: "first_touch", message: "brief.suggested_first_touch must be a string up to 1200 characters." });
      if (!isStrArr(bo.open_questions)) errors.push({ code: "open_questions", message: "brief.open_questions must be an array of strings." });
      if (bo.owner_id !== packet.routing.routed_owner_id) errors.push({ code: "owner_change", message: `brief.owner_id ${String(bo.owner_id)} differs from routed owner ${packet.routing.routed_owner_id}. The agent may not change ownership.` });
      if (!Array.isArray(bo.context) || bo.context.length === 0) errors.push({ code: "context", message: "brief.context needs at least one cited bullet." });
      else for (const [i, c] of (bo.context as unknown[]).entries()) {
        const cc = c as Record<string, unknown>;
        if (typeof cc?.text !== "string" || !isStrArr(cc?.source_ids) || cc.source_ids.length === 0) { errors.push({ code: "context_item", message: `brief.context[${i}] needs text and at least one source_id.` }); continue; }
        for (const id of cc.source_ids) {
          if (!known.has(id)) errors.push({ code: "unknown_source_id", message: `brief.context[${i}] cites unknown source_id "${id}".` });
          else if (!r.cited_source_ids.includes(id)) errors.push({ code: "uncited_source", message: `brief.context[${i}] uses "${id}" but cited_source_ids omits it.` });
        }
      }
    }
  }
  const accepted = errors.length === 0;
  return { accepted, outcome: accepted ? r.outcome : null, errors, warnings, provenance, provenance_label: label, response: accepted ? r : null };
}

/** Deterministic stand-in for the native agent's answer. Always labelled FIXTURE_LABEL in the UI. */
export function fixtureResponse(p: HandoffPacket, variant: "faithful" | "invented_source" | "owner_change" = "faithful"): BriefResponse {
  if (p.packet_status !== "ready" && variant === "faithful") {
    return { contract_version: BRIEF_CONTRACT, packet_id: p.packet_id, outcome: "refused", refusal_reason: p.packet_status, missing_fields: [...p.missing_fields], brief: null, cited_source_ids: [`crm:contact:${p.lead.record_id}`] };
  }
  const by = (f: string) => p.evidence.find((e) => e.field === f);
  const ctx: BriefContext[] = [];
  for (const f of ["pain", "champion", "timeline", "budget_confirmed"]) {
    const e = by(f);
    if (e) ctx.push({ text: `${f.replace("_", " ")}: ${e.value}`, source_ids: [e.source_id] });
  }
  const rule = p.evidence.find((e) => e.field === "routing_rule");
  if (rule) ctx.push({ text: `Routed by ${p.routing.rule_id}: ${rule.value}`, source_ids: [rule.source_id] });
  if (variant === "invented_source") ctx.push({ text: "Recently raised a Series C", source_ids: ["web:news-0000"] });
  const cited = [...new Set(ctx.flatMap((c) => c.source_ids))];
  return {
    contract_version: BRIEF_CONTRACT, packet_id: p.packet_id, outcome: "draft", refusal_reason: null, missing_fields: [],
    brief: {
      headline: `${p.lead.company}: ${p.lead.segment} ${p.lead.territory} handoff to ${p.routing.routed_owner_name}`,
      owner_id: variant === "owner_change" ? "o-uki-2" : (p.routing.routed_owner_id ?? ""),
      context: ctx,
      suggested_first_touch: `Draft for ${p.routing.routed_owner_name} to review: reference the stated pain${by("pain") ? ` ("${by("pain")!.value}")` : ""} and confirm the timeline before proposing a call.`,
      open_questions: ["Who else joins the evaluation?", "Which systems hold the knowledge today?"],
    },
    cited_source_ids: cited,
  };
}
