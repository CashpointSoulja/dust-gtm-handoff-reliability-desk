import { describe, expect, it } from "vitest";
import { createDesk } from "../src/engine/desk";
import { SAMPLE_CSV } from "../src/engine/sample";
import { buildPacket, fixtureResponse, validateResponse } from "../src/engine/dust";

const s = createDesk(SAMPLE_CSV);
const pkt = (id: string) => buildPacket(s.leads.find((l) => l.record_id === id)!, s.clock);
const check = (id: string, body: unknown) => validateResponse(pkt(id), JSON.stringify(body), "fixture");

describe("export packet", () => {
  it("is deterministic and minimises personal data", () => {
    const p = pkt("100102");
    expect(pkt("100102").packet_id).toBe(p.packet_id);
    expect(JSON.stringify(p)).not.toContain("oliver.hughes@");
    expect(p.lead.email_domain).toBe("larkspur.example");
    expect(p.evidence.map((e) => e.source_id)).toEqual(["crm:contact:100102", "note:note-7002", "note:note-7002", "note:note-7002", "note:note-7002", "policy:R-UKI-SMBMM"]);
  });
  it("maps lead states to packet statuses", () => {
    expect(pkt("100102").packet_status).toBe("ready");
    expect(pkt("100106").packet_status).toBe("missing_evidence");
    expect(pkt("100108").packet_status).toBe("ownership_conflict");
    expect(pkt("100104").packet_status).toBe("ownership_conflict");
    expect(pkt("100105").packet_status).toBe("unknown_territory");
  });
});

describe("response validation", () => {
  it("accepts faithful fixtures: normal draft and refusals", () => {
    for (const id of ["100102", "100106", "100108", "100105"]) {
      const r = check(id, fixtureResponse(pkt(id)));
      expect(r.accepted, `${id}: ${JSON.stringify(r.errors)}`).toBe(true);
    }
    expect(check("100102", fixtureResponse(pkt("100102"))).outcome).toBe("draft");
    expect(check("100106", fixtureResponse(pkt("100106"))).outcome).toBe("refused");
  });
  it("labels fixtures honestly", () => {
    expect(check("100102", fixtureResponse(pkt("100102"))).provenance_label).toBe("deterministic fixture; Dust adapter unconnected");
    expect(validateResponse(pkt("100102"), "{}", "pasted").provenance_label).toMatch(/not verified/);
  });
  it("rejects invented source ids", () => {
    const r = check("100102", fixtureResponse(pkt("100102"), "invented_source"));
    expect(r.accepted).toBe(false);
    expect(r.errors.map((e) => e.code)).toContain("unknown_source_id");
  });
  it("rejects an ownership change", () => {
    const r = check("100102", fixtureResponse(pkt("100102"), "owner_change"));
    expect(r.errors.map((e) => e.code)).toContain("owner_change");
  });
  it("rejects a draft on a missing-evidence or conflicting-owner packet", () => {
    for (const id of ["100106", "100108"]) {
      const draft = { ...fixtureResponse(pkt("100102")), packet_id: pkt(id).packet_id };
      expect(check(id, draft).errors.map((e) => e.code)).toContain("draft_on_blocked_packet");
    }
  });
  it("rejects a refusal that omits missing fields or gives the wrong reason", () => {
    const base = fixtureResponse(pkt("100106"));
    expect(check("100106", { ...base, missing_fields: ["champion"] }).errors.map((e) => e.code)).toContain("missing_fields_incomplete");
    expect(check("100106", { ...base, refusal_reason: "ownership_conflict" }).errors.map((e) => e.code)).toContain("refusal_reason_mismatch");
  });
  it("rejects malformed JSON, extra keys, wrong packet and empty input", () => {
    expect(validateResponse(pkt("100102"), "{not json", "pasted").errors[0].code).toBe("json_parse");
    expect(validateResponse(pkt("100102"), "", "pasted").errors[0].code).toBe("empty");
    expect(check("100102", { ...fixtureResponse(pkt("100102")), send_email: true }).errors[0].code).toBe("unknown_key");
    expect(check("100102", { ...fixtureResponse(pkt("100102")), packet_id: "pkt-x" }).errors.map((e) => e.code)).toContain("packet_mismatch");
  });
  it("accepts a refusal of a ready packet with a warning (human decides)", () => {
    const p = pkt("100102");
    const r = check("100102", { contract_version: "gtm-handoff-brief/1", packet_id: p.packet_id, outcome: "refused", refusal_reason: "insufficient_context", missing_fields: [], brief: null, cited_source_ids: [] });
    expect(r.accepted).toBe(true);
    expect(r.warnings[0].code).toBe("refused_ready_packet");
  });
});
