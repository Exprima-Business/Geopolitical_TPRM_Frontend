"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AssetDetailPanel } from "@/components/events/asset-detail-panel";
import { getAssetLocation, getAssetTypeLabel, getAssetIcon } from "@/lib/asset-utils";
import type { Asset } from "@/types";
import { Plus, MapPin, Search } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [assetType, setAssetType] = useState("office");
  const [criticality, setCriticality] = useState("medium");
  const [loading, setLoading] = useState(false);

  const loadAssets = async () => {
    try {
      const data = await api.companies(COMPANY_ID).assets.list();
      const result = data as { items?: Asset[] } | Asset[];
      setAssets(Array.isArray(result) ? result : result.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadAssets(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.companies(COMPANY_ID).assets.create({
        name, address, asset_type: assetType, criticality,
      });
      await loadAssets();
      setShowForm(false);
      setName("");
      setAddress("");
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const filtered = assets.filter((a) => {
    const matchesSearch = !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      getAssetLocation(a).toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || a.asset_type === typeFilter;
    return matchesSearch && matchesType;
  });

  // Group unique asset types for filter
  const assetTypes = [...new Set(assets.map((a) => a.asset_type))];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            {assets.length} assets — click any asset for details
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assets by name or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="all">All Types</option>
          {assetTypes.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="US East Data Center" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City, Country" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="office">Office</option>
                  <option value="data_center">Data Center</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="factory">Factory</option>
                  <option value="cloud_region">Cloud Resource</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Criticality</label>
                <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="col-span-2 flex gap-2">
                <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create Asset"}</Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">{filtered.length} assets shown</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((asset) => (
          <Card
            key={asset.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedAsset(asset)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getAssetIcon(asset)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium truncate">{asset.name}</h3>
                    <Badge variant={asset.criticality} className="shrink-0 text-xs">
                      {asset.criticality}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{getAssetLocation(asset)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getAssetTypeLabel(asset)}
                    {asset.cloud_region_code && ` · ${asset.cloud_region_code}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail panel */}
      {selectedAsset && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedAsset(null)} />
          <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
        </>
      )}
    </div>
  );
}
