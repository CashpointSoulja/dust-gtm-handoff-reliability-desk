# Permission model

| Actor | Can | Cannot |
| --- | --- | --- |
| **GTMHandoffBrief** (native Dust agent) | Read the pasted packet; in production, read-only HubSpot | Send messages, change owners, create tasks, approve |
| **Operator** (RevOps) | Import, export packets, paste replies, approve, run simulated write and verify | Approve a record that is not `packet_ready`; write without approval |
| **Desk engine** | Classify, refuse, write under an approved key, verify | Resolve ownership conflicts, merge by name or email, change policy |
| **Policy owner** | Change `policy.ts`, bump version, update regression cases | (process) Change policy without re-running regression |

In this concept there is no authentication: whoever opens the page is the operator. The approval records the name typed. A real deployment needs SSO and a role check on approval (see [privacy & security](19-privacy-security.md)).
