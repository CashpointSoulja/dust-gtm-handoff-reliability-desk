# User stories and acceptance criteria

1. **Import with row errors.** As RevOps, when I import a CSV, rows with invalid email, timestamps without offsets, unknown owners or bad sources are listed by row and column and are not imported. *Accept:* sample shows 2 errors on row 14; 18 of 19 rows imported.
2. **Refuse an empty or wrong file.** *Accept:* empty input shows "Paste or choose a CSV first."; a file missing columns shows "Import refused" and no queue forms.
3. **Stable-ID dedupe.** *Accept:* rows 3 and 17 (same `record_id`, identical) merge into one record; 100110 and 100111 (same name and company, different ID) stay separate with a note.
4. **Route a qualified lead with no owner.** *Accept:* 100101 (FR, 120 employees) → `R-FR-SMBMM` → `o-fr-1`.
5. **Refuse unknown territory.** *Accept:* 100105 (BR) → `refused_unknown_territory`, no owner, no SLA.
6. **Send conflicting ownership to a person.** *Accept:* 100104 (two rows, two owners) → `conflict_review`; 100108 (owner `o-na-2`, policy says `o-na-1`) → `ownership_review`; current owner unchanged.
7. **Block stale or missing evidence.** *Accept:* 100106 lists `budget_confirmed`, `champion`; 100107 lists stale `evidence_captured_at` (46 days).
8. **Export a packet and inspect the agent's reply.** *Accept:* packet shows email domain only; fixture replies are labelled "deterministic fixture; Dust adapter unconnected"; invented source IDs and owner changes are rejected.
9. **Approve once.** *Accept:* approval needs a name and a review tick; a second approval is ignored.
10. **Write idempotently and verify.** *Accept:* replay produces two `noop_replay` entries; record has 1 task, 1 approval; fresh read passes 3 checks.
11. **See SLA and cohorts with denominators.** *Accept:* SLA denominator "7 of 15"; cohort shows 70/400 → 123/400 overall while each source falls.
12. **Reproduce a batch.** *Accept:* exported regression case passes; changing BR → FR fails with a 100105 diff.
13. **Keyboard use.** *Accept:* skip link, Tab to navigation, Enter navigates and moves focus to the main region.
