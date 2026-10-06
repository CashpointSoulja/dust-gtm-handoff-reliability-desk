# Walkthrough video: source script (final cut)

**Status:** final cut. Desk scenes are a live recording of the running Desk. Scene **s08** shows four actual native preview captures of the Dust agent GTMHandoffBrief, captured in Ayo's workspace. They are shown as stills under an orange "NATIVE DUST UI CAPTURE · GTMHandoffBrief preview · captured in Ayo's workspace · Actual native preview capture, shown as a still. Not recreated." banner, with no added motion. Each still has its own voiceover clip and caption and stays on screen until that caption ends; the two refusal stills are each held for at least 4.5 s (missing evidence 6.6 s, ownership conflict 4.5 s). In **s09** the real native reply for the same packet (`pkt-100102-5139c008`, [normal.json](../evidence/native-replies/normal.json)) is pasted into the Desk, which labels it "pasted response · provenance not verified" and accepts it. Only the invented-source negative control is a fixture, and it is labelled as one.

**Format:** vertical 1080×1920, 30 fps, H.264 + AAC 48 kHz, 160.9 s. The Desk is recorded at 540×960 CSS px and scaled to 1080×1920. Visible cursor ring that shrinks on click; restrained zooms on row errors, refusals, packet, provenance label, write log and cohort table.

**Credits:** concept by Ayo Ahmed. Independent concept, not affiliated with Dust. All data synthetic; CRM writes and reads simulated.

**Pipeline (local, free):** `docs/video/scenes.json` (voiceover + subtitle text) → Piper TTS, voice `en_GB-alba-medium` → `scripts/record-walkthrough.mjs` (drives the real UI, holds each scene for its voiceover, captures DevTools screencast frames) → `scripts/build-video.py` (final mode: `NATIVE_DIR` holds the native stills made by `scripts/native-cards.py`; 30 fps, voice at recorded scene starts, sentence-level burned-in subtitles, [`walkthrough.srt`](walkthrough.srt), metadata stripped except title and artist).

## Scenes (start times from the actual recording)

| Scene | Starts | Title | VO length | Voiceover / subtitle text |
|---|---|---|---|---|
| s01 |    0.2s | Intro | 13.21s | This is GTM Handoff Reliability Desk, an independent concept by Ayo Ahmed. It is not affiliated with Dust. Every record is synthetic, and every CRM write and read is simulated in this browser. |
| s02 |   14.3s | Wrong file | 6.16s | First, a file with the wrong header. The import is refused, and nothing reaches the queue. |
| s03 |   21.2s | Sample import | 13.65s | Now the synthetic export. 19 rows. One row has a bad email and a timestamp with no offset, so it is rejected by row and column. Deduplicating by stable ID leaves 15 records, and 7 packets are ready. |
| s04 |   35.1s | Queue | 11.0s | The queue shows why each record stopped. Rows 3 and 17 share a record ID, so they merge. Two leads with the same name but different IDs stay separate. |
| s05 |   46.3s | Refusals | 8.4s | A lead from Brazil has no territory rule, so it is refused, not guessed. Conflicting owners go to a person, and the current owner is kept. |
| s06 |   54.9s | Missing evidence | 8.44s | This handoff has no confirmed budget and no champion. It cannot advance, the missing fields are listed, and approval is disabled. |
| s07 |   63.7s | Normal packet | 8.44s | A clean UK handoff exports a source-backed packet for the native Dust agent, GTMHandoffBrief. The email is reduced to its domain. |
| s08 |   72.4s | Native Dust: GTMHandoffBrief | 27.28s | Next, the real native agent, GTMHandoffBrief, in Ayo's Dust workspace. These are actual native preview captures, shown as stills. For the clean packet, it drafts a brief for the routed owner. Every context line cites a source from the packet. For the missing evidence packet, it refuses, and lists both missing fields: budget confirmed and champion. For the ownership conflict, it refuses too, and drafts nothing. |
| s09 |  100.0s | Real reply, validated in the Desk | 19.16s | Back in the desk, the real reply is pasted in. It is labelled pasted, provenance not verified, because no adapter is connected. The desk checks it against the same packet, and it passes with zero errors. As a negative control, a labelled fixture with an invented source is rejected, naming the rule it broke. |
| s10 |  120.0s | Approve and write | 14.2s | A person approves, and their name and time are recorded. The simulated HubSpot write then sets the owner and creates one task under an idempotency key. Replaying the approval and the write changes nothing: the log shows two no-op replays. |
| s11 |  135.7s | Fresh read | 4.04s | A simulated fresh read confirms the owner, and exactly one task. |
| s12 |  140.6s | Cohorts | 11.06s | Finally, reporting. Overall conversion rises from 17.5% to 30.75%, yet every source fell. It is a mix shift, so no impact is claimed. |
| s13 |  152.5s | Close | 7.2s | Every decision exports as a spec and a regression case that replays exactly. Concept by Ayo Ahmed. |

## Exact click sequence

1. Load page (state cleared). Point at the Dust logo and the non-affiliation banner.
2. Import CSV: type a CSV with header `id,name,owner` → **Validate & import** → "Import refused."
3. **Load synthetic sample** → **Validate & import** → stats 19 / 1 / 15 / 7, row 14 errors.
4. **Open handoff queue** → row 100103 ("rows 3+17"), rows 100110 / 100111 (same name, separate).
5. Row 100105 "Refused: unknown territory"; row 100108 owner mismatch, owner `o-na-2` kept.
6. **Open** 100106 → "Cannot advance. Missing or stale: budget_confirmed, champion"; approval button disabled.
7. Record picker → 100102 → packet JSON (`email_domain`) → **Copy packet**.
8. *(s08: native stills, no clicks: normal draft, citations, missing evidence refused, ownership conflict refused.)*
9. Click **Agent response JSON**, paste the native reply → **Validate pasted response** → "pasted response · provenance not verified", draft accepted → **Fixture: invented source** (labelled fixture, rejected `unknown_source_id`) → paste native reply again → **Validate pasted response**.
10. **Continue to human approval** → approver "Ayo Ahmed" → tick review → **Approve handoff** → **Run simulated write** → **Replay approval + write** (two `noop_replay`).
11. **Simulated fresh read & verify** → Verified.
12. **SLA & cohorts** → cohort table 70/400 → 123/400, "Mix shift, not improvement."
13. **Spec & regression** → **Run regression** → PASS.
