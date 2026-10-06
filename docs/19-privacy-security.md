# Privacy and security

- **No real personal data.** All names and companies are fictional; domains use `.example`.
- **Data minimisation in the packet.** The agent gets the email **domain**, not the address. Only evidence fields needed for the brief are included.
- **No network.** CSP `connect-src 'none'`; scripts and styles only from the same origin; no inline script; `form-action 'none'`; `referrer: no-referrer`.
- **No secrets.** There are none to store. The repository contains no tokens, workspace IDs or private URLs.
- **Output escaping.** All rendered values are HTML-escaped; pasted JSON is parsed, never evaluated.
- **Local storage.** State stays in the browser and is cleared by *Reset desk*.
- **Production needs:** SSO, role-checked approvals, audit log in a write-once store, service account with least-privilege HubSpot scopes, retention policy for packets, DPA review for agent processing.
