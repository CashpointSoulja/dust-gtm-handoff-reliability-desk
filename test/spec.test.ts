import { describe, expect, it } from "vitest";
import { createDesk } from "../src/engine/desk";
import { SAMPLE_CSV } from "../src/engine/sample";
import { exportRegressionCase, exportSpec, runRegression } from "../src/engine/spec";

describe("reproducible spec and regression case", () => {
  const s = createDesk(SAMPLE_CSV, "sample.csv");
  it("a regression case exported now passes when re-run", () => {
    expect(runRegression(exportRegressionCase(s, "sample"))).toEqual({ pass: true, diffs: [] });
  });
  it("detects a changed input", () => {
    const c = exportRegressionCase(s, "sample");
    const r = runRegression({ ...c, input_csv: c.input_csv.replace("100105,lucas.moreau@ateliersul.example", "100105,lucas.moreau@ateliersul.example").replace(",BR,", ",FR,") });
    expect(r.pass).toBe(false);
    expect(r.diffs.join("\n")).toMatch(/input_sha/);
    expect(r.diffs.join("\n")).toMatch(/100105: expected refused_unknown_territory, got packet_ready/);
  });
  it("spec export is labelled simulated and stable", () => {
    expect(exportSpec(s).note).toMatch(/SIMULATED/);
    expect(JSON.stringify(exportSpec(s))).toBe(JSON.stringify(exportSpec(createDesk(SAMPLE_CSV, "sample.csv"))));
  });
});
