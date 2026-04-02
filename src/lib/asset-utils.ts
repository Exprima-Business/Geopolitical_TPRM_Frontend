import type { Asset } from "@/types";

// Cloud region display names for common regions
const REGION_NAMES: Record<string, string> = {
  "us-east-1": "US East (Virginia)",
  "us-east-2": "US East (Ohio)",
  "us-west-1": "US West (N. California)",
  "us-west-2": "US West (Oregon)",
  "eu-west-1": "Europe (Ireland)",
  "eu-west-2": "Europe (London)",
  "eu-central-1": "Europe (Frankfurt)",
  "ap-northeast-1": "Asia Pacific (Tokyo)",
  "ap-southeast-1": "Asia Pacific (Singapore)",
  "ap-southeast-2": "Asia Pacific (Sydney)",
  "ap-south-1": "Asia Pacific (Mumbai)",
  "sa-east-1": "South America (São Paulo)",
  "ca-central-1": "Canada (Central)",
};

// Cloud region approximate coordinates for map display
const REGION_COORDS: Record<string, [number, number]> = {
  "us-east-1": [-77.47, 39.04],
  "us-east-2": [-82.99, 40.42],
  "us-west-1": [-121.96, 37.35],
  "us-west-2": [-122.34, 45.59],
  "eu-west-1": [-6.27, 53.35],
  "eu-west-2": [-0.12, 51.51],
  "eu-central-1": [8.68, 50.11],
  "ap-northeast-1": [139.75, 35.68],
  "ap-southeast-1": [103.85, 1.29],
  "ap-southeast-2": [151.21, -33.87],
  "ap-south-1": [72.88, 19.08],
  "sa-east-1": [-46.63, -23.55],
  "ca-central-1": [-73.57, 45.50],
};

export function getAssetLocation(asset: Asset): string {
  if (asset.address) return asset.address;
  if (asset.cloud_region_code) {
    return REGION_NAMES[asset.cloud_region_code] || asset.cloud_region_code;
  }
  if (asset.latitude != null && asset.longitude != null) {
    return `${asset.latitude.toFixed(2)}, ${asset.longitude.toFixed(2)}`;
  }
  return "Location not set";
}

export function getAssetCoordinates(asset: Asset): [number, number] | null {
  if (asset.latitude != null && asset.longitude != null) {
    return [asset.longitude, asset.latitude];
  }
  if (asset.cloud_region_code && REGION_COORDS[asset.cloud_region_code]) {
    return REGION_COORDS[asset.cloud_region_code];
  }
  return null;
}

export function getAssetTypeLabel(asset: Asset): string {
  const resourceType = asset.metadata_?.resource_type as string | undefined;

  const RESOURCE_LABELS: Record<string, string> = {
    ec2_instance: "EC2 Instance",
    rds_instance: "RDS Database",
    lambda_function: "Lambda Function",
    s3_bucket: "S3 Bucket",
    load_balancer: "Load Balancer",
    office: "Office",
    data_center: "Data Center",
  };

  if (resourceType && RESOURCE_LABELS[resourceType]) {
    return RESOURCE_LABELS[resourceType];
  }

  const TYPE_LABELS: Record<string, string> = {
    cloud_region: "Cloud Resource",
    data_center: "Data Center",
    office: "Office",
    warehouse: "Warehouse",
    factory: "Factory",
    port: "Port",
    vendor: "Vendor",
    partner: "Partner",
    custom: "Custom",
  };

  return TYPE_LABELS[asset.asset_type] || asset.asset_type;
}

export function getAssetIcon(asset: Asset): string {
  const resourceType = asset.metadata_?.resource_type as string | undefined;

  if (resourceType === "ec2_instance") return "🖥️";
  if (resourceType === "rds_instance") return "🗄️";
  if (resourceType === "lambda_function") return "⚡";
  if (resourceType === "s3_bucket") return "📦";
  if (resourceType === "load_balancer") return "🔀";

  if (asset.asset_type === "office") return "🏢";
  if (asset.asset_type === "data_center") return "🏗️";
  if (asset.asset_type === "warehouse") return "🏭";
  if (asset.asset_type === "cloud_region") return "☁️";

  return "📍";
}
