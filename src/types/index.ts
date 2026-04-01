export interface RiskEventRawData {
  event_code?: string;
  event_base_code?: string;
  event_root_code?: string;
  quad_class?: string;
  goldstein_scale?: number;
  num_mentions?: number;
  num_sources?: number;
  num_articles?: number;
  avg_tone?: number;
  source_url?: string;
  actor1_name?: string;
  actor1_country?: string;
  actor1_type?: string;
  actor2_name?: string;
  actor2_country?: string;
  actor2_type?: string;
}

export interface RiskEvent {
  id: string;
  source: string;
  source_id: string;
  category: string;
  subcategory: string | null;
  title: string;
  description: string;
  severity: number;
  confidence: number;
  latitude: number | null;
  longitude: number | null;
  affected_radius_km: number | null;
  country_code: string | null;
  region: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  raw_data?: RiskEventRawData | null;
}

export interface Asset {
  id: string;
  company_id: string;
  name: string;
  asset_type: string;
  address?: string;
  latitude: number;
  longitude: number;
  cloud_provider?: string;
  cloud_region?: string;
  criticality: "low" | "medium" | "high" | "critical";
  created_at: string;
}

export interface Decision {
  id: string;
  company_id: string;
  decision_type: string;
  status: "pending" | "approved" | "rejected";
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Mitigation {
  id: string;
  company_id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

export interface CloudConnector {
  id: string;
  company_id: string;
  provider: string;
  display_name: string;
  is_enabled: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  sync_interval_minutes: number;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
}
