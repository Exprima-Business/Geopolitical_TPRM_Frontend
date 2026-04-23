/**
 * Feature flag API client.
 *
 * Feature flags are globally defined (key + description + default_value) and
 * can be overridden per-company. The resolved list returned by `listFlags`
 * merges the two: each entry reports its current boolean `value` plus a
 * `source` of 'default' or 'company_override' so the UI can surface which
 * flags the workspace has customized.
 *
 * Already seeded backend flags (default false for both):
 *   - decision_dismissal_enabled
 *   - third_party_view_enabled
 */

import { api } from "./api";

export interface FeatureFlagState {
  key: string;
  value: boolean;
  source: "default" | "company_override";
  description?: string;
}

export interface GlobalFeatureFlag {
  key: string;
  description: string;
  default_value: boolean;
}

/** Resolved flag state for a company (default merged with overrides). */
export async function listFlags(companyId: string): Promise<FeatureFlagState[]> {
  const data = await api.get<FeatureFlagState[]>(
    `/api/v1/companies/${companyId}/feature-flags`
  );
  return Array.isArray(data) ? data : [];
}

/** Set a company-level override for the given flag. */
export async function setFlag(
  companyId: string,
  key: string,
  value: boolean
): Promise<void> {
  await api.put<unknown>(
    `/api/v1/companies/${companyId}/feature-flags/${encodeURIComponent(key)}`,
    { key, value }
  );
}

/** Remove the company override, reverting the flag to its global default. */
export async function unsetFlag(companyId: string, key: string): Promise<void> {
  await api.delete<unknown>(
    `/api/v1/companies/${companyId}/feature-flags/${encodeURIComponent(key)}`
  );
}

/** Admin-only: list all globally-defined flags. */
export async function listGlobalFlags(): Promise<GlobalFeatureFlag[]> {
  const data = await api.get<GlobalFeatureFlag[]>("/api/v1/feature-flags");
  return Array.isArray(data) ? data : [];
}

/** Admin-only: define a new global flag. */
export async function createGlobalFlag(
  key: string,
  description: string,
  default_value: boolean
): Promise<GlobalFeatureFlag> {
  return await api.post<GlobalFeatureFlag>("/api/v1/feature-flags", {
    key,
    description,
    default_value,
  });
}
