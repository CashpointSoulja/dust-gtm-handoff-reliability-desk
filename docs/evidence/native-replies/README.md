# Native GTMHandoffBrief replies (captured in Ayo's workspace)

The native Dust agent GTMHandoffBrief (preview, in Ayo's workspace) was run on Ayo's behalf on the three eval packets from [`../../dust-agent/evals.json`](../../dust-agent/evals.json). The replies below are the actual native preview captures, stored exactly as captured. The Desk cannot verify where a pasted reply came from, so it labels them "pasted response · provenance not verified".

| Eval | Record | Packet | File | Desk validator |
|---|---|---|---|---|
| normal | 100102 | `pkt-100102-5139c008` | [normal.json](normal.json) | accepted, outcome `draft`, 0 errors, 0 warnings |
| missing evidence | 100106 | `pkt-100106-d75d9a89` | [missing.json](missing.json) | accepted, outcome `refused` (`missing_evidence`: `budget_confirmed`, `champion`), 0 errors |
| ownership conflict | 100108 | `pkt-100108-f40534bf` | [conflict.json](conflict.json) | accepted, outcome `refused` (`ownership_conflict`), 0 errors |

[`validation.txt`](validation.txt) is the raw output of running `validateResponse` from `src/engine/dust.ts` on each file against the packet the Desk builds for that record. The check through the Desk UI, run on Ayo's behalf, reported the same three passes.

The agent's reply is a draft only. Approval, the simulated CRM write and verification stay in the Desk with a named human approver. The native preview screenshots used in the walkthrough video are not kept in this repository.
