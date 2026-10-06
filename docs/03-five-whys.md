# 5 Whys (hypothesis)

**Symptom:** leadership does not trust the SQL → opportunity number or the handoff queue.

1. **Why?** The queue contains duplicates, leads with no clear owner, and leads that were handed off late.
2. **Why?** Duplicates are matched by name or email by hand, owners are assigned by whoever sees the lead first, and nobody sees the SLA clock in the owner's timezone.
3. **Why?** Routing rules and qualification requirements live in people's heads or a slide, not in a versioned policy that a system checks.
4. **Why?** Writing them down forces decisions (what counts as "qualified", who owns DACH enterprise) that nobody has been asked to own.
5. **Why?** RevOps is measured on reports, not on the reliability of the handoff step itself.

**Root-cause hypothesis:** there is no explicit, versioned handoff contract. The Desk makes one (`routing-2026.10-v1`) and enforces it, so every refusal names a rule, a field or a person who must decide.
