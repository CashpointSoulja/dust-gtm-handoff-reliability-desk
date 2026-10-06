# Architecture

```text
Browser (static site, strict CSP, connect-src 'none')
├── src/ui/main.ts        renderer, controls, localStorage persistence
└── src/engine/
    ├── csv.ts            parse + row validation + FNV-1a fingerprint
    ├── policy.ts         territories, segments, owners, rules, evidence, SLA constants
    ├── time.ts           Intl-based timezone maths, business-minute SLA
    ├── pipeline.ts       stable-ID dedupe, classification, evidence gate, SLA
    ├── desk.ts           state machine: approve → simulated write → simulated fresh read
    ├── dust.ts           packet export, response validation, deterministic fixtures
    ├── cohort.ts         rates with denominators, mix-adjusted comparison, SLA buckets
    ├── spec.ts           reproducible spec, regression case export + replay
    └── sample.ts         synthetic CSV and cohort counts

Native Dust agent GTMHandoffBrief (separate, operated in Dust)
    ◄── packet pasted by operator          ──► JSON reply pasted back by operator
```

## Decisions

- **Static and client-only.** No server, no secrets, nothing to breach. Pages hosting is enough. The CSP blocks all network calls (`connect-src 'none'`), so the Desk cannot call Dust or HubSpot even by mistake.
- **Deterministic engine.** Routing, evidence and SLA are rules, not a model. The agent only drafts text, and the Desk validates the draft.
- **Platform generation separate from approval and write.** The agent's reply is inspected in one panel; approval and the simulated write are in another and do not depend on the reply.
- **Idempotency key = record + owner + policy version.** A policy change cannot replay an old approval.
- **Simulated clock** (`2026-10-05T15:00:00Z`, Monday 17:00 Paris) so every run produces the same SLA results.
- **Simulated CRM** is an in-memory map that starts from the imported owners. Every write and read is labelled SIMULATED in the UI and export.
