# Walkthrough video: source script (Desk segment, review draft)

**Status:** review draft of the Desk portion. Scene **s08** is a neutral "scene reserved" card. It will be replaced by real footage of the native Dust agent GTMHandoffBrief in Ayo's workspace once that footage is supplied. Nothing in s08 is recorded or recreated, and no fixture is shown as native output.

**Format:** vertical 1080×1920, 30 fps, H.264 + AAC, 135.4 s. Continuous live recording of the running Desk at 540×960 CSS px with 2× device scale. Visible cursor ring that shrinks on click; restrained zooms on row errors, refusals, packet, write log and cohort table.

**Credits:** concept by Ayo Ahmed. Independent concept, not affiliated with Dust. All data synthetic; CRM writes and reads simulated.

**Pipeline (local, free):** `docs/video/scenes.json` (voiceover + subtitle text) → Piper TTS, voice `en_GB-alba-medium` → `scripts/record-walkthrough.mjs` (drives the real UI, holds each scene for its voiceover, captures DevTools screencast frames) → `scripts/build-video.py` (30 fps, voice at recorded scene starts, sentence-level burned-in subtitles, [`walkthrough-draft.srt`](walkthrough-draft.srt), metadata stripped except title and artist).

## Scenes (start times from the actual recording)

| Scene | Starts | Title | VO length | Voiceover / subtitle text |
|---|---|---|---|---|
| s01 |   0.2s | Intro | 13.21s | This is GTM Handoff Reliability Desk, an independent concept by Ayo Ahmed. It is not affiliated with Dust. Every record is synthetic, and every CRM write and read is simulated in this browser. |
| s02 |  14.3s | Wrong file | 6.16s | First, a file with the wrong header. The import is refused, and nothing reaches the queue. |
| s03 |  21.2s | Sample import | 13.65s | Now the synthetic export. 19 rows. One row has a bad email and a timestamp with no offset, so it is rejected by row and column. Deduplicating by stable ID leaves 15 records, and 7 packets are ready. |
| s04 |  35.1s | Queue | 11.0s | The queue shows why each record stopped. Rows 3 and 17 share a record ID, so they merge. Two leads with the same name but different IDs stay separate. |
| s05 |  46.3s | Refusals | 8.4s | A lead from Brazil has no territory rule, so it is refused, not guessed. Conflicting owners go to a person, and the current owner is kept. |
| s06 |  54.9s | Missing evidence | 8.44s | This handoff has no confirmed budget and no champion. It cannot advance, the missing fields are listed, and approval is disabled. |
| s07 |  63.7s | Normal packet | 8.44s | A clean UK handoff exports a source-backed packet for the native Dust agent, GTMHandoffBrief. The email is reduced to its domain. |
| s08 |  72.3s | Native Dust slot | 6.14s | Reserved for real footage of GTMHandoffBrief in Ayo's Dust workspace, to be supplied. |
| s09 |  78.8s | Inspect reply | 14.43s | Back in the desk, the reply is validated against the packet. This one is a deterministic fixture, and it is labelled that way. An invented source is rejected, and so is an owner change. Each rejection names the exact rule it broke. |
| s10 |  94.5s | Approve and write | 14.2s | A person approves, and their name and time are recorded. The simulated HubSpot write then sets the owner and creates one task under an idempotency key. Replaying the approval and the write changes nothing: the log shows two no-op replays. |
| s11 | 110.2s | Fresh read | 4.04s | A simulated fresh read confirms the owner, and exactly one task. |
| s12 | 115.1s | Cohorts | 11.06s | Finally, reporting. Overall conversion rises from 17.5% to 30.75%, yet every source fell. It is a mix shift, so no impact is claimed. |
| s13 | 127.0s | Close | 7.2s | Every decision exports as a spec and a regression case that replays exactly. Concept by Ayo Ahmed. |

## Exact click sequence

1. Load page (state cleared). Point at the Dust logo and the non-affiliation banner.
2. Import CSV: type a CSV with header `id,name,owner` → **Validate & import** → "Import refused."
3. **Load synthetic sample** → **Validate & import** → stats 19 / 1 / 15 / 7, row 14 errors.
4. **Open handoff queue** → row 100103 ("rows 3+17"), rows 100110 / 100111 (same name, separate).
5. Row 100105 "Refused: unknown territory"; row 100108 owner mismatch, owner `o-na-2` kept.
6. **Open** 100106 → "Cannot advance. Missing or stale: budget_confirmed, champion"; approval button disabled.
7. Record picker → 100102 → packet JSON (`email_domain`) → **Copy packet**.
8. *(s08 slot: native GTMHandoffBrief footage, to be supplied.)*
9. **Fixture: expected reply** (labelled "deterministic fixture; Dust adapter unconnected") → **Fixture: invented source** (rejected) → **Fixture: owner change** (rejected) → **Fixture: expected reply**. In the final cut the operator pastes the real native reply here and clicks **Validate pasted response**.
10. **Continue to human approval** → approver "Ayo Ahmed" → tick review → **Approve handoff** → **Run simulated write** → **Replay approval + write** (two `noop_replay`).
11. **Simulated fresh read & verify** → Verified.
12. **SLA & cohorts** → cohort table 70/400 → 123/400, "Mix shift, not improvement."
13. **Spec & regression** → **Run regression** → PASS.
