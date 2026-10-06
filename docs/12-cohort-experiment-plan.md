# Cohort and experiment plan

## The counterexample (synthetic)

| Source | Q2 | Q3 |
| --- | --- | --- |
| inbound_demo | 40 / 100 = 40% | 114 / 300 = 38% |
| outbound | 30 / 300 = 10% | 9 / 100 = 9% |
| **Overall** | **70 / 400 = 17.5%** | **123 / 400 = 30.75%** |
| Q3 at Q2 mix | | 65 / 400 = 16.25% |

Overall conversion rose 13.25 pp. Both sources fell (−2 pp, −1 pp). The change is mix: inbound went from 25% to 75% of SQLs. Anyone reading only the overall line would credit the handoff process for a change it did not cause.

## How a real evaluation should run

1. **Unit:** SQL, cohorted by `qualified_at` week.
2. **Primary metric:** SLA met rate (k = first touch ≤ due, n = SQLs with started clock), per segment.
3. **Secondary:** SQL → opportunity within 30 days, per segment and mix-adjusted.
4. **Guardrails:** unapproved reassignments = 0; duplicate tasks = 0; evidence-block rate by source (a spike means the gate is too strict or SDR notes are missing).
5. **Design:** stepped rollout by territory (see [rollout](21-rollout-rollback.md)). Compare treated vs not-yet-treated territories in the same weeks, within segment.
6. **Minimum sample:** decide before starting. With roughly 100 SQLs per territory per week, a 10 pp SLA change is detectable in about 4 weeks; a 2 pp conversion change is not, so do not claim one.
7. **Stopping rule:** stop a territory if unapproved reassignments > 0 or verification failures > 1%.

No experiment has been run. No impact is claimed.
