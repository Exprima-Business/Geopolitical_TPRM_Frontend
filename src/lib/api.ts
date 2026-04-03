import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();

  // Try getSession first (cached), fall back to getUser which forces a refresh
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Session may not be hydrated yet — wait for auth state to settle
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      ({ data: { session } } = await supabase.auth.getSession());
    }
  }

  return {
    "Content-Type": "application/json",
    ...(session?.access_token && {
      Authorization: `Bearer ${session.access_token}`,
    }),
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),

  // Typed endpoint helpers
  health: () => request<{ status: string }>("/health"),

  riskEvents: {
    list: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return request<unknown>(`/api/v1/risk-events${qs}`);
    },
    active: () => request<unknown>("/api/v1/risk-events/active"),
    nearby: (lat: number, lon: number, radius_km = 100) =>
      request<unknown>(`/api/v1/risk-events/nearby?latitude=${lat}&longitude=${lon}&radius_km=${radius_km}`),
  },

  companies: (companyId: string) => ({
    assets: {
      list: (params?: Record<string, string>) => {
        const qs = params ? "?" + new URLSearchParams(params).toString() : "?page_size=100";
        return request<unknown>(`/api/v1/companies/${companyId}/assets${qs}`);
      },
      create: (data: unknown) => request<unknown>(`/api/v1/companies/${companyId}/assets`, { method: "POST", body: JSON.stringify(data) }),
    },
    decisions: {
      list: () => request<unknown>(`/api/v1/companies/${companyId}/decisions`),
      pending: () => request<unknown>(`/api/v1/companies/${companyId}/decisions/pending`),
      approve: (decisionId: string, approved: boolean) =>
        request<unknown>(`/api/v1/companies/${companyId}/decisions/${decisionId}/approve`, { method: "POST", body: JSON.stringify({ approved }) }),
    },
    mitigations: {
      list: () => request<unknown>(`/api/v1/companies/${companyId}/mitigations`),
    },
    alertRules: {
      list: () => request<unknown>(`/api/v1/companies/${companyId}/alert-rules`),
    },
    cloudRegions: {
      list: () => request<unknown>(`/api/v1/companies/${companyId}/cloud-regions`),
    },
    riskScores: {
      list: (radiusKm = 500) => request<unknown>(`/api/v1/companies/${companyId}/assets/risk-scores?radius_km=${radiusKm}`),
    },
    agent: {
      trigger: () => request<unknown>(`/api/v1/companies/${companyId}/agent/trigger`, { method: "POST" }),
    },
    connectors: {
      list: () => request<unknown>(`/api/v1/companies/${companyId}/connectors`),
      create: (data: unknown) => request<unknown>(`/api/v1/companies/${companyId}/connectors`, { method: "POST", body: JSON.stringify(data) }),
      update: (connectorId: string, data: unknown) => request<unknown>(`/api/v1/companies/${companyId}/connectors/${connectorId}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (connectorId: string) => request<unknown>(`/api/v1/companies/${companyId}/connectors/${connectorId}`, { method: "DELETE" }),
      sync: (connectorId: string) => request<unknown>(`/api/v1/companies/${companyId}/connectors/${connectorId}/sync`, { method: "POST" }),
    },
  }),
};
