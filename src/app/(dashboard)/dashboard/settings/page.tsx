"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Bell, Cloud, Save, Loader2, CheckCircle,
  AlertTriangle, Bot, Zap, Lock, Sliders, RotateCcw,
} from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

type Tab = "governance" | "alerts" | "connectors";

interface Settings {
  // Agent Guardrails
  guardrail_auto_approve_max_severity: number;
  guardrail_require_approval_min_severity: number;
  guardrail_escalate_min_severity: number;
  guardrail_max_actions_per_hour: number;
  guardrail_approval_timeout_minutes: number;
  guardrail_blocked_actions: string[];
  // Proximity Alerts
  proximity_alert_radius_km: number;
  proximity_alert_min_severity: number;
  // Agent Behavior
  agent_model_high_severity: string;
  agent_model_low_severity: string;
  agent_severity_model_threshold: number;
  agent_enabled: boolean;
  // Notifications
  notification_email_enabled: boolean;
  notification_email_address: string;
  notification_webhook_enabled: boolean;
  notification_webhook_url: string;
  notification_in_app_enabled: boolean;
}

const DEFAULTS: Settings = {
  guardrail_auto_approve_max_severity: 4.0,
  guardrail_require_approval_min_severity: 6.0,
  guardrail_escalate_min_severity: 8.0,
  guardrail_max_actions_per_hour: 20,
  guardrail_approval_timeout_minutes: 60,
  guardrail_blocked_actions: ["terminate_vendor", "shutdown_service"],
  proximity_alert_radius_km: 500,
  proximity_alert_min_severity: 6.0,
  agent_model_high_severity: "claude-opus-4-20250514",
  agent_model_low_severity: "claude-sonnet-4-20250514",
  agent_severity_model_threshold: 6.0,
  agent_enabled: true,
  notification_email_enabled: false,
  notification_email_address: "",
  notification_webhook_enabled: false,
  notification_webhook_url: "",
  notification_in_app_enabled: true,
};

const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: "governance", label: "Agent Governance", icon: Shield },
  { id: "alerts", label: "Alerts & Notifications", icon: Bell },
  { id: "connectors", label: "Connectors", icon: Cloud },
];

function SeverityBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = (value / max) * 100;
  const color =
    value <= 4 ? "bg-green-500" : value <= 6 ? "bg-yellow-500" : value <= 8 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}

function SliderField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step = 0.5,
  unit = "",
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm font-mono font-bold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

