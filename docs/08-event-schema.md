# Event schema

Every state change appends an event. The log is exported as NDJSON from *Spec & regression*.

```json
{ "seq": 18, "at": "2026-10-05T15:00:18.000Z", "type": "simulated_write", "record_id": "100102", "actor": "desk",
  "payload": { "op": "update_contact.hubspot_owner_id", "result": "applied", "idempotency_key": "100102:o-uki-1:routing-2026.10-v1" } }
```

`seq` is monotonic. `at` is the simulated clock plus `seq` seconds, so logs are deterministic.

| `type` | Actor | Payload |
| --- | --- | --- |
| `csv_imported` | operator | file, total_rows, valid_rows, row_errors, header_error |
| `lead_classified` | desk | state, reasons[], rule_id |
| `handoff_approved` | approver name | idempotency_key, owner_id |
| `approval_duplicate_ignored` | approver name | idempotency_key |
| `approval_refused` | approver name | state |
| `write_refused` | desk | reason (`no_approval`) |
| `simulated_write` | desk | op, result (`applied` / `unchanged` / `noop_replay`), idempotency_key |
| `handoff_verified` / `verification_failed` | desk | checks[] |
| `simulated_out_of_band_change` | test | owner_id (test hook only) |

Agent responses are not events: inspecting a draft changes nothing.
