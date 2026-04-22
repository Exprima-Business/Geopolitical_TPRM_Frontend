/**
 * Integration connection API client.
 *
 * Thin wrapper around the backend endpoints at /api/v1/companies/{id}/integrations.
 * Credentials are encrypted server-side (Fernet) and never returned.
 *
 * The `testConnection` helper calls the backend adapter which actually hits
 * the provider's real API (ServiceNow /sys_user, Jira /myself, STS
 * GetCallerIdentity, etc.) using the decrypted credentials.
 */

import type { IntegrationSpec, EndpointSpec } from "./integrations";
import { findIntegration, resolveBaseUrl } from "./integrations";
import { api } from "./api";

export type ConnectionStatus = "connected" | "error" | "untested";

export interface IntegrationConnection {
  id: string;
  company_id: string;
  integration_id: string;
  display_name: string;
  config: Record<string, unknown> | null;
  is_enabled: boolean;
  status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  ok: boolean;
  message: string;
  detail?: string | null;
  request_method?: string | null;
  request_url?: string | null;
  response_status?: number | null;
  duration_ms?: number | null;
}

export async function loadConnections(companyId: string): Promise<IntegrationConnection[]> {
  const data = await api.companies(companyId).integrations.list();
  return Array.isArray(data) ? (data as IntegrationConnection[]) : [];
}

export async function createConnection(
  companyId: string,
  integrationId: string,
  displayName: string,
  credentials: Record<string, string>,
  config: Record<string, unknown> | null = null
): Promise<IntegrationConnection> {
  return (await api.companies(companyId).integrations.create({
    integration_id: integrationId,
    display_name: displayName,
    credentials,
    config,
  })) as IntegrationConnection;
}

export async function updateConnection(
  companyId: string,
  connectionId: string,
  patch: {
    display_name?: string;
    credentials?: Record<string, string>;
    config?: Record<string, unknown> | null;
    is_enabled?: boolean;
  }
): Promise<IntegrationConnection> {
  return (await api
    .companies(companyId)
    .integrations.update(connectionId, patch)) as IntegrationConnection;
}

export async function deleteConnection(companyId: string, connectionId: string): Promise<void> {
  await api.companies(companyId).integrations.delete(connectionId);
}

/** Call the backend's POST /integrations/{id}/test — hits the real provider API. */
export async function testStoredConnection(
  companyId: string,
  connectionId: string
): Promise<TestResult> {
  return (await api.companies(companyId).integrations.test(connectionId)) as TestResult;
}

/**
 * Local credential-shape validation (required fields, regex patterns, email format).
 * Runs client-side before sending the Create/Update request so the user sees
 * field errors without a round trip.
 */
export function validateCredentials(
  spec: IntegrationSpec,
  credentials: Record<string, string>
): string[] {
  const errors: string[] = [];
  for (const field of spec.fields) {
    const value = (credentials[field.key] ?? "").trim();
    if (field.required && !value) {
      errors.push(`${field.label} is required`);
      continue;
    }
    if (!value) continue;
    if (field.pattern) {
      const re = new RegExp(field.pattern);
      if (!re.test(value)) {
        errors.push(`${field.label} does not match the expected format`);
      }
    }
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push(`${field.label} must be a valid email address`);
    }
  }
  return errors;
}

/** Fill {{field}} placeholders from credentials. Missing fields stay as-is. */
function substitute(template: string, credentials: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => credentials[key] ?? `{{${key}}}`);
}

/** Compute the fully-resolved URL an executor would POST/GET for an endpoint. */
export function resolveEndpointUrl(
  spec: IntegrationSpec,
  endpoint: EndpointSpec,
  credentials: Record<string, string>
): string {
  if (endpoint.absoluteUrl) {
    return substitute(endpoint.absoluteUrl, credentials);
  }
  const base = resolveBaseUrl(spec, credentials);
  const path = substitute(endpoint.path, credentials);
  if (!base) return path;
  if (!path) return base;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
