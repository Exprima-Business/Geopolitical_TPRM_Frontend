/**
 * Dismissal rules API client.
 *
 * A dismissal rule is a server-side filter that auto-dismisses incoming agent
 * decisions whose underlying risk event matches every non-null column on the
 * rule (country_code, region, category, severity_max, asset_distance_min_km).
 *
 * Null columns mean "don't filter on this dimension" — a rule with only
 * `severity_max = 3` dismisses any decision whose event severity is ≤ 3,
 * regardless of country, region, etc.
 *
 * Backend endpoints:
 *   GET    /api/v1/companies/{cid}/dismissal-rules
 *   POST   /api/v1/companies/{cid}/dismissal-rules
 *   GET    /api/v1/companies/{cid}/dismissal-rules/{id}
 *   PATCH  /api/v1/companies/{cid}/dismissal-rules/{id}
 *   DELETE /api/v1/companies/{cid}/dismissal-rules/{id}
 *   POST   /api/v1/companies/{cid}/decisions/{decision_id}/dismiss
 */

import { api } from "./api";


export interface DismissalRule {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  country_code: string | null;
  region: string | null;
  category: string | null;
  severity_max: number | null;
  asset_distance_min_km: number | null;
  match_count: number;
  last_matched_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Fields accepted when creating a new rule. All filters are optional. */
export interface DismissalRuleCreate {
  name: string;
  description?: string | null;
  is_enabled?: boolean;
  country_code?: string | null;
  region?: string | null;
  category?: string | null;
  severity_max?: number | null;
  asset_distance_min_km?: number | null;
}

/** PATCH — any subset of the create payload. */
export type DismissalRuleUpdate = Partial<DismissalRuleCreate>;

/** Response from POST /decisions/{id}/dismiss. */
export interface DismissDecisionResult {
  decision: Record<string, unknown>;
  rule: DismissalRule | null;
}

function rulesPath(companyId: string, ruleId?: string): string {
  const base = `/api/v1/companies/${companyId}/dismissal-rules`;
  return ruleId ? `${base}/${ruleId}` : base;
}

export async function listDismissalRules(
  companyId: string,
): Promise<DismissalRule[]> {
  const data = await api.get<unknown>(rulesPath(companyId));
  if (Array.isArray(data)) return data as DismissalRule[];
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? (items as DismissalRule[]) : [];
  }
  return [];
}

export async function createDismissalRule(
  companyId: string,
  data: DismissalRuleCreate,
): Promise<DismissalRule> {
  return api.post<DismissalRule>(rulesPath(companyId), data);
}

export async function updateDismissalRule(
  companyId: string,
  ruleId: string,
  patch: DismissalRuleUpdate,
): Promise<DismissalRule> {
  return api.patch<DismissalRule>(rulesPath(companyId, ruleId), patch);
}

export async function deleteDismissalRule(
  companyId: string,
  ruleId: string,
): Promise<void> {
  await api.delete<unknown>(rulesPath(companyId, ruleId));
}

/**
 * Dismiss an individual agent decision.
 *
 * If `createRuleFromDecision` is true, the backend derives a dismissal rule
 * from the decision's underlying event attributes and persists it atomically
 * with the dismissal. The returned `rule` is either the new rule or null.
 */
export async function dismissDecision(
  companyId: string,
  decisionId: string,
  reason: string,
  createRuleFromDecision: boolean,
): Promise<DismissDecisionResult> {
  return api.post<DismissDecisionResult>(
    `/api/v1/companies/${companyId}/decisions/${decisionId}/dismiss`,
    {
      reason,
      create_rule_from_decision: createRuleFromDecision,
    },
  );
}

/**
 * Human-readable one-liner for the filter columns on a rule. Returns strings
 * like "severity ≤ 5, country = JP" or "matches every alert" when all
 * filters are null.
 */
export function describeRuleFilters(rule: DismissalRule): string {
  const parts: string[] = [];
  if (rule.severity_max != null) parts.push(`severity ≤ ${rule.severity_max}`);
  if (rule.country_code) parts.push(`country = ${rule.country_code}`);
  if (rule.region) parts.push(`region = ${rule.region}`);
  if (rule.category) parts.push(`category = ${rule.category}`);
  if (rule.asset_distance_min_km != null) {
    parts.push(`> ${rule.asset_distance_min_km}km from assets`);
  }
  return parts.length ? parts.join(", ") : "matches every alert";
}

