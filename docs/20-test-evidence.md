# Test evidence

Actual command output from the most recent local run (Node 22, headless Chrome 137). Paths shortened to the repository root. Reproduce with the commands below; browser tests need `CHROME_PATH` and a running server (`npm run serve`).

```text
$ npm run typecheck
exit 0

$ npm test
 RUN  v5.0.3 <repo>
 Test Files  8 passed (8)
      Tests  58 passed (58)
   Start at  02:48:04
   Duration  333ms (transform 58%, import 24%, tests 16%, worker 2%)

$ npm run build
  public/app.js       59.2kb
  public/app.js.map  147.2kb
⚡ Done in 5ms

$ npm run test:e2e
PASS logo, non-affiliation label and simulated disclosure visible
PASS empty states on every view before import
PASS empty import is refused with an actionable message
PASS wrong header is refused and nothing is queued
PASS sample import: row errors listed, 19 rows → 15 records
PASS queue shows refusals and reviews
PASS missing evidence: fields listed, approval disabled, fixture refuses
PASS conflicting owner: fixture refuses with ownership_conflict, no reassignment
PASS unknown territory refused with no owner
PASS pasted response: bad JSON, invented source and owner change are rejected
PASS normal packet: fixture draft accepted, labelled, cites sources
PASS write refused before approval; approval needs review tick
PASS approve → simulated write → replay is a no-op → fresh read verified
PASS reports show denominators and the mix-shift counterexample
PASS spec/regression export downloads and regression passes
PASS state survives reload; reset clears it
PASS keyboard: Tab reaches nav, Enter activates, focus moves to main
PASS no console errors
18/18 passed

exit 0

$ npm run test:a11y
empty import: 0 violations, 22 rules passed, 0 need review
empty-input error: 0 violations, 25 rules passed, 0 need review
import result with row errors: 0 violations, 27 rules passed, 0 need review
queue: 0 violations, 25 rules passed, 1 need review
packet: missing evidence + refusal: 0 violations, 29 rules passed, 1 need review
packet: rejected response: 0 violations, 29 rules passed, 1 need review
approve/write/verify: 0 violations, 31 rules passed, 1 need review
reports: 0 violations, 24 rules passed, 0 need review
regression: 0 violations, 27 rules passed, 0 need review
focused element has visible outline: true (solid)
TOTAL axe violations: 0
exit 0
```

## What is covered

| Area | File | Tests |
| --- | --- | --- |
| CSV parsing and row validation | `test/csv.test.ts` | quoting, CRLF, empty file, missing columns, per-row errors, wrong field count, unknown owner, bad source, bad budget value |
| Domain rules | `test/pipeline.test.ts` | every sample decision, stable-ID merge, no name-only merge, email collision, field-conflict provenance, ownership conflict, owner mismatch, explicit routing, unknown territory, missing/stale evidence, budget "no", 14-day boundary to the minute, segment boundaries |
| Timestamps | `test/time.test.ts` | offset required, Paris DST either side, Friday → Monday, DST weekend, Saturday start, before-hours, exactly 18:00, New York spring-forward |
| Replay / idempotency / refusal | `test/desk.test.ts` | happy path, duplicate approval, write replay, unchanged owner, write without approval, approval of blocked states, blank approver, verification failure after out-of-band change, deterministic event log |
| Cohort arithmetic | `test/cohort.test.ts` | 70/400 → 123/400, segment deltas, mix-adjusted 65/400, no false flag, zero denominators, invalid cells, SLA denominators |
| Agent contract | `test/dust.test.ts`, `test/agent-assets.test.ts` | packet minimisation, status mapping, fixture acceptance and label, invented source, owner change, draft on blocked packet, incomplete refusal, malformed JSON, extra keys, packet mismatch; schemas/evals in sync with engine |
| Spec / regression | `test/spec.test.ts` | round-trip pass, changed input detected, stable spec |
| Browser end-to-end | `scripts/e2e.mjs` | 18 checks incl. empty states, error states, refusals, approval gating, replay, reports, downloads, reload, reset, keyboard |
| Accessibility | `scripts/a11y.mjs` | axe-core WCAG 2.0/2.1 A + AA on 9 states; focus outline |

"Need review" items from axe are checks axe cannot decide automatically (on these screens, colour contrast over the selected table row or code chips). They were not counted as passes or failures.

Screenshots from the e2e run are in [`evidence/e2e/`](evidence/e2e/).

## Not tested

Real HubSpot or Dust behaviour (not connected), screen-reader output (no assistive-technology session run), browsers other than Chrome, mobile layouts beyond the CSS breakpoint.
