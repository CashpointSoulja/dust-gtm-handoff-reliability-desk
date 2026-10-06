import { describe, expect, it } from "vitest";
import { compareCohorts, rate, slaReport, stateCounts } from "../src/engine/cohort";
import { SAMPLE_COHORTS, SAMPLE_CSV } from "../src/engine/sample";
import { createDesk } from "../src/engine/desk";

describe("cohort arithmetic", () => {
  const c = compareCohorts(SAMPLE_COHORTS, "2026-Q2", "2026-Q3");
  it("overall rate rises from 17.5% to 30.75% with stated denominators", () => {
    expect(c.overall_base).toEqual({ n: 400, k: 70, rate: 0.175 });
    expect(c.overall_comp).toEqual({ n: 400, k: 123, rate: 0.3075 });
    expect(c.overall_delta_pp).toBe(13.25);
  });
  it("every segment falls", () => {
    expect(c.segments.map((s) => [s.segment, s.delta_pp])).toEqual([["inbound_demo", -2], ["outbound", -1]]);
  });
  it("mix-adjusted Q3 at Q2 mix is 16.25%, below Q2", () => {
    expect(c.mix_adjusted_comp.rate).toBeCloseTo(0.1625, 10);
    expect(c.mix_adjusted_delta_pp).toBe(-1.25);
    expect(c.simpson).toBe(true);
    expect(c.verdict).toMatch(/No impact is claimed/);
  });
  it("is not flagged when segments improve too", () => {
    const d = compareCohorts([{ cohort: "a", segment: "x", leads: 10, converted: 1 }, { cohort: "b", segment: "x", leads: 10, converted: 2 }], "a", "b");
    expect(d.simpson).toBe(false);
  });
  it("handles zero denominators as null rates and rejects impossible cells", () => {
    expect(rate(0, 0).rate).toBeNull();
    expect(() => compareCohorts([{ cohort: "a", segment: "x", leads: 5, converted: 6 }], "a", "b")).toThrow();
  });
});

describe("SLA report denominators", () => {
  const s = createDesk(SAMPLE_CSV);
  it("counts only handoffs with an SLA clock", () => {
    const all = slaReport(s.leads, () => "all")[0];
    expect(all).toEqual({ key: "all", denominator: 7, met: 3, breached: 0, overdue: 2, open: 2 });
  });
  it("state counts sum to deduplicated records", () => {
    const counts = stateCounts(s.leads);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(15);
  });
});
