import { describe, expect, it } from "vitest";
import { createDesk } from "../src/engine/desk";
import { SAMPLE_CSV } from "../src/engine/sample";
import { CSV_COLUMNS } from "../src/engine/types";

const desk = createDesk(SAMPLE_CSV);
const lead = (id: string) => desk.leads.find((l) => l.record_id === id)!;

function csvOf(rows: Record<string, string>[]): string {
  const base: Record<string, string> = { record_id: "", email: "", first_name: "A", last_name: "B", company: "Co", company_domain: "co.example", country: "FR", employees: "50", source: "inbound_demo", lifecycle_stage: "salesqualifiedlead", owner_id: "", qualified_at: "2026-10-05T10:00:00+02:00", first_touch_at: "", pain: "p", budget_confirmed: "yes", champion: "c", timeline: "t", evidence_source_id: "n-1", evidence_captured_at: "2026-10-05T09:00:00+02:00" };
  return [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((c) => ({ ...base, ...r })[c]).join(","))].join("\n");
}

describe("sample batch decisions", () => {
  it("produces the expected state for every record", () => {
    expect(Object.fromEntries(desk.leads.map((l) => [l.record_id, l.state]))).toEqual({
      "100101": "packet_ready", "100102": "packet_ready", "100103": "packet_ready", "100104": "conflict_review",
      "100105": "refused_unknown_territory", "100106": "blocked_evidence", "100107": "blocked_evidence", "100108": "ownership_review",
      "100109": "not_qualified", "100110": "packet_ready", "100111": "packet_ready", "100112": "duplicate_review", "100113": "duplicate_review",
      "100115": "packet_ready", "100116": "packet_ready",
    });
  });
  it("merges exact replays by stable record_id", () => {
    expect(lead("100103").rows).toEqual([3, 17]);
    expect(lead("100103").notes[0].code).toBe("exact_duplicate_merged");
  });
  it("never merges by name alone", () => {
    expect(lead("100110").state).toBe("packet_ready");
    expect(lead("100111").state).toBe("packet_ready");
    expect(lead("100110").notes.map((n) => n.code)).toContain("name_match_not_merged");
  });
  it("sends a shared email across different ids to review without merging", () => {
    expect(lead("100112").rows).toEqual([12]);
    expect(lead("100113").reasons[0].code).toBe("email_collision");
  });
  it("resolves non-owner field conflicts by latest evidence, with provenance", () => {
    expect(lead("100116").data.timeline).toBe("Q1 2027");
    expect(lead("100116").notes[0].detail).toMatch(/kept row 19/);
  });
  it("conflicting owners on one record go to human review with no reassignment", () => {
    expect(lead("100104").reasons[0].code).toBe("ownership_conflict");
    expect(desk.crm["100104"].hubspot_owner_id).toBe("o-uki-1");
  });
  it("existing owner that disagrees with policy is reviewed, not reassigned", () => {
    expect(lead("100108").current_owner_id).toBe("o-na-2");
    expect(lead("100108").routed_owner_id).toBe("o-na-1");
    expect(lead("100108").state).toBe("ownership_review");
  });
  it("routes a qualified lead with no owner by explicit territory × segment rule", () => {
    expect(lead("100101")).toMatchObject({ territory: "EMEA-FR", segment: "SMB", rule_id: "R-FR-SMBMM", routed_owner_id: "o-fr-1" });
    expect(lead("100103")).toMatchObject({ territory: "DACH", segment: "ENT", rule_id: "R-DACH-ENT", routed_owner_id: "o-dach-2" });
  });
  it("refuses unknown territory without guessing an owner", () => {
    expect(lead("100105").routed_owner_id).toBeNull();
    expect(lead("100105").sla).toBeNull();
  });
  it("lists missing and stale evidence fields", () => {
    expect(lead("100106").missing_fields).toEqual(["budget_confirmed", "champion"]);
    expect(lead("100107").missing_fields[0]).toMatch(/^evidence_captured_at \(stale: 46 days/);
  });
  it("computes SLA status at the simulated clock in the owner's timezone", () => {
    expect(lead("100101").sla).toMatchObject({ status: "overdue", due_at: "2026-10-05T10:30:00.000Z", owner_tz: "Europe/Paris" });
    expect(lead("100102").sla?.status).toBe("met");
    expect(lead("100115").sla).toMatchObject({ status: "open", minutes_to_due: 45, owner_tz: "America/New_York" });
    expect(lead("100116").sla?.status).toBe("met");
  });
});

describe("edge rules", () => {
  it("budget answered no blocks advancement", () => {
    const d = createDesk(csvOf([{ record_id: "300001", email: "a@x.example", budget_confirmed: "no" }]));
    expect(d.leads[0].state).toBe("blocked_evidence");
    expect(d.leads[0].missing_fields).toContain("budget_confirmed (answered no)");
  });
  it("evidence exactly 14 days old is accepted; 14 days + 1 minute is stale", () => {
    const ok = createDesk(csvOf([{ record_id: "300002", email: "b@x.example", evidence_captured_at: "2026-09-21T15:00:00Z" }]));
    const stale = createDesk(csvOf([{ record_id: "300003", email: "c@x.example", evidence_captured_at: "2026-09-21T14:59:00Z" }]));
    expect(ok.leads[0].state).toBe("packet_ready");
    expect(stale.leads[0].state).toBe("blocked_evidence");
  });
  it("blank owner on one row and an owner on another is an ownership conflict", () => {
    const d = createDesk(csvOf([{ record_id: "300004", email: "d@x.example" }, { record_id: "300004", email: "d@x.example", owner_id: "o-fr-1" }]));
    expect(d.leads[0].state).toBe("conflict_review");
  });
  it("segment boundaries: 199 SMB, 200 MM, 999 MM, 1000 ENT", () => {
    const d = createDesk(csvOf(["199", "200", "999", "1000"].map((e, i) => ({ record_id: `30010${i}`, email: `e${i}@x.example`, employees: e }))));
    expect(d.leads.map((l) => l.segment)).toEqual(["SMB", "MM", "MM", "ENT"]);
  });
});
