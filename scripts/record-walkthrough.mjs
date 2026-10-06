// Records the Desk part of the vertical walkthrough (540x960 CSS px at 2x = 1080x1920) and writes scene timings.
// Scenes marked "slot" are not recorded as Desk footage: build-video.py fills them with the actual native preview captures.
// Usage: CHROME_PATH=... BASE_URL=... [NATIVE_RESPONSE=reply.json] SCENES=video/work/vo/scenes-timed.json OUT_DIR=video/work/rec node scripts/record-walkthrough.mjs
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";
const OUT = process.env.OUT_DIR || "video/work/rec";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable");
const scenes = JSON.parse(readFileSync(process.env.SCENES || "video/work/vo/scenes-timed.json", "utf8"));
const vo = Object.fromEntries(scenes.map((s) => [s.id, s.vo_seconds ?? 6]));
mkdirSync(`${OUT}/frames`, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, acceptDownloads: true, bypassCSP: true });
await ctx.addInitScript(() => {
  const mk = () => {
    if (document.getElementById("demo-cursor")) return;
    document.documentElement.style.scrollBehavior = "auto";
    const c = document.createElement("div");
    c.id = "demo-cursor";
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", width: "26px", height: "26px", margin: "-13px 0 0 -13px", borderRadius: "50%",
      background: "rgba(255,170,13,.45)", border: "3px solid #1C1917", boxShadow: "0 0 0 6px rgba(255,170,13,.2)", zIndex: "2147483647",
      pointerEvents: "none", transition: "transform .12s ease", transform: "translate(270px,480px)" });
    document.documentElement.appendChild(c);
    let x = 270, y = 480, s = 1;
    const put = () => { c.style.transform = `translate(${x}px,${y}px) scale(${s})`; };
    addEventListener("mousemove", (e) => { x = e.clientX; y = e.clientY; put(); }, true);
    addEventListener("mousedown", () => { s = 0.7; put(); }, true);
    addEventListener("mouseup", () => { s = 1; put(); }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", mk); else mk();
});

