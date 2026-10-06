# Data dictionary

## Import CSV (one row per SQL export line)

| Column | Type | Rule | Example |
| --- | --- | --- | --- |
| `record_id` | string | Required, 4–40 chars `[A-Za-z0-9_-]`. **The only dedupe key.** | `100102` |
| `email` | string | Valid address. Shared across IDs → review | `oliver.hughes@larkspur.example` |
| `first_name`, `last_name`, `company` | string | Required. Never used for merging | `Oliver` |
| `company_domain` | string | Required | `larkspur.example` |
| `country` | ISO-3166 alpha-2 | Two letters; maps to territory | `GB` |
| `employees` | integer ≥ 1 | Segment: <200 SMB, 200–999 MM, ≥1000 ENT | `650` |
| `source` | enum | `inbound_demo`, `outbound`, `event`, `partner` | `outbound` |
| `lifecycle_stage` | string | Must be `salesqualifiedlead` to advance | `salesqualifiedlead` |
| `owner_id` | string or blank | Blank, or a roster owner | `o-na-2` |
| `qualified_at` | ISO-8601 with offset | Required, explicit offset | `2026-10-05T09:15:00+01:00` |
| `first_touch_at` | ISO-8601 with offset or blank | SLA "met" if before due | `2026-10-05T11:02:00+01:00` |
| `pain`, `champion`, `timeline` | string | Required evidence | `Decision in November` |
| `budget_confirmed` | `yes`/`no`/blank | `no` blocks | `yes` |
| `evidence_source_id` | string | Required; cited as `note:<id>` | `note-7002` |
| `evidence_captured_at` | ISO-8601 with offset | ≤ 14 days old, not in the future | `2026-10-05T09:00:00+01:00` |

## Derived fields

| Field | Meaning |
| --- | --- |
| `territory` | `EMEA-FR`, `EMEA-UKI`, `DACH`, `NORDICS`, `NA` or null |
| `segment` | `SMB`, `MM`, `ENT` |
| `rule_id` | Routing rule applied, e.g. `R-DACH-ENT` |
| `routed_owner_id` | Owner the policy picks |
| `state` | See [state machine](09-state-machine.md) |
| `missing_fields` | Evidence fields missing, answered no, stale or in the future |
| `sla.due_at` | 240 working minutes after `qualified_at`, owner's business hours |
| `idempotency_key` | `<record_id>:<routed_owner_id>:<policy_version>` |

## Packet, response, spec

Packet: [`dust-agent/packet.schema.json`](dust-agent/packet.schema.json). Response: [`dust-agent/response.schema.json`](dust-agent/response.schema.json). Spec and regression case: `src/engine/spec.ts` (`gtm-handoff-spec/1`, `gtm-handoff-regression/1`).
