"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAssetLocation, getAssetTypeLabel, getAssetIcon } from "@/lib/asset-utils";
import type { Asset } from "@/types";
import { X, MapPin, Server, Shield, Tag } from "lucide-react";

export function AssetDetailPanel({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const meta = (asset.metadata_ || {}) as Record<string, string | number | boolean | null>;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Asset Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Name + criticality */}
        <div className="space-y-2">
          <div className="flex items-start gap-3">
            <span className="text-3xl">{getAssetIcon(asset)}</span>
            <div className="flex-1">
              <h3 className="text-xl font-bold leading-tight">{asset.name}</h3>
              <p className="text-sm text-muted-foreground">{getAssetTypeLabel(asset)}</p>
            </div>
            <Badge variant={asset.criticality} className="shrink-0">
              {asset.criticality}
            </Badge>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Location
          </h4>
          <div className="p-3 rounded-lg border border-border">
            <p className="font-medium">{getAssetLocation(asset)}</p>
            {asset.cloud_region_code && (
              <p className="text-sm text-muted-foreground">Region: {asset.cloud_region_code}</p>
            )}
            {asset.country_code && (
              <p className="text-sm text-muted-foreground">Country: {asset.country_code}</p>
            )}
          </div>
        </div>

        {/* Infrastructure */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4" /> Infrastructure
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-medium">{asset.asset_type}</p>
            </div>
            {asset.cloud_provider && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Provider</p>
                <p className="font-medium">{asset.cloud_provider}</p>
              </div>
            )}
            {meta.resource_type && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Resource Type</p>
                <p className="font-medium">{String(meta.resource_type)}</p>
              </div>
            )}
            {meta.instance_type && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Instance Type</p>
                <p className="font-medium">{String(meta.instance_type)}</p>
              </div>
            )}
            {meta.engine && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Engine</p>
                <p className="font-medium">{String(meta.engine)}</p>
              </div>
            )}
            {meta.runtime && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Runtime</p>
                <p className="font-medium">{String(meta.runtime)}</p>
              </div>
            )}
            {meta.private_ip && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Private IP</p>
                <p className="font-medium font-mono text-sm">{String(meta.private_ip)}</p>
              </div>
            )}
            {meta.dns_name && (
              <div className="p-3 rounded-lg border border-border col-span-2">
                <p className="text-xs text-muted-foreground">DNS</p>
                <p className="font-medium font-mono text-sm truncate">{String(meta.dns_name)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Criticality */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" /> Risk Profile
          </h4>
          <div className="p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm">Criticality Level</span>
              <Badge variant={asset.criticality}>{asset.criticality}</Badge>
            </div>
          </div>
        </div>

        {/* Metadata */}
        {meta.employees && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Tag className="h-4 w-4" /> Additional Info
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {meta.employees && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="font-medium">{String(meta.employees)}</p>
                </div>
              )}
              {meta.provider && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Facility Provider</p>
                  <p className="font-medium">{String(meta.provider)}</p>
                </div>
              )}
              {meta.rack_count && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Rack Count</p>
                  <p className="font-medium">{String(meta.rack_count)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-1 text-sm text-muted-foreground border-t border-border pt-4">
          {asset.external_id && <p>External ID: {asset.external_id}</p>}
          <p>Created: {new Date(asset.created_at).toLocaleString()}</p>
          <p>Updated: {new Date(asset.updated_at).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
