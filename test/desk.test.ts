import { describe, expect, it } from "vitest";
import { approve, createDesk, idempotencyKey, simulatedWrite, tamperCrm, verify } from "../src/engine/desk";
import { SAMPLE_CSV } from "../src/engine/sample";

const fresh = () => createDesk(SAMPLE_CSV);

describe("approval, simulated write, fresh read", () => {
  it("happy path: approve → write → verify", () => {
    let s = fresh();
    s = approve(s, "100101", "Ayo").state;
    const w = simulatedWrite(s, "100101");
    s = w.state;
    expect(w.result.status).toBe("written");
    expect(s.crm["100101"].hubspot_owner_id).toBe("o-fr-1");
    const v = verify(s, "100101");
    expect(v.result.status).toBe("verified");
    expect(v.state.verifications[0].checks.every((c) => c.ok)).toBe(true);
  });
  it("duplicate approval and write replay create no second assignment or task", () => {
    let s = fresh();
    s = approve(s, "100101", "Ayo").state;
    s = simulatedWrite(s, "100101").state;
    const a2 = approve(s, "100101", "Ayo");
    expect(a2.result.status).toBe("duplicate_ignored");
    const w2 = simulatedWrite(a2.state, "100101");
    expect(w2.result.status).toBe("noop_replay");
    s = w2.state;
    expect(s.approvals).toHaveLength(1);
    expect(s.crm["100101"].tasks).toHaveLength(1);
    expect(s.writes.filter((w) => w.result === "applied")).toHaveLength(2);
    expect(s.writes.filter((w) => w.result === "noop_replay")).toHaveLength(2);
    expect(verify(s, "100101").result.status).toBe("verified");
  });
  it("existing correct owner is left unchanged; only the task is created", () => {
    let s = approve(fresh(), "100115", "Ayo").state;
    s = simulatedWrite(s, "100115").state;
    expect(s.writes.map((w) => w.result)).toEqual(["unchanged", "applied"]);
  });
  it("refuses to write without approval", () => {
    const r = simulatedWrite(fresh(), "100101");
    expect(r.result.ok).toBe(false);
    expect(r.state.crm["100101"].tasks).toHaveLength(0);
  });
  it("refuses approval for review, blocked or refused states", () => {
    for (const id of ["100104", "100105", "100106", "100108", "100112", "100109"]) {
      const r = approve(fresh(), id, "Ayo");
      expect(r.result.ok, id).toBe(false);
      expect(r.state.approvals).toHaveLength(0);
    }
  });
  it("refuses approval with a blank approver", () => {
    expect(approve(fresh(), "100101", "  ").result.ok).toBe(false);
  });
  it("verification fails if the fresh read disagrees", () => {
    let s = approve(fresh(), "100102", "Ayo").state;
    s = simulatedWrite(s, "100102").state;
    s = tamperCrm(s, "100102", "o-uki-2");
    const v = verify(s, "100102");
    expect(v.result.status).toBe("verification_failed");
    expect(v.state.leads.find((l) => l.record_id === "100102")!.state).toBe("verification_failed");
  });
  it("idempotency key binds record, owner and policy version", () => {
    const l = fresh().leads.find((x) => x.record_id === "100101")!;
    expect(idempotencyKey(l)).toBe("100101:o-fr-1:routing-2026.10-v1");
  });
  it("is deterministic: same input and clock give identical event logs", () => {
    const run = () => { let s = approve(fresh(), "100101", "Ayo").state; s = simulatedWrite(s, "100101").state; return JSON.stringify(verify(s, "100101").state.events); };
    expect(run()).toBe(run());
  });
});
