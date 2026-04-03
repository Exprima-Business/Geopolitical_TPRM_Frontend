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
  // Evolution tracking
  status?: string | null;
  previous_severity?: number | null;
  update_count?: number | null;
  severity_trend?: string | null;
  first_seen_at?: string | null;
  peak_severity?: number | null;
}

export interface Asset {
  id: string;
  company_id: string;
  name: string;
  asset_type: string;
  address?: string | null;
  latitude: number | null;
  longitude: number | null;
  cloud_provider?: string | null;
  cloud_region_code?: string | null;
  vendor_domain?: string | null;
  country_code?: string | null;
  external_id?: string | null;
  criticality: "low" | "medium" | "high" | "critical";
  metadata_?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
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

export interface AssetRiskScore {
  asset_id: string;
  asset_name: string;
  risk_score: number;
  nearby_event_count: number;
  highest_severity_event: string | null;
  highest_severity: number;
  closest_event_km: number | null;
  trend: string;
}

export interface Company {
  id: string;
  name: string;
}
