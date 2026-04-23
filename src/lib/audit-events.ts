/**
 * Audit event API client.
 *
 * Thin wrapper around the backend endpoints at
 *   /api/v1/companies/{id}/audit-events
 * The backend table is append-only — inserts are the only allowed write; an
 * UPDATE/DELETE trigger raises at the DB layer — so this client intentionally
 * exposes only list + export.
 */

import { api } from "./api";

export type ActorType = "user" | "agent" | "system" | "integration";

export interface AuditEvent {
  id: string;
  company_id: string;
  actor_type: ActorType;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditEventListParams {
  page: number;
  page_size: number;
  actor_type?: ActorType;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  actor_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  page_size: number;
}

/**
 * Build a URLSearchParams from an AuditEventListParams. Skips empty /
 * undefined values so the backend sees only real filters.
 */
function buildQuery(params: AuditEventListParams): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  if (params.actor_type) qs.set("actor_type", params.actor_type);
  if (params.action) qs.set("action", params.action);
  if (params.resource_type) qs.set("resource_type", params.resource_type);
  if (params.resource_id) qs.set("resource_id", params.resource_id);
  if (params.actor_id) qs.set("actor_id", params.actor_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  return qs;
}

export async function listAuditEvents(
  companyId: string,
  params: AuditEventListParams
): Promise<PaginatedResponse<AuditEvent>> {
  const qs = buildQuery(params).toString();
  return api.get<PaginatedResponse<AuditEvent>>(
    `/api/v1/companies/${companyId}/audit-events?${qs}`
  );
}

/**
 * Trigger a CSV download of the full audit log.
 *
 * The backend's export endpoint requires a Supabase JWT in the Authorization
 * header, which a plain `<a href>` download can't supply. We fetch the
 * stream with the bearer token, pipe it through a Blob, and kick off a
 * browser download via a temporary anchor. The browser's default "Save
 * As…" dialog then runs.
 */
export async function downloadAuditEventsCsv(
  companyId: string,
  params: Omit<AuditEventListParams, "page" | "page_size">
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  const qs = new URLSearchParams();
  if (params.actor_type) qs.set("actor_type", params.actor_type);
  if (params.action) qs.set("action", params.action);
  if (params.resource_type) qs.set("resource_type", params.resource_type);
  if (params.resource_id) qs.set("resource_id", params.resource_id);
  if (params.actor_id) qs.set("actor_id", params.actor_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  const query = qs.toString();

  const url = `${apiUrl}/api/v1/companies/${companyId}/audit-events/export${
    query ? `?${query}` : ""
  }`;

  const res = await fetch(url, {
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {},
  });
  if (!res.ok) {
    throw new Error(`Export failed: ${res.status} ${await res.text()}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.download = `audit-events-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
