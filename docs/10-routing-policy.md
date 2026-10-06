# Routing policy `routing-2026.10-v1`

All owners are fictional.

## Territory

| Countries | Territory |
| --- | --- |
| FR, BE, LU, MC | EMEA-FR |
| GB, IE | EMEA-UKI |
| DE, AT, CH | DACH |
| SE, NO, DK, FI | NORDICS |
| US, CA | NA |
| anything else | **refused** (no guess) |

## Segment

`employees < 200` → SMB · `200–999` → MM · `≥ 1000` → ENT.

## Rules

| Rule | Territory | Segments | Owner | Timezone |
| --- | --- | --- | --- | --- |
| R-FR-SMBMM | EMEA-FR | SMB, MM | o-fr-1 Margaux Lefèvre | Europe/Paris |
| R-FR-ENT | EMEA-FR | ENT | o-fr-2 Julien Bernard | Europe/Paris |
| R-UKI-SMBMM | EMEA-UKI | SMB, MM | o-uki-1 Priya Nair | Europe/London |
| R-UKI-ENT | EMEA-UKI | ENT | o-uki-2 Tom Ellis | Europe/London |
| R-DACH-SMBMM | DACH | SMB, MM | o-dach-1 Lena Fischer | Europe/Berlin |
| R-DACH-ENT | DACH | ENT | o-dach-2 Felix Braun | Europe/Berlin |
| R-NOR-ALL | NORDICS | all | o-nor-1 Astrid Lund | Europe/Stockholm |
| R-NA-SMBMM | NA | SMB, MM | o-na-1 Dana Brooks | America/New_York |
| R-NA-ENT | NA | ENT | o-na-2 Marcus Hale | America/New_York |

The authoritative table is `src/engine/policy.ts`.

## Qualification

Required: `pain`, `budget_confirmed` (= yes), `champion`, `timeline`, `evidence_source_id`, `evidence_captured_at` (≤ 14 days before the clock, not after it). Lifecycle must be `salesqualifiedlead`.

## SLA

First touch within **240 working minutes** of `qualified_at`, Mon–Fri 09:00–18:00 in the **routed owner's** timezone. Weekend or after-hours qualification starts the clock at the next opening. DST is handled by recomputing the UTC offset for each local time.

## Changing the policy

Change the table, bump `POLICY_VERSION`, re-run the regression cases. A version bump changes every idempotency key, so approvals under the old policy cannot be replayed under the new one.
