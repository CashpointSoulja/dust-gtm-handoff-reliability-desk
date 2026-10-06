# API / connector specification (for a real deployment; not implemented)

The Desk ships with a simulated CRM. This is how a real HubSpot connection would plug in without changing the engine.

## Interface

```ts
interface CrmPort {
  readContact(recordId: string): Promise<{ owner_id: string; version: string }>;
  setOwner(recordId: string, ownerId: string, idempotencyKey: string): Promise<"applied" | "unchanged">;
  createTask(recordId: string, task: { subject: string; owner_id: string; due_at: string }, idempotencyKey: string): Promise<"applied" | "noop_replay">;
  listTasks(recordId: string): Promise<{ task_id: string; idempotency_key: string; owner_id: string }[]>;
}
```

## Mapping to HubSpot (public CRM concepts)

| Port call | HubSpot concept | Notes |
| --- | --- | --- |
| `readContact` | Contact read incl. `hubspot_owner_id` | Fresh read after write; never from cache |
| `setOwner` | Contact update of `hubspot_owner_id` | Compare-before-write; skip if equal |
| `createTask` | Task create, associated to the contact | Store `idempotency_key` in a custom task property; look it up before creating |
| `listTasks` | Associations contact → tasks | Used by verification: exactly one task per key |

Dust's public HubSpot integration page lists actions of this kind (for example `get_object_by_email`, `create_task`, `create_note`, `list_associations`). In a real rollout the agent **GTMHandoffBrief** would get read-only HubSpot access; the write would remain a separate, approved step run by the Desk's connector under a service account with the narrowest scopes.

## Failure handling

- Timeouts and 5xx: retry with the same idempotency key (safe by design).
- 409 / version mismatch on owner: stop, mark `verification_failed`, escalate. Never overwrite.
- Rate limits: queue and back off; the SLA clock keeps running and the report shows it.

## Dust agent exchange

The packet and response contracts are in [`dust-agent/`](dust-agent/). The Desk does not call Dust. Until a real reply is pasted, examples are labelled **"deterministic fixture; Dust adapter unconnected"**. No private workspace IDs or URLs are stored in this repository.
