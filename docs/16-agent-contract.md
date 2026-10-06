# Native agent contract: GTMHandoffBrief

| File | Purpose |
| --- | --- |
| [`dust-agent/prompt.md`](dust-agent/prompt.md) | Instructions to paste into the agent |
| [`dust-agent/packet.schema.json`](dust-agent/packet.schema.json) | What the Desk exports (`gtm-handoff-packet/1`) |
| [`dust-agent/response.schema.json`](dust-agent/response.schema.json) | What the agent must return (`gtm-handoff-brief/1`) |
| [`dust-agent/evals.json`](dust-agent/evals.json) | 6 cases + 2 negative controls, with packets and reference responses |

The schemas and evals are generated from the engine and checked by `test/agent-assets.test.ts`, so they cannot drift from what the Desk validates.

## Eval cases

| Case | Record | Expected |
| --- | --- | --- |
| normal | 100102 | `draft`, cites `note:note-7002`, owner `o-uki-1` |
| missing evidence | 100106 | `refused` / `missing_evidence`, lists `budget_confirmed`, `champion` |
| stale evidence | 100107 | `refused` / `missing_evidence` |
| conflicting owner | 100108 | `refused` / `ownership_conflict` |
| conflicting owner (duplicate rows) | 100104 | `refused` / `ownership_conflict` |
| unknown territory | 100105 | `refused` / `unknown_territory` |
| negative: invented source | 100102 | Desk rejects with `unknown_source_id` |
| negative: owner change | 100102 | Desk rejects with `owner_change` |

## What the Desk checks on every reply

Valid JSON object · only contract keys · `contract_version` · `packet_id` matches · `outcome` and `refusal_reason` consistent with `packet_status` · all missing fields listed · every cited source ID exists in the packet · every context bullet cites a source that is also in `cited_source_ids` · `brief.owner_id` equals the routed owner · length limits.

## Status of real results

No native agent output is included in this repository. Reference responses are **deterministic fixtures; Dust adapter unconnected**. Real replies will be recorded separately, labelled as such, once supplied.
