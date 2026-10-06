// Conversion arithmetic with explicit denominators, and a mix-shift (Simpson's paradox) check.
import type { Lead } from "./types";

export interface Rate { n: number; k: number; rate: number | null }
export const rate = (k: number, n: number): Rate => ({ n, k, rate: n === 0 ? null : k / n });

export interface CohortCell { cohort: string; segment: string; leads: number; converted: number }

export interface SegmentCompare { segment: string; base: Rate; comp: Rate; delta_pp: number | null; base_share: number; comp_share: number }
export interface CohortComparison {
  base: string; comp: string; overall_base: Rate; overall_comp: Rate; overall_delta_pp: number | null;
  segments: SegmentCompare[]; mix_adjusted_comp: Rate; mix_adjusted_delta_pp: number | null;
  simpson: boolean; verdict: string;
}

const pp = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((b - a) * 10000) / 100);

export function compareCohorts(cells: CohortCell[], base: string, comp: string): CohortComparison {
  for (const c of cells) {
    if (!Number.isInteger(c.leads) || !Number.isInteger(c.converted) || c.leads < 0 || c.converted < 0 || c.converted > c.leads)
      throw new Error(`Invalid cell ${c.cohort}/${c.segment}: converted must be an integer in [0, leads].`);
  }
  const segs = [...new Set(cells.map((c) => c.segment))].sort();
  const get = (co: string, s: string) => cells.find((c) => c.cohort === co && c.segment === s) ?? { cohort: co, segment: s, leads: 0, converted: 0 };
  const sum = (co: string, f: "leads" | "converted") => cells.filter((c) => c.cohort === co).reduce((a, c) => a + c[f], 0);
  const nb = sum(base, "leads"), nc = sum(comp, "leads");
  const overall_base = rate(sum(base, "converted"), nb);
  const overall_comp = rate(sum(comp, "converted"), nc);
  const segments = segs.map((s): SegmentCompare => {
    const b = get(base, s), c = get(comp, s);
    const br = rate(b.converted, b.leads), cr = rate(c.converted, c.leads);
    return { segment: s, base: br, comp: cr, delta_pp: pp(br.rate, cr.rate), base_share: nb ? b.leads / nb : 0, comp_share: nc ? c.leads / nc : 0 };
  });
  // Comparison-period segment rates re-weighted to the base period's mix.
  let adjK = 0;
  for (const s of segments) adjK += (s.comp.rate ?? 0) * s.base_share * nb;
  const mix_adjusted_comp = rate(Math.round(adjK * 100) / 100, nb);
  const overall_delta_pp = pp(overall_base.rate, overall_comp.rate);
  const mix_adjusted_delta_pp = pp(overall_base.rate, mix_adjusted_comp.rate);
  const comparable = segments.filter((s) => s.delta_pp !== null);
  const simpson = overall_delta_pp !== null && overall_delta_pp > 0 && comparable.length > 0 && comparable.every((s) => (s.delta_pp as number) <= 0);
  const verdict = simpson
    ? "Overall conversion rose only because the mix shifted toward a higher-converting segment. Within every segment conversion did not improve. No impact is claimed."
    : overall_delta_pp === null ? "Not enough data to compare." : "Overall and within-segment movements agree in direction; still not evidence of causal impact without a controlled comparison.";
  return { base, comp, overall_base, overall_comp, overall_delta_pp, segments, mix_adjusted_comp, mix_adjusted_delta_pp, simpson, verdict };
}

export interface SlaBucket { key: string; denominator: number; met: number; breached: number; overdue: number; open: number }

/** SLA counts over handoffs that have an SLA clock (state packet_ready or later). Denominator is stated per bucket. */
export function slaReport(leads: Lead[], by: (l: Lead) => string): SlaBucket[] {
  const m = new Map<string, SlaBucket>();
  for (const l of leads) {
    if (!l.sla) continue;
    const k = by(l);
    const b = m.get(k) ?? { key: k, denominator: 0, met: 0, breached: 0, overdue: 0, open: 0 };
    b.denominator++;
    b[l.sla.status]++;
    m.set(k, b);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function stateCounts(leads: Lead[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of leads) out[l.state] = (out[l.state] ?? 0) + 1;
  return out;
}
