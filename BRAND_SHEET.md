# Brand sheet: Dust (reference for an independent concept)

> **Independent concept by Ayo Ahmed. Not affiliated with Dust.** The Dust name and logo belong to Dust. They are used unmodified here only to show how the concept would fit Dust's product. No Dust system, account or data was accessed.

This sheet was written **before any application code**. It records what was observed on Dust's public site, public docs and the open-source design system (Sparkle, in the public `dust-tt/dust` repository). The app follows it.

## Sources inspected (October 2026)

| Source | What it gave |
|---|---|
| https://dust.tt/ | Logo, nav, hero type, primary button, chips ("SEE DUST IN ACTION"), workflow cards |
| https://dust.tt/home/solutions/sales | GTM framing: account snapshots, handovers, CRM admin overhead |
| https://dust.tt/integrations/hubspot | **The official in-product mock**: "Dust · My workspace" frame, RECENT sidebar, user bubble, agent message, "USING HUBSPOT" tool chips, "Ask a follow-up…" input bar |
| https://docs.dust.tt/docs/welcome-to-dust | Docs layout: left nav, blue selected pill, right "On this page" rail |
| `dust-tt/dust` → `sparkle/src/styles/{tokens,theme}.css` | Exact colour tokens, fonts, weights, shadows |
| https://jobs.ashbyhq.com/dust/35d21c5b-907d-4be4-a7fb-6e7bf85d4dbc | Role scope: lead routing → qualification → deal progression → **hand-offs** → renewals, clean HubSpot data, trusted reporting |

Captures are in [`docs/brand/captures/`](docs/brand/captures/). The rendered guide is [`docs/brand/visual-guide.html`](docs/brand/visual-guide.html) ([PNG](docs/brand/visual-guide.png)).

## Logo

- The literal Dust wordmark: a 96×24 SVG built from seven flat shapes. Taken from the dust.tt header markup, with only the `class`, `width` and `height` attributes changed. Transparent background, no box.
- Shape colours: `#418B5C` hunter green, `#E2F78C` tea green, `#FFC3DF` pink, `#E14322` red, `#3B82F6` blue, `#9FDBFF` sky, `#FFAA0D` golden.
- Placement in the app: **top left** of the app header at 96×24, followed by a thin separator and the product name. It is never recoloured, stretched or placed on a tinted box.
- File: [`public/brand/dust-logo.svg`](public/brand/dust-logo.svg).

## Colour (Sparkle tokens, light theme)

| Role | Token | Value used |
|---|---|---|
| App background | `--color-app-background` | `oklch(98.56% 0.0017 67.8)` ≈ `#FAF9F8` |
| Panels / cards | `--color-background` | `#FFFFFF` |
| Muted surface | `--color-muted` (stone-50) | `oklch(98.6% 0.002 67.802)` |
| Text | `--color-foreground` (stone-900) | `oklch(20.6% 0.005 67.543)` ≈ `#1C1917` |
| Secondary text | `--color-muted-foreground` (stone-600) | `oklch(44.4% 0.011 78.213)` |
| Faint text | `--color-faint` (stone-500) | `oklch(55.4% 0.014 59.397)` |
| Border | `--color-border` (stone-100) | `oklch(97% 0.001 106.424)` |
| Border, darker | `--color-border-dark` (stone-150) | `oklch(94.9% 0.003 106.45)` |
| Form border | `--color-border-form` (stone-300) | `oklch(86.9% 0.004 56.366)` |
| Hover / selected | `--color-hover` / `--color-selected` | `rgba(0,0,0,.02)` / `rgba(0,0,0,.06)` |
| Highlight (primary action, links) | `--color-highlight-500` (blue-500) | `oklch(65.39% 0.1893 252.74)` ≈ `#1C91FF` |
| Highlight, pressed / text on white | blue-600 / blue-700 | `oklch(59.5% .1756 252.9)` / `oklch(53.19% .1614 253.34)` |
| Highlight tint | blue-50 / blue-100 | chip and selected-nav background |
| Success | green-600 (= brand hunter green) | `oklch(57.64% 0.1041 153.7)` |
| Warning / blocked | rose-500 / red-500 | `oklch(60.89% 0.1999 33.35)` |
| Info / at risk | golden-500 | `oklch(80.18% 0.169 72.86)` with golden-50 tint |

Rules: the surface is **warm off-white with white cards**, not grey or dark. Blue is reserved for the main action, links, selection and the "highlight" chip. Status colour appears only as small dots, chips and left rules, never as full-bleed fills.

## Typography

- **Geist** (variable) for all UI. **Geist Mono** for tool chips, IDs, field names and code. Both are SIL OFL and bundled in `public/fonts/`.
- Weights: regular 400, medium **450**, semibold **550**. These are Sparkle's tuned values, lighter than the usual 500/600.
- Scale: xs 12/16, sm 14/20, base 16/24, lg 18/26 (−0.01em), xl 20/28 (−0.015em). Marketing heroes go to 56–64px with tight tracking. The app itself stays at ≤ 24px headings.
- Small-caps labels such as "RECENT" and "USING HUBSPOT" are 11–12px uppercase, letter-spacing ~0.04em, in the muted foreground.

## Spacing, radius, elevation

- 4px base grid. Panel padding is 16–24px. The sidebar is ~240px wide with 8px item padding.
- Radius: 8px for buttons, inputs, chips and nav pills. 12–16px for cards and the app frame. Full radius for the small status chip.
- Shadows are subtle: `--shadow` = `0 2px 6px oklch(18.98% .0094 255.63 / .102)`. Most separation comes from 1px stone borders, not shadow.

## Component patterns observed

1. **App frame** ("Dust · My workspace"): a white rounded frame with a top bar (small logo + workspace name), a left **RECENT** list where the selected item is a stone pill, and a main conversation column.
2. **User message**: right-aligned bubble on muted stone with a 16px radius.
3. **Agent message**: avatar + agent name ("dust") + "Completed in 12 sec" meta, then a **tool panel** labelled "USING HUBSPOT" with mono **tool chips** (`get_deal`, `create_note`), each with a green check.
4. **Structured answer**: bold lead-in phrases followed by plain text, in short bulleted sections ("Acme Corp – deal status", "Note logged").
5. **Input bar**: "Ask a follow-up…" with an agent mention chip (`@dust`) and a round blue send button.
6. **Buttons**: primary is blue-500 fill, white text, 8px radius, no heavy shadow. Secondary is white with a stone border.
7. **Chips**: "SEE DUST IN ACTION" pill on blue-50 with a blue dot and blue-700 uppercase text.
8. **Docs nav**: a blue-50 selected pill with blue text, and a right "On this page" rail.

## Voice

Plain, confident, operator-first ("AI that uses your context to do real work"). Short sentences, no hype words. For this concept that means operational nouns (handoff, owner, SLA, field), and every flag cites the record and the rule.

## How the concept applies it

- The tool is framed as a **Dust-style workspace**: the RECENT sidebar lists handoff queues. The main column is a conversation with a synthetic `@handoff-auditor` agent whose answer shows "USING HUBSPOT (SIMULATED)" mono tool chips and structured, cited findings.
- The checks are **deterministic rules over synthetic HubSpot-shaped records**. The "tools" are local functions named after the public HubSpot actions on Dust's integration page (`get_deal`, `list_associations`, `get_object_properties`, `create_task`, `create_note`). No call leaves the browser.
- A persistent footer and header label reads: **"Independent concept by Ayo Ahmed. Not affiliated with Dust."**
- It does not claim or imply a defect in Dust or in any Dust customer's CRM. Every example is synthetic.
