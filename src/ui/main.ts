import { approve, createDesk, idempotencyKey, simulatedWrite, verify, type DeskState } from "../engine/desk";
import { buildPacket, fixtureResponse, validateResponse, FIXTURE_LABEL, type HandoffPacket, type ValidationResult } from "../engine/dust";
import { compareCohorts, slaReport, stateCounts } from "../engine/cohort";
import { exportRegressionCase, exportSpec, runRegression } from "../engine/spec";
import { SAMPLE_CSV, SAMPLE_FILENAME, SAMPLE_COHORTS } from "../engine/sample";
import { ownerById, POLICY_VERSION, ROUTES } from "../engine/policy";
import { formatLocal, parseIsoInstant } from "../engine/time";
import type { Lead } from "../engine/types";

type View = "import" | "queue" | "packet" | "approve" | "reports" | "export";
interface Brief { text: string; provenance: "fixture" | "pasted"; result: ValidationResult | null }
interface UI {
  view: View; desk: DeskState | null; sel: string | null; draft: string; draftName: string; importError: string | null;
  briefs: Record<string, Brief>; approver: string; reviewed: boolean; filter: string; regression: { pass: boolean; diffs: string[] } | null; regressionText: string;
}
const KEY = "gtm-handoff-desk/1";
const blank = (): UI => ({ view: "import", desk: null, sel: null, draft: "", draftName: "", importError: null, briefs: {}, approver: "", reviewed: false, filter: "all", regression: null, regressionText: "" });
let ui: UI = load();

function load(): UI {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...blank(), ...JSON.parse(raw) }; } catch { /* ignore corrupt storage */ }
  return blank();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(ui)); } catch { /* storage full or disabled */ } }

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T | null;
const pct = (r: number | null) => (r === null ? "n/a" : `${(r * 100).toFixed(2).replace(/\.?0+$/, "")}%`);
const lead = (id: string | null) => ui.desk?.leads.find((l) => l.record_id === id) ?? null;

const STATE_LABEL: Record<string, [string, string]> = {
  packet_ready: ["Packet ready", "info"], approved: ["Approved", "info"], written: ["Simulated write applied", "risk"], verified: ["Verified (simulated read)", "ok"],
  verification_failed: ["Verification failed", "bad"], conflict_review: ["Ownership conflict: human review", "bad"], ownership_review: ["Owner mismatch: human review", "bad"],
  duplicate_review: ["Duplicate email: human review", "risk"], refused_unknown_territory: ["Refused: unknown territory", "bad"], blocked_evidence: ["Blocked: evidence", "risk"], not_qualified: ["Not an SQL", "neutral"],
};
const stateChip = (s: string) => { const [t, c] = STATE_LABEL[s] ?? [s, "neutral"]; return `<span class="st ${c}">${esc(t)}</span>`; };
const SLA_CLASS: Record<string, string> = { met: "ok", open: "info", overdue: "bad", breached: "bad" };
const slaChip = (l: Lead) => (l.sla ? `<span class="st ${SLA_CLASS[l.sla.status]}">${esc(l.sla.status)}</span>` : `<span class="muted small">no clock</span>`);

function toast(msg: string) {
  const t = $("#toast")!; t.textContent = msg; t.classList.add("show");
  clearTimeout((toast as unknown as { h: number }).h);
  (toast as unknown as { h: number }).h = window.setTimeout(() => t.classList.remove("show"), 3500);
}

