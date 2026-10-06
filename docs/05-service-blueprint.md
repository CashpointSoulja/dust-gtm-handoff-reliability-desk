# Service blueprint

| Stage | Customer / lead | Frontstage (SDR, AE) | Backstage (Desk rules) | Support systems | Failure point → Desk response |
| --- | --- | --- | --- | --- | --- |
| Qualify | Talks to SDR | SDR records pain, budget, champion, timeline | none | CRM note (`evidence_source_id`) | Fields missing → listed at import |
| Export | none | RevOps exports SQL CSV | Row validation | CSV | Bad email / timestamp → row error, row skipped |
| Dedupe | none | none | Group by `record_id` only | none | Same name or email, different ID → review, never merged |
| Route | none | none | Country → territory, employees → segment, rule → owner | Policy `routing-2026.10-v1` | Unknown country → refused; owner mismatch → review |
| Evidence gate | none | none | Required fields + 14-day freshness | none | Stale or future → blocked |
| Brief | none | AE reads draft | Packet export; response validation | Native Dust agent GTMHandoffBrief | Invented source, owner change → response rejected |
| Approve | none | Approver ticks review, names self | Idempotency key `record:owner:policy` | none | Duplicate approval → ignored |
| Write | none | none | Simulated `update_contact`, `create_task` | Simulated HubSpot | Replay → `noop_replay` |
| Verify | none | none | Simulated fresh read, 3 checks | Simulated HubSpot | Mismatch → `verification_failed`, escalate |
| First touch | Gets contacted | AE sends (outside the Desk) | SLA clock in owner timezone | Calendar | Overdue → flagged |
| Report | none | Leadership reads | SLA by segment/territory, cohort mix check | none | Mix shift → warning, no impact claimed |
