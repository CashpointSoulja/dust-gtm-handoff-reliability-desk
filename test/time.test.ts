import { describe, expect, it } from "vitest";
import { addBusinessMinutes, formatLocal, offsetMinutes, parseIsoInstant, zonedToUtc } from "../src/engine/time";

const PARIS = { tz: "Europe/Paris", startHour: 9, endHour: 18 };
const NY = { tz: "America/New_York", startHour: 9, endHour: 18 };
const iso = (ms: number) => new Date(ms).toISOString();

describe("timestamps and business hours", () => {
  it("rejects timestamps without an explicit offset", () => {
    expect(parseIsoInstant("2026-10-05 10:00")).toBeNull();
    expect(parseIsoInstant("2026-10-05T10:00:00")).toBeNull();
    expect(parseIsoInstant("2026-10-05T10:00:00+02:00")).toBe(Date.parse("2026-10-05T08:00:00Z"));
  });
  it("knows Paris offsets either side of the October DST change", () => {
    expect(offsetMinutes(Date.parse("2026-10-24T12:00:00Z"), "Europe/Paris")).toBe(120);
    expect(offsetMinutes(Date.parse("2026-10-26T12:00:00Z"), "Europe/Paris")).toBe(60);
    expect(iso(zonedToUtc(2026, 10, 26, 9, 0, "Europe/Paris"))).toBe("2026-10-26T08:00:00.000Z");
  });
  it("Friday 17:30 Paris + 4 working hours = Monday 12:30 Paris", () => {
    expect(iso(addBusinessMinutes(Date.parse("2026-10-02T17:30:00+02:00"), 240, PARIS))).toBe("2026-10-05T10:30:00.000Z");
  });
  it("carries across the DST weekend: Fri 16:00 CEST + 4h = Mon 11:00 CET", () => {
    const due = addBusinessMinutes(Date.parse("2026-10-23T16:00:00+02:00"), 240, PARIS);
    expect(iso(due)).toBe("2026-10-26T10:00:00.000Z");
    expect(formatLocal(due, "Europe/Paris")).toBe("Mon 2026-10-26 11:00 (UTC+01:00)");
  });
  it("Saturday qualification starts the clock Monday 09:00 local", () => {
    expect(iso(addBusinessMinutes(Date.parse("2026-10-03T11:30:00+02:00"), 240, { tz: "Europe/Stockholm", startHour: 9, endHour: 18 }))).toBe("2026-10-05T11:00:00.000Z");
  });
  it("before-hours qualification starts at 09:00; exactly 18:00 rolls to the next workday", () => {
    expect(iso(addBusinessMinutes(Date.parse("2026-10-05T07:00:00+02:00"), 60, PARIS))).toBe("2026-10-05T08:00:00.000Z");
    expect(iso(addBusinessMinutes(Date.parse("2026-10-05T18:00:00+02:00"), 60, PARIS))).toBe("2026-10-06T08:00:00.000Z");
  });
  it("New York spring-forward Monday", () => {
    // 2027-03-14 is the US DST start (Sunday). Friday 17:00 EST + 2h = Monday 10:00 EDT = 14:00Z.
    expect(iso(addBusinessMinutes(Date.parse("2027-03-12T17:00:00-05:00"), 120, NY))).toBe("2027-03-15T14:00:00.000Z");
  });
});
