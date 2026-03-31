"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Asset } from "@/types";
import { Plus, MapPin } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [assetType, setAssetType] = useState("physical");
  const [criticality, setCriticality] = useState("medium");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.companies(COMPANY_ID).assets.list()
      .then((data) => setAssets(data as Asset[]))
      .catch(console.error);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.companies(COMPANY_ID).assets.create({
        name,
        address,
        asset_type: assetType,
        criticality,
      });
      const data = await api.companies(COMPANY_ID).assets.list();
      setAssets(data as Asset[]);
      setShowForm(false);
      setName("");
      setAddress("");
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-muted-foreground">Manage your physical and cloud assets</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Add Asset
        </Button>
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
                  <option value="physical">Physical</option>
                  <option value="cloud">Cloud</option>
                  <option value="office">Office</option>
                  <option value="warehouse">Warehouse</option>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((asset) => (
          <Card key={asset.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{asset.name}</CardTitle>
                <Badge variant={asset.criticality as "critical" | "high" | "medium" | "low"}>
                  {asset.criticality}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {asset.address || `${asset.latitude?.toFixed(2)}, ${asset.longitude?.toFixed(2)}`}
              </div>
              <p className="text-xs text-muted-foreground">
                Type: {asset.asset_type}
                {asset.cloud_provider && ` · ${asset.cloud_provider} ${asset.cloud_region}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
