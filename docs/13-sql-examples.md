# SQL examples

Illustrative queries over a warehouse copy of the Desk's tables (`handoffs`, `handoff_events`, `cohort_sqls`). Written in ANSI SQL; not run against any real data.

## SLA by segment with denominators

```sql
SELECT segment,
       COUNT(*)                                             AS n_with_clock,
       SUM(CASE WHEN first_touch_at <= sla_due_at THEN 1 ELSE 0 END) AS met,
       SUM(CASE WHEN first_touch_at IS NULL AND sla_due_at < :clock THEN 1 ELSE 0 END) AS overdue,
       SUM(CASE WHEN first_touch_at >  sla_due_at THEN 1 ELSE 0 END) AS breached
FROM handoffs
WHERE sla_due_at IS NOT NULL
GROUP BY segment
ORDER BY segment;
```

## Duplicate writes per idempotency key (should return no rows)

```sql
SELECT idempotency_key, op, COUNT(*) AS applied
FROM handoff_events
WHERE type = 'simulated_write' AND result = 'applied'
GROUP BY idempotency_key, op
HAVING COUNT(*) > 1;
```

## Possible duplicates that must NOT be auto-merged

```sql
SELECT lower(email) AS email, COUNT(DISTINCT record_id) AS ids
FROM handoffs
GROUP BY lower(email)
HAVING COUNT(DISTINCT record_id) > 1;
```

## Overall vs within-segment vs mix-adjusted conversion

```sql
WITH seg AS (
  SELECT cohort, segment, COUNT(*) AS n, SUM(converted) AS k
  FROM cohort_sqls GROUP BY cohort, segment
), base_mix AS (
  SELECT segment, n * 1.0 / SUM(n) OVER () AS share FROM seg WHERE cohort = '2026-Q2'
)
SELECT s.cohort,
       SUM(s.k) * 1.0 / SUM(s.n)                                AS overall_rate,
       SUM(s.k * 1.0 / NULLIF(s.n, 0) * b.share)                AS rate_at_q2_mix
FROM seg s JOIN base_mix b USING (segment)
GROUP BY s.cohort;
```
