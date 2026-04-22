/**
 * Connection storage + simulated connection test.
 *
 * Test messages reference the real endpoint (method, path, absoluteUrl) that
 * a backend executor would actually call. The simulation is intentionally
 * thin — it validates required fields + regex patterns and returns the
 * provider-specific endpoint spec so the UI can show a faithful trace.
 */

import type { IntegrationSpec, EndpointSpec } from "./integrations";
import { findIntegration, resolveBaseUrl } from "./integrations";

export type ConnectionStatus = "connected" | "error" | "untested";

export interface IntegrationConnection {
  id: string;
  integration_id: string;
  display_name: string;
  credentials: Record<string, string>;
  status: ConnectionStatus;
  last_tested_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY_PREFIX = "tprm:integration_connections:";

function storageKey(companyId: string): string {
  return `${STORAGE_KEY_PREFIX}${companyId}`;
}

export function loadConnections(companyId: string): IntegrationConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntegrationConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveConnections(
  companyId: string,
  connections: IntegrationConnection[]
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(companyId), JSON.stringify(connections));
}

export function createConnection(
  companyId: string,
  integrationId: string,
  displayName: string,
  credentials: Record<string, string>
): IntegrationConnection {
  const now = new Date().toISOString();
  const connection: IntegrationConnection = {
    id: `conn_${Date.now()}`,
    integration_id: integrationId,
    display_name: displayName,
    credentials,
    status: "untested",
    last_tested_at: null,
    last_error: null,
    created_at: now,
    updated_at: now,
  };
  const existing = loadConnections(companyId);
  saveConnections(companyId, [...existing, connection]);
  return connection;
}

export function updateConnection(
  companyId: string,
  id: string,
  patch: Partial<IntegrationConnection>
): IntegrationConnection | null {
  const connections = loadConnections(companyId);
  const idx = connections.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const next: IntegrationConnection = {
    ...connections[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  connections[idx] = next;
  saveConnections(companyId, connections);
  return next;
}

export function deleteConnection(companyId: string, id: string): void {
  const connections = loadConnections(companyId);
  saveConnections(companyId, connections.filter((c) => c.id !== id));
}

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

export interface TestResult {
  ok: boolean;
  /** Short human-readable status. */
  message: string;
  /** Longer detail, ideally including the endpoint that would be called. */
  detail?: string;
  /** The endpoint that would be / was called. */
  endpoint?: { method: string; url: string; docsUrl: string };
}

/**
 * Simulated connection test.
 *
 * This does NOT make network calls from the browser — that would be blocked
 * by CORS and would leak credentials. In production, this call forwards to a
 * backend executor that calls `testEndpoint` server-side with credentials
 * decrypted from storage. The frontend-only simulation here:
 *
 *  1. Validates required fields and regex patterns.
 *  2. Resolves the real endpoint (method, URL) per the spec.
 *  3. Returns a result that references that endpoint, so the UI shows a
 *     faithful trace of what the backend would do.
 */
export async function testConnection(
  integrationId: string,
  credentials: Record<string, string>
): Promise<TestResult> {
  const spec = findIntegration(integrationId);
  if (!spec) return { ok: false, message: "Unknown integration" };

  const errors = validateCredentials(spec, credentials);
  if (errors.length > 0) {
    return { ok: false, message: "Invalid credentials", detail: errors.join("; ") };
  }

  await new Promise((r) => setTimeout(r, 500 + Math.random() * 700));

  if (!spec.testEndpoint) {
    return {
      ok: true,
      message: "Credentials valid (no test endpoint defined)",
      detail: "This provider has no side-effect-free probe; credentials will be validated on first use.",
    };
  }

  const url = resolveEndpointUrl(spec, spec.testEndpoint, credentials);
  const endpointInfo = {
    method: spec.testEndpoint.method,
    url,
    docsUrl: spec.testEndpoint.docsUrl,
  };

  // Provider-specific success messaging. These reference documented response
  // codes / bodies for the actual test endpoint called above.
  const providerMessage: Record<string, { message: string; detail: string }> = {
    slack: {
      message: "Webhook reachable (simulated)",
      detail: `POST ${url} with { text: "TPRM connection test" } → Slack returns 200 "ok".`,
    },
    teams: {
      message: "Workflows webhook reachable (simulated)",
      detail: `POST ${url} with a minimal Adaptive Card → Azure Logic Apps returns 202 Accepted.`,
    },
    sendgrid: {
      message: "API key valid (simulated)",
      detail: `GET ${url} → returns 200 with JSON array of scopes (e.g. ["mail.send"]).`,
    },
    smtp: {
      message: "SMTP handshake successful (simulated)",
      detail: `EHLO ${credentials.host || "<host>"}:${credentials.port || "587"} → STARTTLS → AUTH PLAIN → QUIT. RFC 5321 / RFC 3207.`,
    },
    servicenow: {
      message: "Instance reachable (simulated)",
      detail: `GET ${url} → returns 200 with one sys_user record. Validates Basic auth.`,
    },
    jira: {
      message: "Authentication successful (simulated)",
      detail: `GET ${url} → returns 200 with the current user's Atlassian account details.`,
    },
    pagerduty: {
      message: "Routing key accepted (simulated)",
      detail: `POST ${url} with { routing_key, event_action: "resolve", dedup_key } → returns 202 Accepted. No visible incident created.`,
    },
    salesforce: {
      message: "OAuth token obtained (simulated)",
      detail: `POST ${url} (grant_type=password) → returns 200 with { access_token, instance_url, ... }.`,
    },
    okta: {
      message: "API token valid (simulated)",
      detail: `GET ${url} → returns 200 with an array containing one User object.`,
    },
    aws: {
      message: "SigV4 identity confirmed (simulated)",
      detail: `POST ${url} (Action=GetCallerIdentity) → returns <GetCallerIdentityResult> XML with the account ID and ARN.`,
    },
    azure: {
      message: "Azure AD token obtained (simulated)",
      detail: `POST ${url} (grant_type=client_credentials, scope=https://management.azure.com/.default) → returns 200 with { access_token, expires_in }.`,
    },
    webhook: {
      message: "Endpoint reachable (simulated)",
      detail: `POST ${url} with { test: true } → any 2xx response is treated as success.`,
    },
  };

  const info = providerMessage[integrationId] ?? {
    message: "Connection succeeded (simulated)",
    detail: `${spec.testEndpoint.method} ${url}`,
  };

  return {
    ok: true,
    message: info.message,
    detail: info.detail,
    endpoint: endpointInfo,
  };
}
