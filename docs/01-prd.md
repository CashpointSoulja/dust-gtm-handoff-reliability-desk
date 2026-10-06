# PRD: GTM Handoff Reliability Desk

> Independent concept by Ayo Ahmed. Not affiliated with Dust. Synthetic data; simulated CRM writes and reads.

## Problem

Qualified leads (SQLs) reach the handoff queue duplicated, under-qualified, ambiguously owned or late. Each failure is small. Together they make two things hard to trust: **who owns a lead right now**, and **whether conversion is really improving**.

Hypothesis (not validated with users): most handoff failures come from four causes the Desk can make explicit: (1) duplicates resolved by name instead of a stable ID, (2) owners assigned by habit instead of a written rule, (3) qualification evidence missing or stale at handoff time, and (4) reporting that mixes segments and hides denominators.

## Context

Dust already offers a HubSpot integration with read and write actions, and publishes customer stories about GTM teams running CRM-connected agents (see [research ledger](23-research-ledger.md)). This concept does not add a platform capability. It shows **how a RevOps owner could run that capability safely**: deterministic rules decide routing, an agent drafts the brief, a person approves, and the write is idempotent and verified.

## Users

- **RevOps owner** (primary): owns routing policy, data quality and reporting.
- **SDR / qualifier**: hands off and needs to know why something was refused.
- **AE (receiving owner)**: needs a short, sourced brief and a clear SLA.
- **GTM leadership**: reads conversion and SLA reports.

See [personas and JTBD](04-jtbd-personas.md). Personas are hypotheses.

## Goals

1. No handoff advances without a stable ID, an explicit routing rule and fresh evidence.
2. Ownership is never changed by the Desk or the agent without a person's approval.
3. Replaying an approval or a write never creates a second assignment or task.
4. Every reported rate shows numerator and denominator, and mix shift is called out.
5. Any batch can be re-run and must reproduce the same decisions.

## Non-goals

Real CRM integration, sending outbound, lead scoring with a model, territory planning, compensation, forecasting.

## Main loop (implemented)

```text
CSV import → row validation → stable-ID dedupe / conflict detection → territory × segment routing
→ evidence gate → source-backed packet → (GTMHandoffBrief draft, optional) → human approval
→ idempotent simulated HubSpot write → simulated fresh read + verification → SLA / cohort report
→ reproducible spec + regression case
```

## Requirements and where they are proven

| Requirement | Behaviour | Test |
| --- | --- | --- |
| Dedupe by stable ID only | Same `record_id` merges; same name or same email across IDs never merges | `pipeline.test.ts` |
| Missing owner routed by rule | `R-<territory>-<segment>` rule picks the owner | `pipeline.test.ts` |
| Unknown territory refused | `refused_unknown_territory`, no owner, no SLA clock | `pipeline.test.ts`, e2e |
| Conflicting ownership | `conflict_review` / `ownership_review`, current owner untouched | `pipeline.test.ts`, e2e |
| Stale / incomplete evidence | `blocked_evidence`, missing fields listed | `pipeline.test.ts`, e2e |
| Idempotent approval / write | Second approval ignored, replayed write is `noop_replay` | `desk.test.ts`, e2e |
| Timezone / SLA edges | Business hours in owner timezone, DST, weekends | `time.test.ts` |
| Mix-shift counterexample | Overall +13.25 pp while each segment falls | `cohort.test.ts`, e2e |
| Agent contract | Response validated for JSON, source IDs, owner, refusal | `dust.test.ts`, `agent-assets.test.ts` |

## Success measures (for a real pilot; none measured here)

- Share of SQLs with an owner within SLA (n = SQLs with a started clock).
- Share of handoffs refused for evidence, by source (n = SQLs imported).
- Duplicate assignments created per 1,000 writes (target 0).
- Reassignments without approval (target 0).

## Open questions

- What is the real SLA, and does it differ by segment?
- Which system is the source of truth for qualification evidence?
- Who approves: the SDR manager, the AE, or RevOps?
