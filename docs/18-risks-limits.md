# Risks and limitations

## Limitations (honest)

- **Synthetic data only.** 19 fictional rows, fictional owners, `.example` domains. Synthetic cohort counts.
- **Simulated CRM and clock.** No HubSpot or Dust account is connected. Writes and fresh reads are in-memory and labelled.
- **No native agent result yet.** Fixture replies are labelled "deterministic fixture; Dust adapter unconnected".
- **Single browser, no auth.** State is in `localStorage`. The approver name is self-declared.
- **Personas and pain are hypotheses.** No interviews, no measured impact.
- **Policy is small**: 5 territories, 3 segments, 9 rules; no round-robin, capacity or holidays.
- **SLA ignores public holidays.**
- **Review states have no in-app resolution**: fix the source and re-import.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Evidence gate too strict, stalls real handoffs | Medium | High | Report block rate by source; adjust policy with versioned change |
| People bypass the Desk and assign in the CRM | Medium | High | Verification + report of unapproved owner changes |
| Agent invents context | Medium | Medium | Source-ID validation; draft only |
| Policy drift between doc and code | Low | Medium | Code is source of truth; regression cases |
| Mix-shift misread by leadership | High | Medium | Mix-adjusted rate shown next to overall |
| Fixture mistaken for live output | Low | High | Label on every fixture; tests assert the label |
