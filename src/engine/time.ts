// Timezone-aware business-hours arithmetic using only Intl (no tz database dependency).

export interface LocalParts { y: number; mo: number; d: number; h: number; mi: number; wd: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try { fmt(tz); return true; } catch { return false; }
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(ms: number, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const x of fmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: WD[p.weekday] };
}

/** UTC offset of `tz` at instant `ms`, in minutes (Paris summer = +120). */
export function offsetMinutes(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** Instant for a local wall-clock time in `tz`. Gaps (spring-forward) resolve forward. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let ms = guess - offsetMinutes(guess, tz) * 60000;
  ms = guess - offsetMinutes(ms, tz) * 60000;
  return ms;
}

export interface BusinessHours { tz: string; startHour: number; endHour: number }

function isWorkday(wd: number): boolean { return wd >= 1 && wd <= 5; }

/** Adds `minutes` of working time (Mon–Fri, startHour–endHour local) to `fromMs`. */
export function addBusinessMinutes(fromMs: number, minutes: number, bh: BusinessHours): number {
  let cur = fromMs;
  let left = minutes;
  for (let guard = 0; guard < 400; guard++) {
    const p = localParts(cur, bh.tz);
    const dayStart = zonedToUtc(p.y, p.mo, p.d, bh.startHour, 0, bh.tz);
    const dayEnd = zonedToUtc(p.y, p.mo, p.d, bh.endHour, 0, bh.tz);
    if (!isWorkday(p.wd) || cur >= dayEnd) { cur = nextDayStart(p, bh); continue; }
    if (cur < dayStart) cur = dayStart;
    const avail = (dayEnd - cur) / 60000;
    if (left <= avail) return cur + left * 60000;
    left -= avail;
    cur = nextDayStart(p, bh);
  }
  throw new Error("addBusinessMinutes: guard exceeded");
}

function nextDayStart(p: LocalParts, bh: BusinessHours): number {
  const noonNext = Date.UTC(p.y, p.mo - 1, p.d + 1, 12, 0);
  const n = new Date(noonNext);
  return zonedToUtc(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), bh.startHour, 0, bh.tz);
}

/** Strict ISO-8601 with explicit offset or Z. Returns ms or null. */
export function parseIsoInstant(s: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s)) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

export function formatLocal(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = offsetMinutes(ms, tz);
  const sign = off >= 0 ? "+" : "-";
  const a = Math.abs(off);
  return `${days[p.wd]} ${p.y}-${pad(p.mo)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)} (UTC${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)})`;
}
