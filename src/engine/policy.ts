// Explicit, versioned routing and qualification policy. Every decision cites a rule id from here.
import type { BusinessHours } from "./time";

export const POLICY_VERSION = "routing-2026.10-v1";
/** Simulated clock: Monday 5 Oct 2026, 17:00 Paris. All "now" comparisons use this instant. */
export const SIM_CLOCK = "2026-10-05T15:00:00Z";

export type Territory = "EMEA-FR" | "EMEA-UKI" | "DACH" | "NORDICS" | "NA";
export type Segment = "SMB" | "MM" | "ENT";
export const SOURCES = ["inbound_demo", "outbound", "event", "partner"] as const;
export type LeadSource = (typeof SOURCES)[number];

export const TERRITORY_BY_COUNTRY: Readonly<Record<string, Territory>> = {
  FR: "EMEA-FR", BE: "EMEA-FR", LU: "EMEA-FR", MC: "EMEA-FR",
  GB: "EMEA-UKI", IE: "EMEA-UKI",
  DE: "DACH", AT: "DACH", CH: "DACH",
  SE: "NORDICS", NO: "NORDICS", DK: "NORDICS", FI: "NORDICS",
  US: "NA", CA: "NA",
};

export function segmentFor(employees: number): Segment {
  if (employees < 200) return "SMB";
  if (employees < 1000) return "MM";
  return "ENT";
}

export interface Owner { id: string; name: string; territory: Territory; tz: string; active: boolean }

export const OWNERS: readonly Owner[] = [
  { id: "o-fr-1", name: "Margaux Lefèvre", territory: "EMEA-FR", tz: "Europe/Paris", active: true },
  { id: "o-fr-2", name: "Julien Bernard", territory: "EMEA-FR", tz: "Europe/Paris", active: true },
  { id: "o-uki-1", name: "Priya Nair", territory: "EMEA-UKI", tz: "Europe/London", active: true },
  { id: "o-uki-2", name: "Tom Ellis", territory: "EMEA-UKI", tz: "Europe/London", active: true },
  { id: "o-dach-1", name: "Lena Fischer", territory: "DACH", tz: "Europe/Berlin", active: true },
  { id: "o-dach-2", name: "Felix Braun", territory: "DACH", tz: "Europe/Berlin", active: true },
  { id: "o-nor-1", name: "Astrid Lund", territory: "NORDICS", tz: "Europe/Stockholm", active: true },
  { id: "o-na-1", name: "Dana Brooks", territory: "NA", tz: "America/New_York", active: true },
  { id: "o-na-2", name: "Marcus Hale", territory: "NA", tz: "America/New_York", active: true },
];

export function ownerById(id: string): Owner | undefined { return OWNERS.find((o) => o.id === id); }

export interface RouteRule { rule_id: string; territory: Territory; segments: readonly Segment[]; owner_id: string }

export const ROUTES: readonly RouteRule[] = [
  { rule_id: "R-FR-SMBMM", territory: "EMEA-FR", segments: ["SMB", "MM"], owner_id: "o-fr-1" },
  { rule_id: "R-FR-ENT", territory: "EMEA-FR", segments: ["ENT"], owner_id: "o-fr-2" },
  { rule_id: "R-UKI-SMBMM", territory: "EMEA-UKI", segments: ["SMB", "MM"], owner_id: "o-uki-1" },
  { rule_id: "R-UKI-ENT", territory: "EMEA-UKI", segments: ["ENT"], owner_id: "o-uki-2" },
  { rule_id: "R-DACH-SMBMM", territory: "DACH", segments: ["SMB", "MM"], owner_id: "o-dach-1" },
  { rule_id: "R-DACH-ENT", territory: "DACH", segments: ["ENT"], owner_id: "o-dach-2" },
  { rule_id: "R-NOR-ALL", territory: "NORDICS", segments: ["SMB", "MM", "ENT"], owner_id: "o-nor-1" },
  { rule_id: "R-NA-SMBMM", territory: "NA", segments: ["SMB", "MM"], owner_id: "o-na-1" },
  { rule_id: "R-NA-ENT", territory: "NA", segments: ["ENT"], owner_id: "o-na-2" },
];

export function routeFor(territory: Territory, segment: Segment): RouteRule | undefined {
  return ROUTES.find((r) => r.territory === territory && r.segments.includes(segment));
}

/** Qualification evidence that must be present before a lead can be handed to an AE. */
export const REQUIRED_EVIDENCE = ["pain", "budget_confirmed", "champion", "timeline", "evidence_source_id", "evidence_captured_at"] as const;
export type EvidenceField = (typeof REQUIRED_EVIDENCE)[number];
export const EVIDENCE_MAX_AGE_DAYS = 14;
export const QUALIFIED_STAGE = "salesqualifiedlead";

/** First-touch SLA: 4 working hours in the receiving owner's timezone, Mon–Fri 09:00–18:00. */
export const SLA_WORK_MINUTES = 240;
export function businessHoursFor(owner: Owner): BusinessHours { return { tz: owner.tz, startHour: 9, endHour: 18 }; }
