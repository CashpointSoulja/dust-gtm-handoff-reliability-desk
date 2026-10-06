# Metric definitions and denominators

Every rate is shown as `k / n (rate)`. A rate with n = 0 is shown as "n/a", never 0%.

| Metric | Numerator (k) | Denominator (n) | Notes |
| --- | --- | --- | --- |
| Import acceptance | valid rows | data rows in file | Header errors refuse the whole file |
| Dedupe ratio | records | valid rows | Merges only by `record_id` |
| Packet-ready rate | `packet_ready` records | deduplicated records | Shown as "7 packets ready of 15" |
| SLA overdue + breached | overdue + breached | handoffs with an SLA clock | Only `packet_ready` and later have a clock |
| SLA met | first touch ≤ due | handoffs with an SLA clock | |
| Evidence block rate | `blocked_evidence` | deduplicated SQL records | By source in a real pilot |
| Duplicate writes | applied writes beyond first per key | idempotency keys written | Target 0 |
| Unapproved reassignments | owner changes without approval | owner changes | Target 0, enforced in code |
| SQL → opportunity | converted | SQLs in cohort | Always shown by segment and mix-adjusted |

## SLA status

- `met`: first touch at or before due.
- `breached`: first touch after due.
- `overdue`: no first touch, due before the clock.
- `open`: no first touch, due after the clock.

## Mix-adjusted rate

Comparison-period segment rates weighted by base-period segment shares. If overall rises while every comparable segment is flat or falling, the report says "Mix shift, not improvement" and claims no impact.
