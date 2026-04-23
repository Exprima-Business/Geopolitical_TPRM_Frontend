"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, XCircle, Loader2, Plus, Trash2, RefreshCw,
  ExternalLink, Eye, EyeOff, AlertTriangle, ArrowLeft, Search,
  Info, Code,
} from "lucide-react";
import {
  INTEGRATIONS,
  CATEGORY_LABELS,
  findIntegration,
  type IntegrationSpec,
  type IntegrationCategory,
  type IntegrationField,
} from "@/lib/integrations";
import {
  loadConnections,
  createConnection,
  updateConnection,
  deleteConnection,
  validateCredentials,
  testStoredConnection,
  resolveEndpointUrl,
  type IntegrationConnection,
  type TestResult,
} from "@/lib/integration-connections";

/* ── Field renderer ─────────────────────────────────────── */

function FieldInput({
  field,
  value,
  onChange,
  showSecrets,
}: {
  field: IntegrationField;
  value: string;
  onChange: (v: string) => void;
  showSecrets: boolean;
}) {
  const inputType =
    field.type === "password" && !showSecrets
      ? "password"
      : field.type === "email"
      ? "email"
      : field.type === "url"
      ? "url"
      : "text";

  if (field.type === "select") {
    return (
      <select
        value={value || field.default || ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
      >
        {field.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono min-h-[60px] placeholder:text-muted-foreground"
      />
    );
  }

  return (
    <Input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className="h-9 text-sm"
      autoComplete="off"
    />
  );
}

/* ── Catalog Card ───────────────────────────────────────── */

function CatalogCard({
  spec,
  connectedCount,
  onConnect,
}: {
  spec: IntegrationSpec;
  connectedCount: number;
  onConnect: () => void;
}) {
  const Icon = spec.icon;
  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${spec.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{spec.name}</h3>
              {connectedCount > 0 && (
                <Badge variant="default" className="text-[10px] gap-1">
                  <CheckCircle className="h-3 w-3" />
                  {connectedCount === 1 ? "Connected" : `${connectedCount} connected`}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{spec.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {spec.capabilities.slice(0, 3).map((cap) => (
                <Badge key={cap.action} variant="outline" className="text-[10px] px-1.5 py-0">
                  {cap.label}
                </Badge>
              ))}
              {spec.capabilities.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  +{spec.capabilities.length - 3}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          <a
            href={spec.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
          <Button size="sm" className="h-7 text-xs" onClick={onConnect}>
            <Plus className="h-3.5 w-3.5" /> Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Connect Form ───────────────────────────────────────── */

function ConnectForm({
  spec,
  existing,
  onCancel,
  onSaved,
}: {
  spec: IntegrationSpec;
  existing: IntegrationConnection | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { companyId } = useCompany();
  const Icon = spec.icon;
  const [displayName, setDisplayName] = useState(existing?.display_name || spec.name);
  // Credentials are never returned by the API (encrypted server-side).
  // The form starts empty; on edit, leaving fields blank keeps the stored
  // credentials — entering values rotates them.
  const [credentials, setCredentials] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of spec.fields) {
      if (f.default) initial[f.key] = f.default;
    }
    return initial;
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [saving, setSaving] = useState(false);
  // Tracks the stored connection id so Test-then-Save (or Test twice)
  // updates the same record instead of trying to create duplicates.
  const [connectionId, setConnectionId] = useState<string | undefined>(existing?.id);

  function setField(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setTestResult(null);
    setErrors([]);
  }

  /** True if the user has typed at least one credential value in the form. */
  function hasUserEnteredCredentials(): boolean {
    return spec.fields.some((f) => (credentials[f.key] ?? "").trim() !== (f.default ?? ""));
  }

  async function handleTest() {
    // Test requires a stored connection: save first if new, then test.
    const isUpdatingCreds = hasUserEnteredCredentials();
    if (!connectionId || isUpdatingCreds) {
      const validationErrors = validateCredentials(spec, credentials);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    setErrors([]);
    setTesting(true);
    try {
      let id = connectionId;
      if (!id) {
        const created = await createConnection(companyId, spec.id, displayName, credentials);
        id = created.id;
        setConnectionId(id);
      } else if (isUpdatingCreds) {
        await updateConnection(companyId, id, { display_name: displayName, credentials });
      } else {
        // Existing connection, no new credentials — just update the display name if changed
        if (existing && displayName !== existing.display_name) {
          await updateConnection(companyId, id, { display_name: displayName });
        }
      }
      const result = await testStoredConnection(companyId, id);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, message: "Test failed", detail: String(err) });
    }
    setTesting(false);
  }

  async function handleSave() {
    const isUpdatingCreds = hasUserEnteredCredentials();
    if (!connectionId || isUpdatingCreds) {
      const validationErrors = validateCredentials(spec, credentials);
      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    setSaving(true);
    try {
      if (connectionId) {
        const patch: { display_name: string; credentials?: Record<string, string> } = {
          display_name: displayName,
        };
        if (isUpdatingCreds) patch.credentials = credentials;
        await updateConnection(companyId, connectionId, patch);
      } else {
        await createConnection(companyId, spec.id, displayName, credentials);
      }
      onSaved();
    } catch (err) {
      setErrors([String(err)]);
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${spec.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{existing ? "Edit" : "Connect"} {spec.name}</h2>
            <p className="text-xs text-muted-foreground">{spec.description}</p>
          </div>
        </div>

        {/* API reference summary */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <Code className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-muted-foreground font-semibold uppercase text-[10px] mb-1">Auth Pattern</div>
              <code className="font-mono text-[11px] break-all">{spec.authPreview}</code>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <span className="text-muted-foreground">
              Capabilities: <span className="text-foreground font-medium">{spec.capabilities.length}</span>
            </span>
            <a
              href={spec.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Provider API docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Stored connection status (edit mode only) */}
        {existing && (
          <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground font-semibold uppercase text-[10px]">Stored Connection</span>
                {existing.status === "connected" && (
                  <Badge variant="default" className="text-[10px] gap-1">
                    <CheckCircle className="h-3 w-3" /> Connected
                  </Badge>
                )}
                {existing.status === "error" && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <XCircle className="h-3 w-3" /> Error
                  </Badge>
                )}
                {existing.status === "untested" && (
                  <Badge variant="outline" className="text-[10px]">Untested</Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                disabled={testing}
                onClick={async () => {
                  setTesting(true);
                  try {
                    const r = await testStoredConnection(companyId, existing.id);
                    setTestResult(r);
                  } catch (err) {
                    setTestResult({ ok: false, message: "Test failed", detail: String(err) });
                  }
                  setTesting(false);
                }}
              >
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Test Stored Credentials
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                <span className="text-[10px] uppercase">Connection Name</span>
                <div className="text-foreground">{existing.display_name}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase">Connection ID</span>
                <div className="font-mono text-[10px]">{existing.id}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase">Last Tested</span>
                <div className="text-foreground">
                  {existing.last_tested_at
                    ? new Date(existing.last_tested_at).toLocaleString()
                    : "Never"}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase">Created</span>
                <div className="text-foreground">{new Date(existing.created_at).toLocaleString()}</div>
              </div>
            </div>
            {existing.last_error && (
              <div className="text-red-400 text-[11px] pt-1 border-t border-border/60">
                Last error: {existing.last_error}
              </div>
            )}
            {existing.config && Object.keys(existing.config).length > 0 && (
              <div className="pt-1 border-t border-border/60">
                <span className="text-[10px] uppercase text-muted-foreground">Config</span>
                <pre className="mt-1 p-2 rounded bg-muted/50 text-[10px] font-mono overflow-x-auto">
                  {JSON.stringify(existing.config, null, 2)}
                </pre>
              </div>
            )}
            <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
              <Info className="h-3 w-3 inline mr-1" />
              Credentials are Fernet-encrypted server-side and are never returned. Leave the fields
              below blank to keep existing credentials, or enter new values to rotate them.
            </div>
          </div>
        )}

        {/* Deprecation / setup notes */}
        {spec.notes && (
          <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/5 p-3 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-400" />
              <p className="text-yellow-100/90">{spec.notes}</p>
            </div>
          </div>
        )}

        {/* Display name */}
        <div>
          <label className="text-sm font-medium block mb-1.5">
            Connection Name <span className="text-red-400">*</span>
          </label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Production Slack"
            className="h-9 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            A friendly name. You can have multiple connections to the same integration.
          </p>
        </div>

        {/* Credential fields */}
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {existing ? "Rotate Credentials (optional)" : "Credentials"}
            </h3>
            <button
              type="button"
              onClick={() => setShowSecrets((x) => !x)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {showSecrets ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hide secrets
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Show secrets
                </>
              )}
            </button>
          </div>

          {spec.fields.map((field) => (
            <div key={field.key}>
              <label className="text-sm font-medium block mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400"> *</span>}
                {field.secret && (
                  <Badge variant="outline" className="text-[10px] ml-2 px-1.5 py-0">
                    Encrypted
                  </Badge>
                )}
              </label>
              <FieldInput
                field={field}
                value={credentials[field.key] ?? ""}
                onChange={(v) => setField(field.key, v)}
                showSecrets={showSecrets}
              />
              {field.helpText && (
                <p className="text-xs text-muted-foreground mt-1">{field.helpText}</p>
              )}
            </div>
          ))}
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="p-3 rounded-md border border-red-400/30 bg-red-400/10 text-sm text-red-400 space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div
            className={`p-3 rounded-md border text-sm ${
              testResult.ok
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                : "border-red-400/30 bg-red-400/10 text-red-400"
            }`}
          >
            <div className="flex items-start gap-2">
              {testResult.ok ? (
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium">{testResult.message}</div>
                {(testResult.request_method || testResult.request_url) && (
                  <div className="text-[11px] font-mono mt-1 opacity-90 break-all">
                    {testResult.request_method} {testResult.request_url}
                    {testResult.response_status != null && (
                      <span className="ml-2 opacity-80">
                        → {testResult.response_status}
                      </span>
                    )}
                    {testResult.duration_ms != null && (
                      <span className="ml-2 opacity-80">({testResult.duration_ms}ms)</span>
                    )}
                  </div>
                )}
                {testResult.detail && (
                  <div className="text-xs mt-1 opacity-90">{testResult.detail}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Capabilities & Endpoints */}
        <div className="border-t border-border pt-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Code className="h-4 w-4" /> Capabilities & Endpoints
          </h3>
          <p className="text-xs text-muted-foreground">
            Exact endpoints the backend executor will call using these credentials.
          </p>
          <div className="space-y-2">
            {spec.capabilities.map((cap) => {
              const url = resolveEndpointUrl(spec, cap.endpoint, credentials);
              return (
                <div
                  key={cap.action}
                  className="rounded-md border border-border bg-muted/20 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                        {cap.endpoint.method}
                      </Badge>
                      <span className="font-medium">{cap.label}</span>
                    </div>
                    <a
                      href={cap.endpoint.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary inline-flex items-center gap-1 text-[10px]"
                    >
                      Docs <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <code className="block font-mono text-[11px] mt-1 break-all text-muted-foreground">
                    {url || <span className="italic">(URL resolves once credentials are filled)</span>}
                  </code>
                  {cap.endpoint.description && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {cap.endpoint.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || saving}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {testing ? "Testing..." : "Test Connection"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || testing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {saving ? "Saving..." : existing ? "Save Changes" : "Save Connection"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Connected Connection Row ───────────────────────────── */

function ConnectionRow({
  connection,
  onEdit,
  onTest,
  onDelete,
}: {
  connection: IntegrationConnection;
  onEdit: () => void;
  onTest: () => void;
  onDelete: () => void;
}) {
  const spec = findIntegration(connection.integration_id);
  if (!spec) return null;
  const Icon = spec.icon;

  const statusBadge =
    connection.status === "connected" ? (
      <Badge variant="default" className="text-[10px] gap-1">
        <CheckCircle className="h-3 w-3" /> Connected
      </Badge>
    ) : connection.status === "error" ? (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <XCircle className="h-3 w-3" /> Error
      </Badge>
    ) : (
      <Badge variant="outline" className="text-[10px]">Untested</Badge>
    );

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 ${spec.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm truncate">{connection.display_name}</h3>
                {statusBadge}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span>{spec.name}</span>
                {connection.last_tested_at && (
                  <span>Last tested: {new Date(connection.last_tested_at).toLocaleString()}</span>
                )}
              </div>
              {connection.last_error && (
                <p className="text-xs text-red-400 mt-1 truncate" title={connection.last_error}>
                  {connection.last_error}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onTest} className="h-8">
              <RefreshCw className="h-3.5 w-3.5" /> Test
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit} className="h-8">
              Edit
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="h-8">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

type View =
  | { mode: "list" }
  | { mode: "connect"; spec: IntegrationSpec; existing: IntegrationConnection | null };

export default function IntegrationsPage() {
  const { companyId } = useCompany();
  const [view, setView] = useState<View>({ mode: "list" });
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<IntegrationCategory | "all">("all");
  const [testingId, setTestingId] = useState<string | null>(null);

  useEffect(() => {
    loadConnections(companyId).then(setConnections).catch(console.error);
  }, [companyId]);

  async function refresh() {
    try {
      setConnections(await loadConnections(companyId));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleTest(conn: IntegrationConnection) {
    setTestingId(conn.id);
    try {
      await testStoredConnection(companyId, conn.id);
    } catch (err) {
      console.error(err);
    }
    await refresh();
    setTestingId(null);
  }

  async function handleDelete(conn: IntegrationConnection) {
    if (!confirm(`Delete connection "${conn.display_name}"? This cannot be undone.`)) return;
    await deleteConnection(companyId, conn.id);
    await refresh();
  }

  const connectedByIntegration = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of connections) {
      map.set(c.integration_id, (map.get(c.integration_id) ?? 0) + 1);
    }
    return map;
  }, [connections]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return INTEGRATIONS.filter((spec) => {
      if (category !== "all" && spec.category !== category) return false;
      if (!q) return true;
      return (
        spec.name.toLowerCase().includes(q) ||
        spec.description.toLowerCase().includes(q) ||
        spec.capabilities.some((c) => c.label.toLowerCase().includes(q))
      );
    });
  }, [search, category]);

  /* ── Connect mode ────────────────────────────────────── */
  if (view.mode === "connect") {
    return (
      <div className="p-6 max-w-3xl">
        <ConnectForm
          spec={view.spec}
          existing={view.existing}
          onCancel={() => setView({ mode: "list" })}
          onSaved={() => {
            refresh();
            setView({ mode: "list" });
          }}
        />
      </div>
    );
  }

  /* ── List mode ───────────────────────────────────────── */
  const categories: ("all" | IntegrationCategory)[] = [
    "all",
    "messaging",
    "email",
    "ticketing",
    "incident",
    "crm",
    "identity",
    "webhook",
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Plug-and-play connections to third-party systems. The agent uses these integrations to
          execute playbook steps — post alerts, open tickets, notify vendors, and more.
        </p>
      </div>

      {/* Configured connections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Configured Connections{" "}
            <span className="text-sm font-normal text-muted-foreground">({connections.length})</span>
          </h2>
        </div>

        {connections.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                No connections configured yet. Pick an integration from the catalog below to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div key={conn.id} className="relative">
                {testingId === conn.id && (
                  <div className="absolute top-1 right-1 text-xs text-muted-foreground flex items-center gap-1 z-10">
                    <Loader2 className="h-3 w-3 animate-spin" /> Testing…
                  </div>
                )}
                <ConnectionRow
                  connection={conn}
                  onTest={() => handleTest(conn)}
                  onEdit={() => {
                    const spec = findIntegration(conn.integration_id);
                    if (spec) setView({ mode: "connect", spec, existing: conn });
                  }}
                  onDelete={() => handleDelete(conn)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Catalog */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">
            Integration Catalog{" "}
            <span className="text-sm font-normal text-muted-foreground">({INTEGRATIONS.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search integrations..."
                className="h-8 text-xs pl-8 w-64"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                category === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {filteredCatalog.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No integrations match your filters.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCatalog.map((spec) => (
              <CatalogCard
                key={spec.id}
                spec={spec}
                connectedCount={connectedByIntegration.get(spec.id) ?? 0}
                onConnect={() => setView({ mode: "connect", spec, existing: null })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer note */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
            <div>
              <strong className="text-foreground">Live mode:</strong> Credentials are Fernet-encrypted
              server-side. Connection tests and playbook executions hit the real provider APIs
              shown in the endpoint list above — no mocks.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