// ─── Agent Governance Tab ───────────────────────────────────
function GovernanceTab({
  settings,
  update,
}: {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
}) {
  const [newBlockedAction, setNewBlockedAction] = useState("");

  return (
    <div className="space-y-6">
      {/* Agent Enable/Disable */}
      <Card>
        <CardContent className="p-5">
          <Toggle
            checked={settings.agent_enabled}
            onChange={(v) => update({ agent_enabled: v })}
            label="Enable AI Agent"
            description="When disabled, the agent will not process any risk events or take actions"
          />
        </CardContent>
      </Card>

      {/* Severity Thresholds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="h-4 w-4" /> Severity Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Control how the agent responds based on event severity. Events below
            the auto-approve threshold execute immediately. Between auto-approve
            and require-approval, the agent notifies but proceeds. Above
            require-approval, human sign-off is required. Above escalation, the
            event is flagged for immediate attention.
          </p>

          {/* Visual severity band */}
          <div className="p-4 rounded-lg border border-border space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium">
              <div className="flex-1 text-center">
                <div className="h-3 rounded-l-full bg-green-500/80" />
                <span className="text-green-400">Auto-Approve</span>
              </div>
              <div className="flex-1 text-center">
                <div className="h-3 bg-yellow-500/80" />
                <span className="text-yellow-400">Notify</span>
              </div>
              <div className="flex-1 text-center">
                <div className="h-3 bg-orange-500/80" />
                <span className="text-orange-400">Require Approval</span>
              </div>
              <div className="flex-1 text-center">
                <div className="h-3 rounded-r-full bg-red-500/80" />
                <span className="text-red-400">Escalate</span>
              </div>
            </div>
            <div className="flex text-xs text-muted-foreground">
              <span className="flex-1 text-center">0 — {settings.guardrail_auto_approve_max_severity}</span>
              <span className="flex-1 text-center">{settings.guardrail_auto_approve_max_severity} — {settings.guardrail_require_approval_min_severity}</span>
              <span className="flex-1 text-center">{settings.guardrail_require_approval_min_severity} — {settings.guardrail_escalate_min_severity}</span>
              <span className="flex-1 text-center">{settings.guardrail_escalate_min_severity} — 10</span>
            </div>
          </div>

          <SliderField
            label="Auto-Approve Maximum"
            description="Events below this severity are auto-approved without notification"
            value={settings.guardrail_auto_approve_max_severity}
            onChange={(v) => update({ guardrail_auto_approve_max_severity: v })}
            min={1}
            max={10}
          />
          <SliderField
            label="Require Approval Minimum"
            description="Events at or above this severity require human approval before executing"
            value={settings.guardrail_require_approval_min_severity}
            onChange={(v) => update({ guardrail_require_approval_min_severity: v })}
            min={1}
            max={10}
          />
          <SliderField
            label="Escalation Minimum"
            description="Events at or above this severity are escalated for immediate attention"
            value={settings.guardrail_escalate_min_severity}
            onChange={(v) => update({ guardrail_escalate_min_severity: v })}
            min={1}
            max={10}
          />
        </CardContent>
      </Card>

      {/* Rate Limits */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" /> Rate Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <SliderField
            label="Max Actions Per Hour"
            description="Maximum number of agent actions allowed per hour before escalation"
            value={settings.guardrail_max_actions_per_hour}
            onChange={(v) => update({ guardrail_max_actions_per_hour: v })}
            min={5}
            max={100}
            step={5}
          />
          <SliderField
            label="Approval Timeout"
            description="Minutes before a pending approval request expires"
            value={settings.guardrail_approval_timeout_minutes}
            onChange={(v) => update({ guardrail_approval_timeout_minutes: v })}
            min={15}
            max={1440}
            step={15}
            unit=" min"
          />
        </CardContent>
      </Card>

      {/* Blocked Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Blocked Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            These action types are permanently blocked. The agent will escalate instead of executing them.
          </p>
          <div className="flex flex-wrap gap-2">
            {settings.guardrail_blocked_actions.map((action) => (
              <Badge key={action} variant="destructive" className="gap-1">
                {action.replace(/_/g, " ")}
                <button
                  onClick={() =>
                    update({
                      guardrail_blocked_actions: settings.guardrail_blocked_actions.filter(
                        (a) => a !== action
                      ),
                    })
                  }
                  className="ml-1 hover:text-foreground"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. delete_asset"
              value={newBlockedAction}
              onChange={(e) => setNewBlockedAction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newBlockedAction.trim()) {
                  update({
                    guardrail_blocked_actions: [
                      ...settings.guardrail_blocked_actions,
                      newBlockedAction.trim(),
                    ],
                  });
                  setNewBlockedAction("");
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!newBlockedAction.trim()}
              onClick={() => {
                update({
                  guardrail_blocked_actions: [
                    ...settings.guardrail_blocked_actions,
                    newBlockedAction.trim(),
                  ],
                });
                setNewBlockedAction("");
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Model Selection */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" /> Model Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The agent uses a more capable model for high-severity events and a faster model for routine analysis.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">High-Severity Model</label>
              <select
                value={settings.agent_model_high_severity}
                onChange={(e) => update({ agent_model_high_severity: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Low-Severity Model</label>
              <select
                value={settings.agent_model_low_severity}
                onChange={(e) => update({ agent_model_low_severity: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="claude-opus-4-20250514">Claude Opus 4</option>
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
              </select>
            </div>
          </div>
          <SliderField
            label="Model Switch Threshold"
            description="Severity at or above which the high-severity model is used"
            value={settings.agent_severity_model_threshold}
            onChange={(v) => update({ agent_severity_model_threshold: v })}
            min={1}
            max={10}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Alerts & Notifications Tab ────────────────────────────
function AlertsTab({
  settings,
  update,
}: {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Proximity Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Proximity Alert Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Alerts trigger when a risk event occurs within a set radius of your assets. Adjust the radius and
            minimum severity to control alert sensitivity.
          </p>
          <SliderField
            label="Alert Radius"
            description="Distance in kilometers from an asset to trigger a proximity alert"
            value={settings.proximity_alert_radius_km}
            onChange={(v) => update({ proximity_alert_radius_km: v })}
            min={50}
            max={2000}
            step={50}
            unit=" km"
          />
          <SliderField
            label="Minimum Severity"
            description="Only events at or above this severity trigger proximity alerts"
            value={settings.proximity_alert_min_severity}
            onChange={(v) => update({ proximity_alert_min_severity: v })}
            min={1}
            max={10}
          />
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notification Channels
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Toggle
            checked={settings.notification_in_app_enabled}
            onChange={(v) => update({ notification_in_app_enabled: v })}
            label="In-App Notifications"
            description="Show notifications in the platform notification center"
          />

          <div className="border-t border-border pt-4 space-y-3">
            <Toggle
              checked={settings.notification_email_enabled}
              onChange={(v) => update({ notification_email_enabled: v })}
              label="Email Notifications"
              description="Send alert emails for high-severity events and approval requests"
            />
            {settings.notification_email_enabled && (
              <Input
                type="email"
                placeholder="alerts@yourcompany.com"
                value={settings.notification_email_address}
                onChange={(e) => update({ notification_email_address: e.target.value })}
              />
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <Toggle
              checked={settings.notification_webhook_enabled}
              onChange={(v) => update({ notification_webhook_enabled: v })}
              label="Webhook Notifications"
              description="POST JSON payloads to a webhook URL (Slack, Teams, PagerDuty, etc.)"
            />
            {settings.notification_webhook_enabled && (
              <Input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={settings.notification_webhook_url}
                onChange={(e) => update({ notification_webhook_url: e.target.value })}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Connectors Tab (redirect) ─────────────────────────────
function ConnectorsRedirect() {
  // We render the connectors inline via Next.js routing
  // This is just a fallback — the tab click navigates to /dashboard/settings/connectors
  return null;
}

// ─── Main Settings Page ────────────────────────────────────
export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("governance");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.companies(COMPANY_ID).settings.get();
      setSettings({ ...DEFAULTS, ...(data as Partial<Settings>) });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
    setLoading(false);
  }

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    setDirty(true);
    setSaved(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.companies(COMPANY_ID).settings.update(settings);
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
    setSaving(false);
  }

  function handleReset() {
    setSettings(DEFAULTS);
    setDirty(true);
    setSaved(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure agent governance, alert rules, and platform preferences.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4" /> Reset to Defaults
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === "connectors") {
                  // Navigate to connectors sub-page
                  window.location.href = "/dashboard/settings/connectors";
                  return;
                }
                setTab(t.id);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          You have unsaved changes
        </div>
      )}

      {/* Tab Content */}
      {tab === "governance" && <GovernanceTab settings={settings} update={update} />}
      {tab === "alerts" && <AlertsTab settings={settings} update={update} />}
    </div>
  );
}
