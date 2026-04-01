"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CloudConnector } from "@/types";
import { Plus, RefreshCw, Trash2, Loader2, CheckCircle, XCircle, Cloud } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

const PROVIDERS = [
  { value: "demo", label: "Demo (Sample Data)", icon: "Demo" },
  { value: "aws", label: "Amazon Web Services", icon: "AWS" },
  { value: "azure", label: "Microsoft Azure", icon: "Azure" },
  { value: "gcp", label: "Google Cloud Platform", icon: "GCP" },
  { value: "servicenow", label: "ServiceNow CMDB", icon: "SNOW" },
];

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<CloudConnector[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Form state
  const [provider, setProvider] = useState("demo");
  const [displayName, setDisplayName] = useState("Demo Environment");
  const [credentialsJson, setCredentialsJson] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const loadConnectors = async () => {
    try {
      const data = await api.companies(COMPANY_ID).connectors.list();
      setConnectors(data as CloudConnector[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadConnectors(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);

    try {
      const credentials = JSON.parse(credentialsJson);
      const config = configJson.trim() ? JSON.parse(configJson) : null;

      await api.companies(COMPANY_ID).connectors.create({
        provider,
        display_name: displayName,
        credentials,
        config,
      });

      setShowForm(false);
      setDisplayName("");
      setCredentialsJson("");
      setConfigJson("");
      await loadConnectors();
    } catch (err) {
      setError(err instanceof SyntaxError ? "Invalid JSON format" : String(err));
    }
    setCreating(false);
  };

  const handleSync = async (connectorId: string) => {
    setSyncing(connectorId);
    try {
      await api.companies(COMPANY_ID).connectors.sync(connectorId);
      // Poll for completion after a short delay
      setTimeout(loadConnectors, 3000);
    } catch (err) {
      console.error(err);
    }
    setSyncing(null);
  };

  const handleDelete = async (connectorId: string) => {
    if (!confirm("Delete this connector? Synced assets will remain.")) return;
    try {
      await api.companies(COMPANY_ID).connectors.delete(connectorId);
      await loadConnectors();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (connector: CloudConnector) => {
    if (connector.last_sync_status === "running") return <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin mr-1" />Syncing</Badge>;
    if (connector.last_sync_status === "success") return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Synced</Badge>;
    if (connector.last_sync_status === "error") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
    return <Badge variant="outline">Not synced</Badge>;
  };

  const credentialPlaceholders: Record<string, string> = {
    demo: '{"mode": "demo"}',
    aws: '{\n  "aws_access_key_id": "AKIA...",\n  "aws_secret_access_key": "..."\n}',
    azure: '{\n  "tenant_id": "...",\n  "client_id": "...",\n  "client_secret": "..."\n}',
    gcp: '{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}',
    servicenow: '{\n  "instance_url": "https://myco.service-now.com",\n  "username": "...",\n  "password": "..."\n}',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cloud Connectors</h1>
          <p className="text-muted-foreground">Connect your cloud accounts and CMDBs to automatically sync assets</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> Add Connector
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Connector</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-400/10 rounded-md border border-red-400/20">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  >
                    {PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Production AWS Account"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Credentials (JSON)</label>
                <textarea
                  value={credentialsJson}
                  onChange={(e) => setCredentialsJson(e.target.value)}
                  placeholder={credentialPlaceholders[provider]}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono min-h-[120px] placeholder:text-muted-foreground"
                  required
                />
                <p className="text-xs text-muted-foreground">Credentials are encrypted before storage and never returned by the API.</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Config (optional JSON)</label>
                <textarea
                  value={configJson}
                  onChange={(e) => setConfigJson(e.target.value)}
                  placeholder='{"regions": ["us-east-1", "eu-west-1"]}'
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono min-h-[60px] placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Connector"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Connector list */}
      {connectors.length === 0 && !showForm ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <Cloud className="h-16 w-16 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold">No Connectors Configured</h3>
              <p className="text-muted-foreground">
                Connect your AWS, Azure, GCP, or ServiceNow accounts to automatically discover and sync your infrastructure assets.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add Your First Connector
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {connectors.map((connector) => (
            <Card key={connector.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {PROVIDERS.find((p) => p.value === connector.provider)?.icon || connector.provider.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium">{connector.display_name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{PROVIDERS.find((p) => p.value === connector.provider)?.label}</span>
                        <span>Every {connector.sync_interval_minutes}min</span>
                        {connector.last_synced_at && (
                          <span>Last sync: {new Date(connector.last_synced_at).toLocaleString()}</span>
                        )}
                      </div>
                      {connector.last_sync_error && (
                        <p className="text-xs text-red-400 mt-1">{connector.last_sync_error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(connector)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(connector.id)}
                      disabled={syncing === connector.id}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing === connector.id ? "animate-spin" : ""}`} />
                      Sync Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(connector.id)}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
