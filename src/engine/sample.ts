// Synthetic data only. Companies use the reserved .example TLD; people are fictional.
import { CSV_COLUMNS } from "./types";
import { toCsv } from "./csv";
import type { CohortCell } from "./cohort";

type R = Record<(typeof CSV_COLUMNS)[number], string>;
const base = (o: Partial<R>): R => ({
  record_id: "", email: "", first_name: "", last_name: "", company: "", company_domain: "", country: "", employees: "",
  source: "inbound_demo", lifecycle_stage: "salesqualifiedlead", owner_id: "", qualified_at: "", first_touch_at: "",
  pain: "", budget_confirmed: "yes", champion: "", timeline: "", evidence_source_id: "", evidence_captured_at: "", ...o,
});

const ROWS: R[] = [
  base({ record_id: "100101", email: "camille.martin@pinecrest.example", first_name: "Camille", last_name: "Martin", company: "Pinecrest SAS", company_domain: "pinecrest.example", country: "FR", employees: "120", qualified_at: "2026-10-02T17:30:00+02:00", pain: "QBR prep takes two days across four tools", champion: "Camille Martin, Head of RevOps", timeline: "Pilot before Q1 2027", evidence_source_id: "note-7001", evidence_captured_at: "2026-10-02T17:10:00+02:00" }),
  base({ record_id: "100102", email: "oliver.hughes@larkspur.example", first_name: "Oliver", last_name: "Hughes", company: "Larkspur Ltd", company_domain: "larkspur.example", country: "GB", employees: "650", source: "outbound", qualified_at: "2026-10-05T09:15:00+01:00", first_touch_at: "2026-10-05T11:02:00+01:00", pain: "Reps rebuild account context before every renewal call", champion: "Oliver Hughes, VP Sales", timeline: "Decision in November", evidence_source_id: "note-7002", evidence_captured_at: "2026-10-05T09:00:00+01:00" }),
  base({ record_id: "100103", email: "hanna.weber@brightloom.example", first_name: "Hanna", last_name: "Weber", company: "Brightloom GmbH", company_domain: "brightloom.example", country: "DE", employees: "2400", source: "event", qualified_at: "2026-10-05T14:30:00+02:00", pain: "Security questionnaires block deals for weeks", champion: "Hanna Weber, Director Sales Ops", timeline: "Budget cycle closes 15 Dec", evidence_source_id: "note-7003", evidence_captured_at: "2026-10-05T14:05:00+02:00" }),
  base({ record_id: "100104", email: "james.carter@northgate.example", first_name: "James", last_name: "Carter", company: "Northgate Insurance", company_domain: "northgate.example", country: "GB", employees: "1500", owner_id: "o-uki-1", qualified_at: "2026-10-05T08:30:00+01:00", pain: "Broker onboarding questions answered by hand", champion: "James Carter, COO", timeline: "Q1 2027", evidence_source_id: "note-7004", evidence_captured_at: "2026-10-05T08:10:00+01:00" }),
  base({ record_id: "100105", email: "lucas.moreau@ateliersul.example", first_name: "Lucas", last_name: "Moreau", company: "Atelier Sul", company_domain: "ateliersul.example", country: "BR", employees: "90", source: "partner", qualified_at: "2026-10-05T10:00:00-03:00", pain: "Partner asks for Portuguese support content", champion: "Lucas Moreau, CEO", timeline: "This quarter", evidence_source_id: "note-7005", evidence_captured_at: "2026-10-05T09:30:00-03:00" }),
  base({ record_id: "100106", email: "chloe.dubois@verdant.example", first_name: "Chloé", last_name: "Dubois", company: "Verdant Analytics", company_domain: "verdant.example", country: "FR", employees: "320", qualified_at: "2026-10-05T11:00:00+02:00", pain: "Pipeline reviews rely on stale spreadsheets", budget_confirmed: "", champion: "", timeline: "Exploring for 2027", evidence_source_id: "note-7006", evidence_captured_at: "2026-10-05T10:40:00+02:00" }),
  base({ record_id: "100107", email: "noah.becker@halden.example", first_name: "Noah", last_name: "Becker", company: "Halden Logistik", company_domain: "halden.example", country: "AT", employees: "800", source: "outbound", qualified_at: "2026-10-05T09:00:00+02:00", pain: "Dispatch team searches three wikis", champion: "Noah Becker, Head of Ops", timeline: "Q2 2027", evidence_source_id: "note-6110", evidence_captured_at: "2026-08-20T10:00:00+02:00" }),
  base({ record_id: "100108", email: "ava.thompson@brookfield.example", first_name: "Ava", last_name: "Thompson", company: "Brookfield Dental", company_domain: "brookfield.example", country: "US", employees: "60", owner_id: "o-na-2", qualified_at: "2026-10-05T09:30:00-04:00", pain: "Front-desk FAQs eat clinician time", champion: "Ava Thompson, Practice Manager", timeline: "Next month", evidence_source_id: "note-7008", evidence_captured_at: "2026-10-05T09:05:00-04:00" }),
  base({ record_id: "100109", email: "ines.garcia@solano.example", first_name: "Inés", last_name: "García", company: "Solano Retail", company_domain: "solano.example", country: "FR", employees: "45", source: "event", lifecycle_stage: "marketingqualifiedlead", qualified_at: "2026-10-04T12:00:00+02:00", budget_confirmed: "" }),
  base({ record_id: "100110", email: "sofia.rossi@quarry.example", first_name: "Sofia", last_name: "Rossi", company: "Quarry Labs", company_domain: "quarry.example", country: "SE", employees: "150", source: "partner", qualified_at: "2026-10-05T08:00:00+02:00", first_touch_at: "2026-10-05T09:40:00+02:00", pain: "Lab notes not searchable", champion: "Sofia Rossi, CTO", timeline: "Q4 2026", evidence_source_id: "note-7010", evidence_captured_at: "2026-10-05T07:50:00+02:00" }),
  base({ record_id: "100111", email: "s.rossi@quarrylabs.example", first_name: "Sofia", last_name: "Rossi", company: "Quarry Labs", company_domain: "quarrylabs.example", country: "DK", employees: "150", source: "event", qualified_at: "2026-10-05T10:00:00+02:00", pain: "Grant reporting is manual", champion: "Sofia Rossi, Research Lead", timeline: "2027", evidence_source_id: "note-7011", evidence_captured_at: "2026-10-05T09:55:00+02:00" }),
  base({ record_id: "100112", email: "ben.okafor@meridiantrust.example", first_name: "Ben", last_name: "Okafor", company: "Meridian Trust", company_domain: "meridiantrust.example", country: "IE", employees: "410", qualified_at: "2026-10-05T10:00:00+01:00", pain: "Advisers re-key client notes", champion: "Ben Okafor, Head of Client Ops", timeline: "Q1 2027", evidence_source_id: "note-7012", evidence_captured_at: "2026-10-05T09:45:00+01:00" }),
  base({ record_id: "100113", email: "ben.okafor@meridiantrust.example", first_name: "Benjamin", last_name: "Okafor", company: "Meridian Trust Ltd", company_domain: "meridiantrust.example", country: "IE", employees: "410", source: "event", qualified_at: "2026-10-05T11:00:00+01:00", pain: "Advisers re-key client notes", champion: "Ben Okafor", timeline: "Q1 2027", evidence_source_id: "note-7013", evidence_captured_at: "2026-10-05T10:50:00+01:00" }),
  base({ record_id: "100114", email: "liam.at.example", first_name: "Liam", last_name: "Walsh", company: "Harbour Studio", company_domain: "harbour.example", country: "IE", employees: "30", qualified_at: "2026-10-05 10:00", pain: "x", champion: "Liam Walsh", timeline: "Q1", evidence_source_id: "note-7014", evidence_captured_at: "2026-10-05T09:00:00+01:00" }),
  base({ record_id: "100115", email: "ethan.park@copperline.example", first_name: "Ethan", last_name: "Park", company: "Copperline Health", company_domain: "copperline.example", country: "US", employees: "450", owner_id: "o-na-1", qualified_at: "2026-10-02T16:45:00-04:00", pain: "Clinical ops policies scattered across drives", champion: "Ethan Park, VP Operations", timeline: "Contract by January", evidence_source_id: "note-7015", evidence_captured_at: "2026-10-02T16:30:00-04:00" }),
  base({ record_id: "100116", email: "elena.svensson@fjordline.example", first_name: "Elena", last_name: "Svensson", company: "Fjordline AB", company_domain: "fjordline.example", country: "SE", employees: "340", source: "partner", qualified_at: "2026-10-03T11:30:00+02:00", first_touch_at: "2026-10-05T10:20:00+02:00", pain: "Support macros out of date", champion: "Elena Svensson, Support Director", timeline: "Q2 2027", evidence_source_id: "note-7016", evidence_captured_at: "2026-10-01T10:00:00+02:00" }),
];

// Replays and conflicts appended as later rows, as an export from two sources would produce.
const EXTRA: R[] = [
  { ...ROWS[2] }, // 100103 exact replay
  { ...ROWS[3], owner_id: "o-uki-2" }, // 100104 ownership conflict
  { ...ROWS[15], timeline: "Q1 2027", evidence_source_id: "note-7017", evidence_captured_at: "2026-10-03T11:00:00+02:00" }, // 100116 newer evidence
];

export const SAMPLE_CSV = toCsv([[...CSV_COLUMNS], ...[...ROWS, ...EXTRA].map((r) => CSV_COLUMNS.map((c) => r[c]))]);
export const SAMPLE_FILENAME = "synthetic-sql-handoffs-2026-10-05.csv";

/** Synthetic prior-period aggregates (not derived from the import) used for the cohort counterexample. */
export const SAMPLE_COHORTS: CohortCell[] = [
  { cohort: "2026-Q2", segment: "inbound_demo", leads: 100, converted: 40 },
  { cohort: "2026-Q2", segment: "outbound", leads: 300, converted: 30 },
  { cohort: "2026-Q3", segment: "inbound_demo", leads: 300, converted: 114 },
  { cohort: "2026-Q3", segment: "outbound", leads: 100, converted: 9 },
];
