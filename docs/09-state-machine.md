# State machine

```text
                      ┌─ not_qualified            (lifecycle ≠ SQL)
                      ├─ refused_unknown_territory (no territory rule)
import → classify ────┼─ blocked_evidence         (missing / stale / future evidence)
                      ├─ conflict_review          (same record_id, different owners)
                      ├─ ownership_review         (existing owner ≠ policy owner)
                      ├─ duplicate_review         (same email, different record_id)
                      └─ packet_ready ── approve ──► approved ── simulated write ──► written ── fresh read ──► verified
                                                                                                    └────► verification_failed
```

Order of checks: email collision → territory → route → lifecycle → evidence → ownership. The first blocking reason sets the state; all reasons are kept.

| From | Action | To | Guard |
| --- | --- | --- | --- |
| packet_ready | approve | approved | approver name present, review ticked (UI) |
| approved | simulated write | written | approval exists for the key |
| written | verify | verified / verification_failed | owner matches, exactly one task, task owner matches |
| any review / refused state | approve | unchanged | refused with reason |
| any | approve again | unchanged | `approval_duplicate_ignored` |
| written / verified | write again | unchanged | `noop_replay` × 2 |

Review states have no automatic exit. A person fixes the source data and re-imports. That is deliberate: the Desk never decides ownership disputes.