function download(name: string, text: string, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function emptyState(): string {
  return `<div class="card empty"><h2>No handoffs imported yet</h2><p>Import a CSV of qualified leads to build the queue.</p><button type="button" class="btn primary" data-view="import">Go to import</button></div>`;
}

// ---------- views ----------
function vImport(): string {
  const d = ui.desk;
  let out = `<h1>Import qualified-lead handoffs</h1><p class="lede">Paste or choose a CSV export. Every row is validated before anything is routed. Duplicates are resolved by stable <code>record_id</code> only, never by name.</p>
  <div class="card"><label class="f" for="csv">CSV contents</label>
  <textarea id="csv" spellcheck="false" placeholder="record_id,email,first_name,…">${esc(ui.draft)}</textarea>
  <div class="row" style-x><span class="btn file">Choose CSV file<input type="file" id="file" accept=".csv,text/csv" aria-label="Choose CSV file"></span>
  <button type="button" class="btn" data-act="sample">Load synthetic sample</button>
  <button type="button" class="btn primary" data-act="import">Validate &amp; import</button>
  <span class="muted small">${ui.draftName ? `File: <code>${esc(ui.draftName)}</code>` : ""}</span></div>
  ${ui.importError ? `<div class="alert bad" role="alert"><strong>Import refused.</strong> ${esc(ui.importError)}</div>` : ""}</div>`;
  if (!d) return out.replace(" style-x", "");
  const counts = stateCounts(d.leads);
  const ready = counts.packet_ready ?? 0;
  const review = (counts.conflict_review ?? 0) + (counts.ownership_review ?? 0) + (counts.duplicate_review ?? 0);
  const blocked = (counts.blocked_evidence ?? 0) + (counts.refused_unknown_territory ?? 0) + (counts.not_qualified ?? 0);
  out += `<div class="bubble">Import <code>${esc(d.csv_name)}</code> and build the handoff queue.</div>
  <div class="msg"><div class="avatar desk" aria-hidden="true">D</div><div class="msg-body"><div class="who">@handoff-desk<small>local rules · ${esc(POLICY_VERSION)}</small></div>
  <div class="tools"><span class="label">Using desk rules (local, deterministic)</span><span class="tool">validate_rows</span><span class="tool">dedupe_by_record_id</span><span class="tool">route_by_policy</span><span class="tool">check_evidence</span><span class="tool">compute_sla</span></div>
  <div class="stats"><div class="stat"><b>${d.total_rows}</b><span>data rows in file</span></div><div class="stat"><b>${d.row_errors.length ? d.total_rows - d.valid_rows : 0}</b><span>rows rejected</span></div><div class="stat"><b>${d.leads.length}</b><span>records after stable-ID dedupe</span></div><div class="stat"><b>${ready}</b><span>packets ready of ${d.leads.length}</span></div></div>
  <p>${ready} ready for a human-approved handoff, ${review} need human review, ${blocked} refused or blocked. Nothing has been written.</p>
  ${d.row_errors.length ? `<div class="alert risk"><strong>${d.row_errors.length} row error(s): these rows were not imported.</strong><table><thead><tr><th>Row</th><th>Column</th><th>Problem</th></tr></thead><tbody>${d.row_errors.map((e) => `<tr><td class="num">${e.row}</td><td><code>${esc(e.column)}</code></td><td>${esc(e.message)}</td></tr>`).join("")}</tbody></table></div>` : `<div class="alert ok">All rows passed validation.</div>`}
  <button type="button" class="btn primary" data-view="queue">Open handoff queue</button></div></div>`;
  return out.replace(" style-x", "");
}

const GROUPS: Record<string, (l: Lead) => boolean> = {
  all: () => true,
  ready: (l) => ["packet_ready", "approved", "written", "verified"].includes(l.state),
  review: (l) => ["conflict_review", "ownership_review", "duplicate_review", "verification_failed"].includes(l.state),
  refused: (l) => ["refused_unknown_territory", "blocked_evidence", "not_qualified"].includes(l.state),
};

function vQueue(): string {
  const d = ui.desk;
  if (!d) return `<h1>Handoff queue</h1>${emptyState()}`;
  const f = GROUPS[ui.filter] ?? GROUPS.all;
  const rows = d.leads.filter(f);
  const tab = (k: string, t: string) => `<button type="button" class="btn sm ${ui.filter === k ? "primary" : ""}" data-filter="${k}" aria-pressed="${ui.filter === k}">${t} (${d.leads.filter(GROUPS[k]).length})</button>`;
  return `<h1>Handoff queue</h1><p class="lede">${d.leads.length} records after dedupe. Routing uses explicit territory × segment rules; anything ambiguous goes to a person, not to a guess.</p>
  <div class="row">${tab("all", "All")}${tab("ready", "Ready")}${tab("review", "Human review")}${tab("refused", "Refused / blocked")}</div>
  <div class="card">${rows.length ? `<table><caption class="muted small">Simulated clock ${esc(formatLocal(parseIsoInstant(d.clock)!, "Europe/Paris"))}</caption><thead><tr><th>Record</th><th>Contact · company</th><th>Territory × segment</th><th>Owner (current → routed)</th><th>State</th><th>SLA</th><th></th></tr></thead><tbody>
  ${rows.map((l) => `<tr class="${l.record_id === ui.sel ? "sel" : ""}"><td><code>${esc(l.record_id)}</code>${l.rows.length > 1 ? `<div class="muted small">rows ${l.rows.join("+")}</div>` : ""}</td>
  <td>${esc(l.data.first_name)} ${esc(l.data.last_name)}<div class="muted small">${esc(l.data.company)} · ${esc(l.data.source)}</div></td>
  <td>${esc(l.territory ?? "unknown")} × ${esc(l.segment)}<div class="muted small">${esc(l.data.country)}, ${l.data.employees} emp.</div></td>
  <td><code>${esc(l.current_owner_id || "blank")}</code> → <code>${esc(l.routed_owner_id ?? "none")}</code></td>
  <td>${stateChip(l.state)}</td><td>${slaChip(l)}</td>
  <td><button type="button" class="btn sm" data-open="${esc(l.record_id)}" aria-label="Open ${esc(l.record_id)}">Open</button></td></tr>`).join("")}</tbody></table>` : `<p class="empty">No records in this filter.</p>`}</div>`;
}

function decisionTrace(l: Lead): string {
  const o = l.routed_owner_id ? ownerById(l.routed_owner_id) : undefined;
  return `<dl class="kv"><dt>State</dt><dd>${stateChip(l.state)}</dd>
  <dt>Territory × segment</dt><dd>${esc(l.territory ?? "unknown")} × ${esc(l.segment)} (${esc(l.data.country)}, ${l.data.employees} employees)</dd>
  <dt>Routing rule</dt><dd>${l.rule_id ? `<code>${esc(l.rule_id)}</code> → ${esc(o?.name)} (<code>${esc(o?.id)}</code>, ${esc(o?.tz)})` : "none: no explicit rule"}</dd>
  <dt>Current CRM owner</dt><dd><code>${esc(l.current_owner_id || "blank")}</code></dd>
  <dt>Source rows</dt><dd>${l.rows.join(", ")}</dd>
  <dt>SLA (4 working hours)</dt><dd>${l.sla ? `due ${esc(l.sla.due_local)} · ${slaChip(l)} ${l.sla.status === "open" ? `· ${l.sla.minutes_to_due} min left` : l.sla.status === "overdue" ? `· ${-l.sla.minutes_to_due} min late` : ""}` : "not started (handoff not ready)"}</dd></dl>
  <h3>Why</h3><ul>${l.reasons.map((r) => `<li><code>${esc(r.code)}</code> ${esc(r.detail)}</li>`).join("")}${l.notes.map((r) => `<li class="muted"><code>${esc(r.code)}</code> ${esc(r.detail)}</li>`).join("")}</ul>
  ${l.missing_fields.length ? `<div class="alert risk"><strong>Cannot advance. Missing or stale:</strong><ul>${l.missing_fields.map((m) => `<li><code>${esc(m)}</code></li>`).join("")}</ul></div>` : ""}`;
}

function picker(): string {
  const d = ui.desk!;
  return `<div class="row"><label for="pick" class="muted">Record</label><select id="pick">${d.leads.map((l) => `<option value="${esc(l.record_id)}" ${l.record_id === ui.sel ? "selected" : ""}>${esc(l.record_id)} · ${esc(l.data.company)} · ${esc(STATE_LABEL[l.state]?.[0] ?? l.state)}</option>`).join("")}</select></div>`;
}

function renderBrief(p: HandoffPacket, b: Brief | undefined): string {
  if (!b?.result) return `<p class="muted small">No response inspected yet.</p>`;
  const r = b.result;
  const label = b.provenance === "fixture" ? `<span class="fixture-label">${esc(FIXTURE_LABEL)}</span>` : `<span class="sim-label">pasted response · provenance not verified</span>`;
  let out = `<div class="row">${label}</div>`;
  if (!r.accepted) out += `<div class="alert bad" role="alert"><strong>Response rejected (${r.errors.length} issue${r.errors.length === 1 ? "" : "s"}).</strong> Nothing from it is used.<ul>${r.errors.map((e) => `<li><code>${esc(e.code)}</code> ${esc(e.message)}</li>`).join("")}</ul></div>`;
  for (const w of r.warnings) out += `<div class="alert risk"><code>${esc(w.code)}</code> ${esc(w.message)}</div>`;
  const resp = r.response;
  if (resp?.outcome === "refused") out += `<div class="alert info"><strong>Agent refused, as the contract requires.</strong> Reason <code>${esc(resp.refusal_reason)}</code>.${resp.missing_fields.length ? ` Missing: ${resp.missing_fields.map((m) => `<code>${esc(m)}</code>`).join(", ")}` : ""}</div>`;
  if (resp?.outcome === "draft" && resp.brief) {
    out += `<div class="msg"><div class="avatar" aria-hidden="true">G</div><div class="msg-body"><div class="who">@GTMHandoffBrief<small>${b.provenance === "fixture" ? esc(FIXTURE_LABEL) : "pasted"} · draft only</small></div>
    <p><strong>${esc(resp.brief.headline)}</strong></p><ul>${resp.brief.context.map((c) => `<li>${esc(c.text)} ${c.source_ids.map((s) => `<code>[${esc(s)}]</code>`).join(" ")}</li>`).join("")}</ul>
    <p><span class="muted">Suggested first touch (not sent):</span> ${esc(resp.brief.suggested_first_touch)}</p>
    <p class="muted small">Owner in draft: <code>${esc(resp.brief.owner_id)}</code> (matches routed owner <code>${esc(p.routing.routed_owner_id)}</code>). Accepting a draft does not approve or write anything.</p></div></div>`;
  }
  return out;
}

function vPacket(): string {
  const d = ui.desk;
  if (!d) return `<h1>Packet &amp; GTMHandoffBrief</h1>${emptyState()}`;
  const l = lead(ui.sel) ?? d.leads[0];
  ui.sel = l.record_id;
  const p = buildPacket(l, d.clock);
  const json = JSON.stringify(p, null, 2);
  const b = ui.briefs[l.record_id];
  return `<h1>Source-backed packet &amp; GTMHandoffBrief</h1><p class="lede">Export the packet, paste it into the native Dust agent <strong>GTMHandoffBrief</strong>, then paste its JSON answer back here. The agent only drafts. Approval and the simulated CRM write are separate steps.</p>
  ${picker()}
  <div class="grid2"><div class="card"><h2>Desk decision</h2>${decisionTrace(l)}</div>
  <div class="card"><h2>Export packet <span class="st neutral">${esc(p.packet_status)}</span></h2><p class="muted small"><code>${esc(p.packet_id)}</code> · contract <code>${esc(p.contract_version)}</code> · email shown as domain only</p>
  <pre id="packet-json" tabindex="0" aria-label="Packet JSON">${esc(json)}</pre>
  <div class="row"><button type="button" class="btn" data-act="copy-packet">Copy packet</button><button type="button" class="btn" data-act="dl-packet">Download packet</button></div></div></div>
  <div class="card"><h2>Inspect GTMHandoffBrief response</h2>
  <p class="muted small">No Dust adapter is connected. Paste the agent's JSON reply, or load a fixture. Fixtures are labelled <span class="fixture-label">${esc(FIXTURE_LABEL)}</span> and are never presented as live agent output.</p>
  <label class="f" for="resp">Agent response JSON</label><textarea id="resp" spellcheck="false" placeholder='{"contract_version":"gtm-handoff-brief/1", …}'>${esc(b?.text ?? "")}</textarea>
  <div class="row"><button type="button" class="btn primary" data-act="validate">Validate pasted response</button>
  <button type="button" class="btn" data-fixture="faithful">Fixture: expected reply</button><button type="button" class="btn" data-fixture="invented_source">Fixture: invented source</button><button type="button" class="btn" data-fixture="owner_change">Fixture: owner change</button></div>
  <div id="brief-out">${renderBrief(p, b)}</div></div>
  <div class="row"><button type="button" class="btn primary" data-view="approve" ${l.state === "packet_ready" ? "" : "disabled"}>Continue to human approval</button>${l.state === "packet_ready" ? "" : `<span class="muted small">Only packet-ready handoffs can be approved.</span>`}</div>`;
}

function vApprove(): string {
  const d = ui.desk;
  if (!d) return `<h1>Approve &amp; simulated write</h1>${emptyState()}`;
  const l = lead(ui.sel) ?? d.leads.find((x) => x.state === "packet_ready") ?? d.leads[0];
  ui.sel = l.record_id;
  const key = idempotencyKey(l);
  const appr = d.approvals.find((a) => a.idempotency_key === key);
  const writes = d.writes.filter((w) => w.record_id === l.record_id);
  const ver = [...d.verifications].reverse().find((v) => v.record_id === l.record_id);
  const owner = l.routed_owner_id ? ownerById(l.routed_owner_id) : undefined;
  const brief = ui.briefs[l.record_id]?.result;
  return `<h1>Human approval, simulated write, fresh read</h1><p class="lede">A person approves the handoff. The Desk then applies a <strong>simulated</strong> HubSpot owner update and first-touch task under an idempotency key, and re-reads the <strong>simulated</strong> record to verify it.</p>
  ${picker()}
  <div class="grid2"><div class="card"><h2>1 · Approve</h2>
  <dl class="kv"><dt>Handoff</dt><dd>${esc(l.data.first_name)} ${esc(l.data.last_name)}, ${esc(l.data.company)}</dd><dt>Route</dt><dd><code>${esc(l.rule_id ?? "none")}</code> → ${esc(owner?.name ?? "no owner")}</dd><dt>State</dt><dd>${stateChip(l.state)}</dd>
  <dt>Brief</dt><dd>${brief?.accepted ? `<span class="st ok">${esc(brief.outcome)} accepted</span> <span class="muted small">${esc(brief.provenance_label)}</span>` : `<span class="muted small">none inspected (optional; approval does not depend on the agent)</span>`}</dd>
  <dt>Idempotency key</dt><dd><code>${esc(key)}</code></dd></dl>
  ${appr ? `<div class="alert ok">Approved by <strong>${esc(appr.approver)}</strong> at <code>${esc(appr.at)}</code>.</div>` : ""}
  <label class="f" for="approver">Approver name</label><input type="text" id="approver" value="${esc(ui.approver)}" autocomplete="off">
  <label class="check"><input type="checkbox" id="reviewed" ${ui.reviewed ? "checked" : ""}> <span>I reviewed the packet, routing rule and evidence sources.</span></label>
  <div class="row"><button type="button" class="btn primary" data-act="approve">Approve handoff</button>
  <button type="button" class="btn" data-act="replay">Replay approval + write</button></div></div>
  <div class="card"><h2>2 · Simulated write &amp; 3 · fresh read</h2>
  <div class="tools"><span class="label">Using HubSpot (simulated)</span><span class="tool sim">update_contact</span><span class="tool sim">create_task</span><span class="tool sim">get_object</span></div>
  <div class="row"><button type="button" class="btn primary" data-act="write">Run simulated write</button><button type="button" class="btn" data-act="verify">Simulated fresh read &amp; verify</button></div>
  <h3>Write log <span class="sim-label">simulated</span></h3>
  ${writes.length ? `<table><thead><tr><th>#</th><th>Operation</th><th>Result</th><th>Detail</th></tr></thead><tbody>${writes.map((w) => `<tr><td class="num">${w.seq}</td><td><code>${esc(w.op)}</code></td><td><span class="st ${w.result === "applied" ? "ok" : "neutral"}">${esc(w.result)}</span></td><td>${esc(w.detail)}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">No writes yet.</p>`}
  <h3>Fresh read <span class="sim-label">simulated</span></h3>
  ${ver ? `<div class="alert ${ver.ok ? "ok" : "bad"}"><strong>${ver.ok ? "Verified" : "Verification failed"}</strong><ul>${ver.checks.map((c) => `<li>${c.ok ? "✓" : "✗"} ${esc(c.name)}: ${esc(c.detail)}</li>`).join("")}</ul></div><pre aria-label="Simulated fresh read">${esc(JSON.stringify(ver.read, null, 2))}</pre>` : `<p class="muted small">Not verified yet.</p>`}
  <p class="small muted">CRM tasks for this record: <strong>${d.crm[l.record_id]?.tasks.length ?? 0}</strong> · approvals: <strong>${d.approvals.filter((a) => a.record_id === l.record_id).length}</strong></p></div></div>`;
}

function vReports(): string {
  const d = ui.desk;
  const c = compareCohorts(SAMPLE_COHORTS, "2026-Q2", "2026-Q3");
  const slaTable = (title: string, by: (l: Lead) => string) => {
    const rows = slaReport(d!.leads, by);
    return `<h3>${title}</h3><table><thead><tr><th>Group</th><th class="num">Handoffs with SLA clock (n)</th><th class="num">Met</th><th class="num">Open</th><th class="num">Overdue</th><th class="num">Breached</th><th class="num">Overdue + breached</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.key)}</td><td class="num">${r.denominator}</td><td class="num">${r.met}</td><td class="num">${r.open}</td><td class="num">${r.overdue}</td><td class="num">${r.breached}</td><td class="num">${r.overdue + r.breached}/${r.denominator} (${pct(r.denominator ? (r.overdue + r.breached) / r.denominator : null)})</td></tr>`).join("")}</tbody></table>`;
  };
  const counts = d ? stateCounts(d.leads) : {};
  return `<h1>SLA &amp; cohort reporting</h1><p class="lede">Every rate shows its numerator and denominator. Nothing here claims impact.</p>
  ${d ? `<div class="card"><h2>Handoff SLA at the simulated clock</h2><p class="muted small">Denominator: packet-ready handoffs (${slaReport(d.leads, () => "x")[0]?.denominator ?? 0} of ${d.leads.length} deduplicated records). Clock: 4 working hours, Mon–Fri 09:00–18:00 in the routed owner's timezone.</p>
  ${slaTable("By segment", (l) => l.segment)}${slaTable("By territory", (l) => l.territory ?? "unknown")}
  <h3>Queue state (n = ${d.leads.length} records from ${d.total_rows} rows)</h3><table><tbody>${Object.entries(counts).map(([k, v]) => `<tr><td>${stateChip(k)}</td><td class="num">${v}/${d.leads.length}</td></tr>`).join("")}</tbody></table></div>` : `<div class="card">${emptyState()}</div>`}
  <div class="card"><h2>Cohort counterexample: SQL → opportunity conversion</h2><p class="muted small">Synthetic cohort counts. Q2 vs Q3, by lead source.</p>
  <table><thead><tr><th>Source</th><th class="num">Q2 converted / leads</th><th class="num">Q2 rate</th><th class="num">Q2 share</th><th class="num">Q3 converted / leads</th><th class="num">Q3 rate</th><th class="num">Q3 share</th><th class="num">Δ (pp)</th></tr></thead><tbody>
  ${c.segments.map((s) => `<tr><td>${esc(s.segment)}</td><td class="num">${s.base.k}/${s.base.n}</td><td class="num">${pct(s.base.rate)}</td><td class="num">${pct(s.base_share)}</td><td class="num">${s.comp.k}/${s.comp.n}</td><td class="num">${pct(s.comp.rate)}</td><td class="num">${pct(s.comp_share)}</td><td class="num">${s.delta_pp}</td></tr>`).join("")}
  <tr><td><strong>Overall</strong></td><td class="num">${c.overall_base.k}/${c.overall_base.n}</td><td class="num"><strong>${pct(c.overall_base.rate)}</strong></td><td></td><td class="num">${c.overall_comp.k}/${c.overall_comp.n}</td><td class="num"><strong>${pct(c.overall_comp.rate)}</strong></td><td></td><td class="num"><strong>+${c.overall_delta_pp}</strong></td></tr>
  <tr><td>Q3 at Q2 source mix</td><td></td><td></td><td></td><td class="num">${c.mix_adjusted_comp.k}/${c.mix_adjusted_comp.n}</td><td class="num">${pct(c.mix_adjusted_comp.rate)}</td><td></td><td class="num">${c.mix_adjusted_delta_pp}</td></tr></tbody></table>
  <div class="alert ${c.simpson ? "risk" : "ok"}" role="note"><strong>${c.simpson ? "Mix shift, not improvement." : "No mix-shift warning."}</strong> ${esc(c.verdict)}</div></div>`;
}

