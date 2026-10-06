// The native-agent prompt, schemas and eval cases are generated from the engine so they cannot drift.
// Regenerate with: UPDATE_AGENT_ASSETS=1 npx vitest run test/agent-assets.test.ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createDesk } from "../src/engine/desk";
import { SAMPLE_CSV } from "../src/engine/sample";
import { BRIEF_CONTRACT, PACKET_CONTRACT, buildPacket, fixtureResponse, validateResponse } from "../src/engine/dust";

const DIR = "docs/dust-agent";
const s = createDesk(SAMPLE_CSV);
const pkt = (id: string) => buildPacket(s.leads.find((l) => l.record_id === id)!, s.clock);

const responseSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: BRIEF_CONTRACT, title: "GTMHandoffBrief response",
  type: "object", additionalProperties: false,
  required: ["contract_version", "packet_id", "outcome", "refusal_reason", "missing_fields", "brief", "cited_source_ids"],
  properties: {
    contract_version: { const: BRIEF_CONTRACT },
    packet_id: { type: "string", pattern: "^pkt-" },
    outcome: { enum: ["draft", "refused"] },
    refusal_reason: { enum: [null, "missing_evidence", "ownership_conflict", "unknown_territory", "duplicate_review", "not_qualified", "insufficient_context"] },
    missing_fields: { type: "array", items: { type: "string" } },
    cited_source_ids: { type: "array", items: { type: "string" } },
    brief: {
      oneOf: [{ type: "null" }, {
        type: "object", additionalProperties: false, required: ["headline", "owner_id", "context", "suggested_first_touch", "open_questions"],
        properties: {
          headline: { type: "string", minLength: 1, maxLength: 200 }, owner_id: { type: "string" },
          context: { type: "array", minItems: 1, items: { type: "object", additionalProperties: false, required: ["text", "source_ids"], properties: { text: { type: "string" }, source_ids: { type: "array", minItems: 1, items: { type: "string" } } } } },
          suggested_first_touch: { type: "string", maxLength: 1200 }, open_questions: { type: "array", items: { type: "string" } },
        },
      }],
    },
  },
  allOf: [
    { if: { properties: { outcome: { const: "refused" } } }, then: { properties: { brief: { type: "null" }, refusal_reason: { type: "string" } } } },
    { if: { properties: { outcome: { const: "draft" } } }, then: { properties: { brief: { type: "object" }, refusal_reason: { type: "null" } } } },
  ],
  "x-semantic-rules": [
    "packet_id must equal the packet's packet_id.",
    "Every cited source_id must appear in packet.evidence[].source_id.",
    "If packet_status is not ready, outcome must be refused and refusal_reason must equal packet_status.",
    "For missing_evidence, missing_fields must include every packet.missing_fields entry.",
    "brief.owner_id must equal packet.routing.routed_owner_id.",
  ],
};

const packetSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema", $id: PACKET_CONTRACT, title: "GTM handoff packet (exported by the Desk)",
  type: "object", additionalProperties: false,
  required: ["contract_version", "packet_id", "policy_version", "generated_at", "packet_status", "lead", "routing", "sla", "evidence", "missing_fields", "conflicts", "instructions"],
  properties: {
    contract_version: { const: PACKET_CONTRACT }, packet_id: { type: "string" }, policy_version: { type: "string" }, generated_at: { type: "string", format: "date-time" },
    packet_status: { enum: ["ready", "missing_evidence", "ownership_conflict", "unknown_territory", "duplicate_review", "not_qualified"] },
    lead: { type: "object" }, routing: { type: "object" }, sla: { type: ["object", "null"] },
    evidence: { type: "array", items: { type: "object", required: ["source_id", "field", "value", "captured_at"] } },
    missing_fields: { type: "array", items: { type: "string" } }, conflicts: { type: "array", items: { type: "string" } }, instructions: { type: "array", items: { type: "string" } },
  },
};

const CASES = [
  { id: "eval-normal", record_id: "100102", expect: { outcome: "draft", refusal_reason: null, must_cite_any_of: ["note:note-7002"], owner_id: "o-uki-1" } },
  { id: "eval-missing-evidence", record_id: "100106", expect: { outcome: "refused", refusal_reason: "missing_evidence", must_list_missing: ["budget_confirmed", "champion"] } },
  { id: "eval-stale-evidence", record_id: "100107", expect: { outcome: "refused", refusal_reason: "missing_evidence" } },
  { id: "eval-conflicting-owner", record_id: "100108", expect: { outcome: "refused", refusal_reason: "ownership_conflict" } },
  { id: "eval-conflicting-owner-duplicate-rows", record_id: "100104", expect: { outcome: "refused", refusal_reason: "ownership_conflict" } },
  { id: "eval-unknown-territory", record_id: "100105", expect: { outcome: "refused", refusal_reason: "unknown_territory" } },
];
const evals = {
  eval_version: "gtm-handoff-brief-evals/1", contract: BRIEF_CONTRACT,
  how_to_run: "Paste each case's packet into GTMHandoffBrief, then paste the reply into the Desk's response panel for that record. A case passes when the Desk accepts the reply and outcome/refusal_reason match expect.",
  cases: CASES.map((c) => ({ ...c, packet: pkt(c.record_id), reference_response: fixtureResponse(pkt(c.record_id)), reference_label: "deterministic fixture; Dust adapter unconnected" })),
  negative_controls: [
    { id: "neg-invented-source", record_id: "100102", response: fixtureResponse(pkt("100102"), "invented_source"), must_reject_with: "unknown_source_id" },
    { id: "neg-owner-change", record_id: "100102", response: fixtureResponse(pkt("100102"), "owner_change"), must_reject_with: "owner_change" },
  ],
};

function sync(name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n";
  const path = `${DIR}/${name}`;
  if (process.env.UPDATE_AGENT_ASSETS) writeFileSync(path, text);
  expect(existsSync(path), `${path} missing; run with UPDATE_AGENT_ASSETS=1`).toBe(true);
  expect(readFileSync(path, "utf8")).toBe(text);
}

describe("native agent assets", () => {
  it("schemas and evals match the engine contract", () => {
    sync("response.schema.json", responseSchema);
    sync("packet.schema.json", packetSchema);
    sync("evals.json", evals);
  });
  it("reference responses pass and negative controls fail the Desk validator", () => {
    for (const c of evals.cases) {
      const r = validateResponse(c.packet, JSON.stringify(c.reference_response), "fixture");
      expect(r.accepted, c.id).toBe(true);
      expect(r.response?.outcome).toBe(c.expect.outcome);
      expect(r.response?.refusal_reason).toBe(c.expect.refusal_reason);
    }
    for (const n of evals.negative_controls) {
      const r = validateResponse(pkt(n.record_id), JSON.stringify(n.response), "fixture");
      expect(r.errors.map((e) => e.code)).toContain(n.must_reject_with);
    }
  });
  it("prompt names the contract and the hard rules", () => {
    const p = readFileSync(`${DIR}/prompt.md`, "utf8");
    for (const s of [BRIEF_CONTRACT, "refused", "source_id", "routed_owner_id", "Do not send", "missing_fields"]) expect(p).toContain(s);
  });
});
