// Browser end-to-end test. Usage: CHROME_PATH=/path/to/chrome BASE_URL=http://127.0.0.1:8787 node scripts/e2e.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";
const SHOTS = process.env.SHOTS_DIR || "docs/evidence/e2e";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable");
mkdirSync(SHOTS, { recursive: true });

const results = [];
let failed = 0;
async function check(name, fn) {
  try { await fn(); results.push(`PASS ${name}`); }
  catch (e) { failed++; results.push(`FAIL ${name}: ${e.message.split("\n")[0]}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(e.message));
const main = () => page.locator("main").innerText();
const btn = (name) => page.getByRole("button", { name, exact: true });
const nav = (t) => page.locator(".nav", { hasText: t }).click();

await page.goto(BASE + "/");
await check("logo, non-affiliation label and simulated disclosure visible", async () => {
  assert(await page.locator("header img[alt=Dust]").isVisible(), "logo missing");
  assert(/Independent concept by Ayo Ahmed\. Not affiliated with Dust\./.test(await page.locator("#indep").innerText()), "label missing");
  assert(/simulated/i.test(await page.locator("#indep").innerText()), "simulated disclosure missing");
});
await check("empty states on every view before import", async () => {
  for (const v of ["Handoff queue", "Packet", "Approve", "Spec"]) { await nav(v); assert(/No handoffs imported yet/.test(await main()), `${v} has no empty state`); }
  await nav("Import CSV");
});
await page.screenshot({ path: `${SHOTS}/01-empty.png` });

await check("empty import is refused with an actionable message", async () => {
  await btn("Validate & import").click();
  assert(/Paste or choose a CSV first/.test(await main()), "no empty-input error");
});
await check("wrong header is refused and nothing is queued", async () => {
  await page.fill("#csv", "id,name\n1,Camille\n");
  await btn("Validate & import").click();
  assert(/Import refused[\s\S]*Missing required column/.test(await main()), "header error not shown");
  await nav("Handoff queue");
  assert(/No handoffs imported yet/.test(await main()), "queue formed from bad file");
  await nav("Import CSV");
});
await page.screenshot({ path: `${SHOTS}/02-header-error.png` });

await check("sample import: row errors listed, 19 rows → 15 records", async () => {
  await btn("Load synthetic sample").click();
  await btn("Validate & import").click();
  const t = await main();
  assert(/2 row error\(s\)/.test(t) && /Not a valid email address/.test(t), "row errors missing");
  assert(/15\s*records after stable-ID dedupe/.test(t), "dedupe count wrong");
  assert(/7\s*packets ready of 15/.test(t), "ready count wrong");
});
await page.screenshot({ path: `${SHOTS}/03-import.png`, fullPage: true });

await check("queue shows refusals and reviews", async () => {
  await btn("Open handoff queue").click();
  const t = await main();
  for (const s of ["Refused: unknown territory", "Ownership conflict: human review", "Owner mismatch: human review", "Blocked: evidence", "Duplicate email: human review"]) assert(t.includes(s), `missing ${s}`);
  assert(/rows 3\+17/.test(t), "merged rows not shown");
  await page.getByRole("button", { name: /^Human review/ }).click();
  assert((await page.locator("tbody tr").count()) === 4, "review filter count");
  await page.getByRole("button", { name: /^All/ }).click();
});
await page.screenshot({ path: `${SHOTS}/04-queue.png`, fullPage: true });

await check("missing evidence: fields listed, approval disabled, fixture refuses", async () => {
  await page.getByRole("button", { name: "Open 100106" }).click();
  const t = await main();
  assert(/Cannot advance[\s\S]*budget_confirmed[\s\S]*champion/.test(t), "missing fields not listed");
  assert(await btn("Continue to human approval").isDisabled(), "approval reachable");
  await btn("Fixture: expected reply").click();
  const o = await page.locator("#brief-out").innerText();
  assert(/deterministic fixture; Dust adapter unconnected/.test(o) && /Agent refused/.test(o) && /missing_evidence/.test(o), "refusal not shown");
});
await page.screenshot({ path: `${SHOTS}/05-missing-evidence.png`, fullPage: true });

await check("conflicting owner: fixture refuses with ownership_conflict, no reassignment", async () => {
  await page.selectOption("#pick", "100108");
  assert(/Current CRM owner\s*o-na-2/.test(await main()), "current owner not kept");
  await btn("Fixture: expected reply").click();
  assert(/ownership_conflict/.test(await page.locator("#brief-out").innerText()), "no conflict refusal");
});
await check("unknown territory refused with no owner", async () => {
  await page.selectOption("#pick", "100105");
  assert(/Refused: unknown territory/.test(await main()) && /none: no explicit rule/.test(await main()), "unknown territory not refused");
});

await check("pasted response: bad JSON, invented source and owner change are rejected", async () => {
  await page.selectOption("#pick", "100102");
  await page.fill("#resp", "{not json");
  await btn("Validate pasted response").click();
  assert(/json_parse/.test(await page.locator("#brief-out").innerText()), "bad JSON accepted");
  assert(/provenance not verified/i.test(await page.locator("#brief-out").innerText()), "pasted label missing");
  await btn("Fixture: invented source").click();
  assert(/unknown_source_id/.test(await page.locator("#brief-out").innerText()), "invented source accepted");
  await btn("Fixture: owner change").click();
  assert(/owner_change/.test(await page.locator("#brief-out").innerText()), "owner change accepted");
});
await check("normal packet: fixture draft accepted, labelled, cites sources", async () => {
  await btn("Fixture: expected reply").click();
  const o = await page.locator("#brief-out").innerText();
  assert(/deterministic fixture; Dust adapter unconnected/.test(o) && /\[note:note-7002\]/.test(o) && /does not approve or write/.test(o), "draft not shown");
});
await page.screenshot({ path: `${SHOTS}/06-normal-brief.png`, fullPage: true });

await check("write refused before approval; approval needs review tick", async () => {
  await btn("Continue to human approval").click();
  await btn("Run simulated write").click();
  assert(/No writes yet/.test(await main()), "write applied without approval");
  await page.fill("#approver", "Ayo Ahmed");
  await btn("Approve handoff").click();
  assert(!/Approved by/.test(await main()), "approved without review tick");
});
await check("approve → simulated write → replay is a no-op → fresh read verified", async () => {
  await page.check("#reviewed");
  await btn("Approve handoff").click();
  assert(/Approved by Ayo Ahmed/.test(await main()), "not approved");
  await btn("Run simulated write").click();
  await btn("Replay approval + write").click();
  await btn("Simulated fresh read & verify").click();
  const t = await main();
  assert((t.match(/noop_replay/g) || []).length === 2, "replay not a no-op");
  assert(/CRM tasks for this record: 1 · approvals: 1/.test(t), "duplicate task or approval");
  assert(/Verified[\s\S]*owner matches approval/.test(t), "not verified");
});
await page.screenshot({ path: `${SHOTS}/07-write-verify.png`, fullPage: true });

await check("reports show denominators and the mix-shift counterexample", async () => {
  await nav("SLA");
  const t = await main();
  assert(/7 of 15 deduplicated records/.test(t), "SLA denominator missing");
  assert(/70\/400[\s\S]*17\.5%[\s\S]*123\/400[\s\S]*30\.75%/.test(t), "cohort arithmetic missing");
  assert(/Mix shift, not improvement/.test(t) && /No impact is claimed/.test(t), "counterexample verdict missing");
});
await page.screenshot({ path: `${SHOTS}/08-reports.png`, fullPage: true });

await check("spec/regression export downloads and regression passes", async () => {
  await nav("Spec");
  const [dl] = await Promise.all([page.waitForEvent("download"), btn("Download regression case").click()]);
  const path = await dl.path();
  const { readFileSync } = await import("node:fs");
  const c = JSON.parse(readFileSync(path, "utf8"));
  assert(c.case_version === "gtm-handoff-regression/1" && c.expected.decisions.length === 15, "bad case");
  await btn("Run regression").click();
  assert(/PASS: every decision reproduced/.test(await main()), "regression did not pass");
  await page.fill("#case", JSON.stringify({ ...c, input_csv: c.input_csv.replace(",BR,", ",FR,") }));
  await btn("Run regression").click();
  assert(/FAIL[\s\S]*100105/.test(await main()), "changed input not detected");
});
await page.screenshot({ path: `${SHOTS}/09-regression.png`, fullPage: true });

await check("state survives reload; reset clears it", async () => {
  await page.reload();
  await nav("Approve");
  assert(/Approved by Ayo Ahmed/.test(await main()), "state lost");
  await page.locator("[data-act=reset]").click();
  await nav("Handoff queue");
  assert(/No handoffs imported yet/.test(await main()), "reset failed");
});
await check("keyboard: Tab reaches nav, Enter activates, focus moves to main", async () => {
  await page.goto(BASE + "/");
  await page.keyboard.press("Tab"); // skip link
  await page.keyboard.press("Tab"); // reset
  let found = false;
  for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); if ((await page.evaluate(() => document.activeElement?.textContent)).includes("Handoff queue")) { found = true; break; } }
  assert(found, "nav not reachable");
  await page.keyboard.press("Enter");
  assert(await page.evaluate(() => document.activeElement?.id === "main"), "focus not moved to main");
  assert(/Handoff queue/.test(await page.locator("h1").innerText()), "Enter did not navigate");
});
await check("no console errors", async () => assert(consoleErrors.length === 0, consoleErrors.join(" | ")));

await browser.close();
const out = results.join("\n") + `\n${results.length - failed}/${results.length} passed\n`;
writeFileSync(`${SHOTS}/results.txt`, out);
console.log(out);
process.exit(failed ? 1 : 0);
