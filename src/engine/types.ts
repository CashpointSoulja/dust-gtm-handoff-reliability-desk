import type { LeadSource, Segment, Territory } from "./policy";

export const CSV_COLUMNS = [
  "record_id", "email", "first_name", "last_name", "company", "company_domain", "country", "employees", "source",
  "lifecycle_stage", "owner_id", "qualified_at", "first_touch_at", "pain", "budget_confirmed", "champion", "timeline",
  "evidence_source_id", "evidence_captured_at",
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export interface LeadRow {
  row: number; // 1-based data row number in the imported file (header excluded)
  record_id: string; email: string; first_name: string; last_name: string; company: string; company_domain: string;
  country: string; employees: number; source: LeadSource; lifecycle_stage: string; owner_id: string;
  qualified_at: string; first_touch_at: string; pain: string; budget_confirmed: string; champion: string; timeline: string;
  evidence_source_id: string; evidence_captured_at: string;
}

export interface RowError { row: number; column: CsvColumn | "*"; message: string }

export type LeadState =
  | "not_qualified" | "conflict_review" | "ownership_review" | "duplicate_review" | "refused_unknown_territory"
  | "blocked_evidence" | "packet_ready" | "approved" | "written" | "verified" | "verification_failed";

export interface Reason { code: string; detail: string; rule?: string }

export interface SlaInfo {
  owner_tz: string; qualified_at: string; due_at: string; due_local: string;
  status: "met" | "breached" | "overdue" | "open"; minutes_to_due: number;
}

export interface Lead {
  record_id: string;
  rows: number[]; // source rows merged into this record
  data: LeadRow; // resolved record
  territory: Territory | null;
  segment: Segment;
  state: LeadState;
  reasons: Reason[];
  notes: Reason[]; // non-blocking provenance (merges, name-only matches)
  missing_fields: string[];
  current_owner_id: string;
  routed_owner_id: string | null;
  rule_id: string | null;
  sla: SlaInfo | null;
}