function vExport(): string {
  const d = ui.desk;
  if (!d) return `<h1>Spec &amp; regression case</h1>${emptyState()}`;
  return `<h1>Reproducible spec &amp; regression case</h1><p class="lede">The spec captures input hash, policy version, every decision, approval, simulated write and event. The regression case replays the input and must reproduce every decision exactly.</p>
  <div class="card"><h2>Export</h2><div class="row"><button type="button" class="btn primary" data-act="dl-spec">Download spec JSON</button><button type="button" class="btn" data-act="dl-case">Download regression case</button><button type="button" class="btn" data-act="dl-events">Download event log (NDJSON)</button></div>
  <dl class="kv"><dt>Policy</dt><dd><code>${esc(d.policy_version)}</code> (${ROUTES.length} routing rules)</dd><dt>Input</dt><dd><code>${esc(d.csv_name)}</code>, ${d.total_rows} rows</dd><dt>Events</dt><dd>${d.events.length}</dd></dl></div>
  <div class="card"><h2>Run a regression case</h2><label class="f" for="case">Regression case JSON (leave empty to use the current import)</label><textarea id="case" spellcheck="false">${esc(ui.regressionText)}</textarea>
  <div class="row"><button type="button" class="btn primary" data-act="run-case">Run regression</button></div>
  ${ui.regression ? `<div class="alert ${ui.regression.pass ? "ok" : "bad"}" role="status"><strong>${ui.regression.pass ? "PASS: every decision reproduced." : `FAIL: ${ui.regression.diffs.length} difference(s).`}</strong>${ui.regression.diffs.length ? `<ul>${ui.regression.diffs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>` : ""}</div>`;
}

const VIEWS: Record<View, () => string> = { import: vImport, queue: vQueue, packet: vPacket, approve: vApprove, reports: vReports, export: vExport };

function render(focus = false) {
  const main = $("#main")!;
  main.innerHTML = VIEWS[ui.view]();
  document.querySelectorAll<HTMLButtonElement>(".nav").forEach((b) => (b.dataset.view === ui.view ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  const d = ui.desk;
  $("#clock")!.textContent = `Simulated clock: ${formatLocal(parseIsoInstant(d?.clock ?? "2026-10-05T15:00:00Z")!, "Europe/Paris")} Paris`;
  $("#recent")!.innerHTML = d ? d.events.slice(-8).reverse().map((e) => `<li title="${esc(e.type)} ${esc(e.record_id ?? "")}"><code>${esc(e.type)}</code> ${esc(e.record_id ?? "")}</li>`).join("") : `<li>No activity yet</li>`;
  save();
  if (focus) { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

function go(v: View) { ui.view = v; render(true); }

function act(a: string) {
  const d = ui.desk;
  switch (a) {
    case "sample": ui.draft = SAMPLE_CSV; ui.draftName = SAMPLE_FILENAME; ui.importError = null; render(); return;
    case "import": {
      ui.draft = ($<HTMLTextAreaElement>("#csv")?.value ?? ui.draft);
      if (!ui.draft.trim()) { ui.importError = "Paste or choose a CSV first."; render(); $<HTMLTextAreaElement>("#csv")?.focus(); return; }
      const next = createDesk(ui.draft, ui.draftName || "pasted.csv");
      if (next.header_error) { ui.importError = next.header_error; ui.desk = null; render(); return; }
      ui.importError = null; ui.desk = next; ui.briefs = {}; ui.sel = next.leads[0]?.record_id ?? null; ui.regression = null;
      render(); toast(`Imported ${next.total_rows} rows → ${next.leads.length} records.`); return;
    }
    case "reset": localStorage.removeItem(KEY); ui = blank(); render(true); toast("Desk reset. Nothing was stored outside this browser."); return;
    case "copy-packet": case "dl-packet": {
      const l = lead(ui.sel); if (!l || !d) return;
      const json = JSON.stringify(buildPacket(l, d.clock), null, 2);
      if (a === "dl-packet") { download(`packet-${l.record_id}.json`, json); return; }
      navigator.clipboard?.writeText(json).then(() => toast("Packet copied. Paste it into GTMHandoffBrief."), () => toast("Clipboard blocked: select the packet text and copy it manually."));
      if (!navigator.clipboard) toast("Clipboard unavailable: select the packet text and copy it manually.");
      return;
    }
    case "validate": {
      const l = lead(ui.sel); if (!l || !d) return;
      const text = $<HTMLTextAreaElement>("#resp")?.value ?? "";
      ui.briefs[l.record_id] = { text, provenance: "pasted", result: validateResponse(buildPacket(l, d.clock), text, "pasted") };
      render(); return;
    }
    case "approve": case "replay": {
      const l = lead(ui.sel); if (!l || !d) return;
      ui.approver = $<HTMLInputElement>("#approver")?.value ?? ui.approver;
      ui.reviewed = $<HTMLInputElement>("#reviewed")?.checked ?? false;
      if (a === "approve" && !ui.reviewed) { render(); toast("Tick the review confirmation first."); $<HTMLInputElement>("#reviewed")?.focus(); return; }
      const r = approve(d, l.record_id, ui.approver);
      ui.desk = r.state;
      if (a === "replay") { const w = simulatedWrite(ui.desk, l.record_id); ui.desk = w.state; render(); toast(`${r.result.message} ${w.result.message}`); return; }
      render(); toast(r.result.message); return;
    }
    case "write": case "verify": {
      const l = lead(ui.sel); if (!l || !d) return;
      const r = a === "write" ? simulatedWrite(d, l.record_id) : verify(d, l.record_id);
      ui.desk = r.state; render(); toast(r.result.message); return;
    }
    case "dl-spec": if (d) download("handoff-spec.json", JSON.stringify(exportSpec(d), null, 2)); return;
    case "dl-case": if (d) download("regression-case.json", JSON.stringify(exportRegressionCase(d, d.csv_name), null, 2)); return;
    case "dl-events": if (d) download("events.ndjson", d.events.map((e) => JSON.stringify(e)).join("\n") + "\n", "application/x-ndjson"); return;
    case "run-case": {
      if (!d) return;
      const text = $<HTMLTextAreaElement>("#case")?.value.trim() ?? "";
      ui.regressionText = text;
      try { ui.regression = runRegression(text ? JSON.parse(text) : exportRegressionCase(d, d.csv_name)); }
      catch (e) { ui.regression = { pass: false, diffs: [`Could not read regression case: ${(e as Error).message}`] }; }
      render(); return;
    }
  }
}

document.addEventListener("click", (ev) => {
  const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-view],[data-act],[data-open],[data-filter],[data-fixture]");
  if (!t || (t as HTMLButtonElement).disabled) return;
  if (t.dataset.view) return go(t.dataset.view as View);
  if (t.dataset.open) { ui.sel = t.dataset.open; return go("packet"); }
  if (t.dataset.filter) { ui.filter = t.dataset.filter; return render(); }
  if (t.dataset.fixture) {
    const l = lead(ui.sel); if (!l || !ui.desk) return;
    const p = buildPacket(l, ui.desk.clock);
    const text = JSON.stringify(fixtureResponse(p, t.dataset.fixture as "faithful"), null, 2);
    ui.briefs[l.record_id] = { text, provenance: "fixture", result: validateResponse(p, text, "fixture") };
    return render();
  }
  if (t.dataset.act) act(t.dataset.act);
});
document.addEventListener("change", (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === "pick") { ui.sel = t.value; render(); $<HTMLSelectElement>("#pick")?.focus(); }
  if (t.id === "file" && t.files?.[0]) {
    const f = t.files[0];
    if (f.size > 2_000_000) { ui.importError = "File is larger than 2 MB."; render(); return; }
    f.text().then((txt) => { ui.draft = txt; ui.draftName = f.name; ui.importError = null; render(); });
  }
});
document.addEventListener("input", (ev) => {
  const t = ev.target as HTMLInputElement;
  if (t.id === "csv") ui.draft = t.value;
  if (t.id === "approver") ui.approver = t.value;
});
render();