const t0 = Date.now();
const page = await ctx.newPage();
const frames = [];
const cdp = await ctx.newCDPSession(page);
cdp.on("Page.screencastFrame", async (f) => {
  const file = `${OUT}/frames/${String(frames.length).padStart(6, "0")}.jpg`;
  writeFileSync(file, Buffer.from(f.data, "base64"));
  frames.push({ file, t: f.metadata.timestamp - t0 / 1000 });
  await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
page.setDefaultTimeout(6000);
const sleep = (ms) => page.waitForTimeout(ms);
let mx = 270, my = 480;
async function moveTo(loc, { dx = 0, dy = 0, ms = 700 } = {}) {
  const b = await loc.boundingBox();
  const x = b.x + Math.min(b.width / 2, 120) + dx, y = b.y + b.height / 2 + dy;
  const steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) { const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; await page.mouse.move(mx + (x - mx) * e, my + (y - my) * e); }
  mx = x; my = y;
}
async function click(loc, opts) { await scrollIntoView(loc); await moveTo(loc, opts); await sleep(180); await page.mouse.down(); await sleep(90); await page.mouse.up(); await sleep(300); }
async function scrollTo(loc, { top = 90, ms = 900 } = {}) {
  await loc.evaluate((el, [top, ms]) => new Promise((res) => {
    const start = scrollY, end = Math.max(0, start + el.getBoundingClientRect().top - top), t0 = performance.now();
    const f = (now) => { const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; scrollTo(0, start + (end - start) * e); t < 1 ? requestAnimationFrame(f) : res(); };
    requestAnimationFrame(f);
  }), [top, ms]);
  await sleep(150);
}
async function scrollIntoView(loc) {
  const b = await loc.boundingBox();
  if (!b || b.y < 40 || b.y + b.height > 900) await scrollTo(loc, { top: 380, ms: 700 });
}
async function zoom(loc, scale = 1.25) {
  await loc.evaluate((el, s) => { el.style.transition = "transform .6s ease"; el.style.transformOrigin = "left top"; el.style.position = "relative"; el.style.zIndex = "5"; el.style.background = "#fff"; el.style.boxShadow = "0 8px 30px rgba(0,0,0,.18)"; el.style.transform = `scale(${s})`; }, scale);
  await sleep(650);
}
async function unzoom(loc) { await loc.evaluate((el) => { el.style.transform = "none"; el.style.boxShadow = "none"; }); await sleep(600); }
const nav = (t) => page.locator(".nav", { hasText: t });
const btn = (name) => page.getByRole("button", { name, exact: true });

const marks = [];
let sceneStart = 0;
function begin(id) { sceneStart = Date.now(); marks.push({ id, start: (sceneStart - t0) / 1000 }); }
async function hold(id, pad = 0.5) { const need = (vo[id] + pad) * 1000 - (Date.now() - sceneStart); if (need > 0) await sleep(need); }

await page.goto(BASE + "/");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForLoadState("networkidle");
await sleep(600);
const videoStart = (Date.now() - t0) / 1000;

begin("s01");
await moveTo(page.locator("header img"), { ms: 900 });
await sleep(1200);
await moveTo(page.locator("#indep strong"), { ms: 900 });
await zoom(page.locator("#indep"), 1.08);
await hold("s01", 0.2);
await unzoom(page.locator("#indep"));

begin("s02");
await scrollTo(page.locator("#csv"), { top: 120, ms: 900 });
await click(page.locator("#csv"));
await page.locator("#csv").fill("id,name,owner\n1,Camille Martin,o-fr-1\n");
await sleep(400);
await click(btn("Validate & import"));
await moveTo(page.getByText("Import refused."), { ms: 700 });
await zoom(page.locator(".alert.bad"), 1.15);
await hold("s02", 0.2);
await unzoom(page.locator(".alert.bad"));

begin("s03");
await click(btn("Load synthetic sample"));
await click(btn("Validate & import"));
await scrollTo(page.locator(".stats"), { top: 80, ms: 1000 });
await moveTo(page.locator(".stat").nth(0), { ms: 600 });
await sleep(600);
await scrollTo(page.locator(".alert.risk"), { top: 120, ms: 900 });
await zoom(page.locator(".alert.risk"), 1.12);
await moveTo(page.getByText("Not a valid email address."), { ms: 700 });
await sleep(1500);
await unzoom(page.locator(".alert.risk"));
await scrollTo(page.locator(".stats"), { top: 80, ms: 800 });
await moveTo(page.locator(".stat").nth(2), { ms: 700 });
await sleep(900);
await moveTo(page.locator(".stat").nth(3), { ms: 700 });
await hold("s03", 0.2);

begin("s04");
await click(btn("Open handoff queue"));
await sleep(300);
const r3 = page.locator("tr", { hasText: "100103" });
await scrollTo(r3, { top: 200, ms: 900 });
await moveTo(r3.getByText("rows 3+17"), { ms: 800 });
await zoom(r3, 1.06);
await sleep(1800);
await unzoom(r3);
const r10 = page.locator("tr", { hasText: "100110" });
await scrollTo(r10, { top: 200, ms: 900 });
await moveTo(r10, { ms: 700 });
await sleep(900);
await moveTo(page.locator("tr", { hasText: "100111" }), { ms: 700 });
await hold("s04", 0.2);

begin("s05");
const r5 = page.locator("tr", { hasText: "100105" });
await scrollTo(r5, { top: 220, ms: 900 });
await moveTo(r5.getByText("Refused: unknown territory"), { ms: 800 });
await sleep(1800);
const r8 = page.locator("tr", { hasText: "100108" });
await scrollTo(r8, { top: 220, ms: 900 });
await moveTo(r8.getByText(/human review/), { ms: 800 });
await sleep(1200);
await moveTo(r8.getByText("o-na-2"), { ms: 700 });
await hold("s05", 0.2);

begin("s06");
{ const o = page.getByRole("button", { name: "Open 100106" }); await o.scrollIntoViewIfNeeded(); await moveTo(o, { ms: 700 }); await sleep(200); await o.click(); }
await sleep(300);
const miss = page.locator(".alert.risk").first();
await scrollTo(miss, { top: 200, ms: 1000 });
await zoom(miss, 1.15);
await moveTo(miss, { ms: 800 });
await sleep(2200);
await unzoom(miss);
await scrollTo(btn("Continue to human approval"), { top: 600, ms: 1100 });
await moveTo(btn("Continue to human approval"), { ms: 800 });
await hold("s06", 0.2);

begin("s07");
await scrollTo(page.locator("#pick"), { top: 100, ms: 900 });
await moveTo(page.locator("#pick"), { ms: 600 });
await page.selectOption("#pick", "100102");
await sleep(500);
const pk = page.locator("#packet-json");
await scrollTo(pk, { top: 120, ms: 1000 });
await moveTo(pk.getByText(/email_domain/), { ms: 800 }).catch(() => {});
await zoom(pk, 1.1);
await sleep(1800);
await unzoom(pk);
await click(btn("Copy packet"));
await hold("s07", 0.2);

begin("s08"); // slot: native Dust footage is inserted here by build-video.py
await hold("s08", 0.3);

begin("s09");
{
  // NATIVE_RESPONSE: file holding the reply exactly as GTMHandoffBrief returned it. Without it, a labelled fixture is used (draft only).
  const native = process.env.NATIVE_RESPONSE ? readFileSync(process.env.NATIVE_RESPONSE, "utf8") : null;
  const ta = page.locator("#resp");
  await scrollTo(ta, { top: 160, ms: 900 });
  if (native) {
    await click(ta);
    await ta.fill(native);
    await sleep(600);
    await click(btn("Validate pasted response"));
    await sleep(400);
    const lab = page.locator("#brief-out .sim-label");
    await scrollTo(lab, { top: 120, ms: 900 });
    await moveTo(lab, { ms: 700 });
    await zoom(lab, 1.15);
    await sleep(1800);
    await unzoom(lab);
    await moveTo(page.locator("#brief-out .msg"), { ms: 800 });
    await sleep(1600);
  } else {
    await click(btn("Fixture: expected reply"));
    await sleep(400);
    await scrollTo(page.locator("#brief-out .fixture-label"), { top: 120, ms: 900 });
    await moveTo(page.locator("#brief-out .fixture-label"), { ms: 700 });
    await sleep(1600);
  }
  await scrollTo(btn("Fixture: invented source"), { top: 400, ms: 700 });
  await click(btn("Fixture: invented source"));
  await moveTo(page.locator("#brief-out .fixture-label"), { ms: 600 });
  await sleep(500);
  await moveTo(page.locator("#brief-out .alert.bad"), { ms: 700 });
  await zoom(page.locator("#brief-out .alert.bad"), 1.08);
  await sleep(1400);
  await unzoom(page.locator("#brief-out .alert.bad"));
  if (native) { await ta.fill(native); await click(btn("Validate pasted response")); }
  else await click(btn("Fixture: expected reply"));
  await hold("s09", 0.2);
}

begin("s10");
await click(btn("Continue to human approval"));
await sleep(300);
await click(page.locator("#approver"));
await page.locator("#approver").pressSequentially("Ayo Ahmed", { delay: 30 });
await click(page.locator("#reviewed"));
await click(btn("Approve handoff"));
await sleep(500);
await click(btn("Run simulated write"));
await sleep(400);
await scrollTo(page.getByText("Write log"), { top: 140, ms: 800 });
await sleep(800);
await click(btn("Replay approval + write"));
await scrollTo(page.getByText("Write log"), { top: 140, ms: 800 });
await zoom(page.locator("table").last(), 1.05);
await moveTo(page.getByText("noop_replay").first(), { ms: 700 });
await hold("s10", 0.2);
await unzoom(page.locator("table").last());

begin("s11");
await click(btn("Simulated fresh read & verify"));
await sleep(300);
const okb = page.locator(".alert.ok").last();
await scrollTo(okb, { top: 160, ms: 900 });
await zoom(okb, 1.1);
await moveTo(okb, { ms: 700 });
await hold("s11", 0.2);
await unzoom(okb);

begin("s12");
await scrollTo(page.locator("nav"), { top: 0, ms: 700 });
await click(nav("SLA"));
const coh = page.getByText("Cohort counterexample: SQL → opportunity conversion");
await scrollTo(coh, { top: 60, ms: 1300 });
const table = page.locator(".card").last().locator("table");
await moveTo(page.getByText("Overall").last(), { ms: 700 });
await zoom(table, 1.0);
await sleep(1600);
await moveTo(page.getByText("inbound_demo").last(), { ms: 700 });
await sleep(1100);
await moveTo(page.getByText("Mix shift, not improvement."), { ms: 700 });
await zoom(page.locator(".alert.risk").last(), 1.08);
await hold("s12", 0.2);
await unzoom(page.locator(".alert.risk").last());

begin("s13");
await scrollTo(page.locator("nav"), { top: 0, ms: 800 });
await click(nav("Spec"));
await click(btn("Run regression"));
await moveTo(page.getByText(/PASS: every decision reproduced/), { ms: 700 });
await sleep(1500);
await page.evaluate(() => scrollTo(0, 0));
await moveTo(page.locator("#indep strong"), { ms: 900 });
await hold("s13", 1.2);
const end = (Date.now() - t0) / 1000;

await cdp.send("Page.stopScreencast");
await sleep(300);
await browser.close();
writeFileSync(`${OUT}/timings.json`, JSON.stringify({ videoStart, end, marks, frames }, null, 1));
console.log(JSON.stringify({ frames: frames.length, videoStart, end, marks: marks.map((m) => `${m.id}@${m.start.toFixed(2)}`) }));
