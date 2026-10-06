// Responsive check: every view at 390px and 768px must not overflow the page horizontally.
// Usage: CHROME_PATH=/path/to/chrome BASE_URL=http://127.0.0.1:8787 node scripts/responsive.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL || "http://127.0.0.1:8787";
const SHOTS = process.env.SHOTS_DIR || "docs/evidence/responsive";
const CHROME = process.env.CHROME_PATH;
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable");
mkdirSync(SHOTS, { recursive: true });

const VIEWS = [
  ["import", "Import CSV"], ["queue", "Handoff queue"], ["packet", "Packet"],
  ["approve", "Approve"], ["reports", "SLA"], ["export", "Spec"],
];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failed = 0;
for (const width of [390, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/");
  await page.getByRole("button", { name: "Load synthetic sample", exact: true }).click();
  await page.getByRole("button", { name: "Validate & import", exact: true }).click();
  for (const [id, label] of VIEWS) {
    await page.locator(".nav", { hasText: label }).click();
    if (id === "packet") await page.getByRole("button", { name: "Fixture: expected reply" }).first().click().catch(() => {});
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const inScroller = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "scroll") && p.getBoundingClientRect().right <= vw + 1) return true; } return false; };
      const offenders = [...document.querySelectorAll("body *")]
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !inScroller(el); })
        .slice(0, 6).map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60) + ` right=${Math.round(el.getBoundingClientRect().right)}`);
      return { vw, sw: document.documentElement.scrollWidth, offenders };
    });
    const ok = m.sw <= m.vw && m.offenders.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${width}px ${id}: scrollWidth ${m.sw} / viewport ${m.vw}${ok ? "" : " " + m.offenders.join("; ")}`);
    await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
    await page.screenshot({ path: `${SHOTS}/${width}-${id}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : "ALL PASS");
process.exit(failed ? 1 : 0);
