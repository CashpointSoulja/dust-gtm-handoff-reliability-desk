// Builds the static GitHub Pages copy into dist-pages/. The app is fully client-side; Pages cannot set
// response headers, so the CSP lives in a <meta> tag in index.html.
import { cpSync, rmSync, writeFileSync, existsSync } from "node:fs";
const OUT = "dist-pages";
if (!existsSync("public/app.js")) throw new Error("Run `npm run build` first");
rmSync(OUT, { recursive: true, force: true });
cpSync("public", OUT, { recursive: true, filter: (p) => !p.endsWith(".map") });
writeFileSync(`${OUT}/.nojekyll`, "");
writeFileSync(`${OUT}/404.html`, '<!doctype html><meta charset="utf-8"><title>Not found</title><p>Not found. <a href="./">GTM Handoff Reliability Desk</a> (independent concept by Ayo Ahmed, not affiliated with Dust).</p>\n');
console.log(`static site written to ${OUT}/`);
