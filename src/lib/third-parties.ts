/**
 * Third-party vendor API client.
 *
 * Thin wrapper around the backend endpoints at
 *   /api/v1/companies/{cid}/third-parties
 * including vendor risk scores and downstream impact (BFS).
 *
 * Field shapes mirror the backend `ThirdPartyResponse` and
 * `VendorRiskScoreResponse` schemas.
 */

import { api } from "./api";

export type ThirdPartyTier = "critical" | "high" | "medium" | "low";

export type VendorScoreSource =
  | "security_scorecard"
  | "bitsight"
  | "upguard"
  | "riskiq"
  | "manual";

export interface ThirdParty {
  id: string;
  company_id: string;
  name: string;
  tier: ThirdPartyTier;
  industry: string | null;
  country_code: string | null;
  website: string | null;
  contact_email: string | null;
  security_score: number | null;
  security_score_source: VendorScoreSource | null;
  security_score_updated_at: string | null;
  sla_terms: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThirdPartyCreate {
  name: string;
  tier: ThirdPartyTier;
  industry?: string | null;
  country_code?: string | null;
  website?: string | null;
  contact_email?: string | null;
  sla_terms?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface ThirdPartyUpdate {
  name?: string;
  tier?: ThirdPartyTier;
  industry?: string | null;
  country_code?: string | null;
  website?: string | null;
  contact_email?: string | null;
  sla_terms?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
}

export interface VendorRiskScore {
  id: string;
  third_party_id: string;
  source: VendorScoreSource;
  score: number;
  grade: string | null;
  findings: string | null;
  raw_payload: Record<string, unknown> | null;
  snapshot_at: string;
  created_at: string;
}

export interface VendorRiskScoreCreate {
  source: VendorScoreSource;
  score: number;
  grade?: string | null;
  findings?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

export interface DownstreamAsset {
  id: string;
  name: string;
  asset_type?: string | null;
  criticality?: string | null;
}

export interface DownstreamSubVendor {
  id: string;
  name: string;
  tier?: ThirdPartyTier | null;
  relationship?: string | null;
}

/**
 * Response shape for GET /third-parties/{id}/downstream.
 * The backend does a BFS starting from the vendor, collecting every asset
 * it supports (directly or transitively) and every sub-vendor it depends on.
 */
export interface DownstreamImpact {
  third_party_id: string;
  assets: DownstreamAsset[];
  sub_vendors: DownstreamSubVendor[];
  depth?: number;
}

export interface ThirdPartyFilters {
  tier?: ThirdPartyTier;
  industry?: string;
  country_code?: string;
}

function buildQuery(filters?: ThirdPartyFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.industry) params.set("industry", filters.industry);
  if (filters.country_code) params.set("country_code", filters.country_code);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function basePath(companyId: string): string {
  return `/api/v1/companies/${companyId}/third-parties`;
}

/* ── Third-party CRUD ───────────────────────────────────── */

export async function listThirdParties(
  companyId: string,
  filters?: ThirdPartyFilters
): Promise<ThirdParty[]> {
  const data = await api.get<ThirdParty[] | { items?: ThirdParty[] }>(
    `${basePath(companyId)}${buildQuery(filters)}`
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

export async function getThirdParty(
  companyId: string,
  thirdPartyId: string
): Promise<ThirdParty> {
  return api.get<ThirdParty>(`${basePath(companyId)}/${thirdPartyId}`);
}

export async function createThirdParty(
  companyId: string,
  body: ThirdPartyCreate
): Promise<ThirdParty> {
  return api.post<ThirdParty>(basePath(companyId), body);
}

export async function updateThirdParty(
  companyId: string,
  thirdPartyId: string,
  patch: ThirdPartyUpdate
): Promise<ThirdParty> {
  return api.patch<ThirdParty>(`${basePath(companyId)}/${thirdPartyId}`, patch);
}

export async function deleteThirdParty(
  companyId: string,
  thirdPartyId: string
): Promise<void> {
  await api.delete<void>(`${basePath(companyId)}/${thirdPartyId}`);
}

/* ── Downstream impact ──────────────────────────────────── */

export async function getDownstream(
  companyId: string,
  thirdPartyId: string
): Promise<DownstreamImpact> {
  return api.get<DownstreamImpact>(
    `${basePath(companyId)}/${thirdPartyId}/downstream`
  );
}

/* ── Vendor risk scores ─────────────────────────────────── */

export async function recordScore(
  companyId: string,
  thirdPartyId: string,
  body: VendorRiskScoreCreate
): Promise<VendorRiskScore> {
  return api.post<VendorRiskScore>(
    `${basePath(companyId)}/${thirdPartyId}/scores`,
    body
  );
}

export async function listScores(
  companyId: string,
  thirdPartyId: string
): Promise<VendorRiskScore[]> {
  const data = await api.get<VendorRiskScore[] | { items?: VendorRiskScore[] }>(
    `${basePath(companyId)}/${thirdPartyId}/scores`
  );
  if (Array.isArray(data)) return data;
  return data?.items ?? [];
}

export async function latestScore(
  companyId: string,
  thirdPartyId: string
): Promise<VendorRiskScore | null> {
  try {
    return await api.get<VendorRiskScore>(
      `${basePath(companyId)}/${thirdPartyId}/scores/latest`
    );
  } catch {
    // 404 when no score has been recorded yet.
    return null;
  }
}

/* ── UI utilities ───────────────────────────────────────── */

/**
 * Standard tier-to-badge-variant mapping used across the list and detail
 * pages so severity colors stay consistent.
 */
export function tierBadgeVariant(
  tier: ThirdPartyTier
): "critical" | "high" | "medium" | "low" {
  return tier;
}

/**
 * Convert a score (0–100) to a letter grade roughly matching the grading
 * used by SecurityScorecard / BitSight. Prefer the grade returned by the
 * source if present; this is a fallback.
 */
export function scoreToGrade(score: number | null | undefined): string {
  if (score == null) return "—";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/** Tailwind color classes for a score — green good, red bad. */
export function scoreColorClass(score: number | null | undefined): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 90) return "text-emerald-400";
  if (score >= 80) return "text-lime-400";
  if (score >= 70) return "text-yellow-400";
  if (score >= 60) return "text-orange-400";
  return "text-red-400";
}

/**
 * Render an ISO 2-letter country code as a flag emoji. Returns empty
 * string for invalid codes so callers can safely concat with a label.
 */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "";
  const cc = code.toUpperCase();
  // Regional indicator symbols start at U+1F1E6 for 'A'.
  const A = 0x1f1e6;
  return (
    String.fromCodePoint(A + (cc.charCodeAt(0) - 65)) +
    String.fromCodePoint(A + (cc.charCodeAt(1) - 65))
  );
}

/** Days since a given ISO timestamp, for "updated X days ago" labels. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

/**
 * Commonly-referenced vendor countries. The filter dropdown uses this
 * list as a convenience, but users can still enter free-form ISO codes
 * via the text fallback.
 */
export const COMMON_COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "IN", label: "India" },
  { code: "SG", label: "Singapore" },
  { code: "JP", label: "Japan" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "IL", label: "Israel" },
  { code: "CN", label: "China" },
];

export const SCORE_SOURCE_OPTIONS: {
  value: VendorScoreSource;
  label: string;
}[] = [
  { value: "security_scorecard", label: "SecurityScorecard" },
  { value: "bitsight", label: "BitSight" },
  { value: "upguard", label: "UpGuard" },
  { value: "riskiq", label: "RiskIQ" },
  { value: "manual", label: "Manual" },
];
