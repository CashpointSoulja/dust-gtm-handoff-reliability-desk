# Rollout and rollback

## Rollout (for a real team)

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| 0. Shadow | Desk classifies a weekly export; nothing is written | RevOps agrees with ≥ 95% of decisions; every disagreement becomes a regression case |
| 1. One territory | EMEA-UKI, approved writes only | 2 weeks, 0 unapproved reassignments, 0 duplicate tasks, verification failures < 1% |
| 2. Agent drafts | GTMHandoffBrief on ready packets, read-only | AEs rate drafts useful on ≥ 70% (survey), 0 accepted replies with invented sources |
| 3. All territories | Stepped, one per week | Same guardrails per territory |

## Rollback

- **Policy:** revert `policy.ts` to the previous version and redeploy. Old idempotency keys stay valid for old approvals only.
- **Writes:** every applied write has a key and the previous owner in the log; restore owners from the log, delete tasks by key.
- **Agent:** remove the step; approval never depended on it.
- **Desk:** stop using it; the CRM is unchanged except for approved, logged writes.

## Kill switches

Disable writes (approve only), disable agent drafts, or freeze a territory.
