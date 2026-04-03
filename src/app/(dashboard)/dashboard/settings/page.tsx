"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield, Bell, Save, Loader2, CheckCircle,
  AlertTriangle, Bot, Zap, Lock, Sliders, RotateCcw,
} from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

type Tab = "governance" | "alerts";

interface Settings {
  guardrail_auto_approve_max_severity: number;
  guardrail_require_approval_min_severity: number;
  guardrail_escalate_min_severity: number;
  guardrail_max_actions_per_hour: number;
  guardrail_approval_timeout_minutes: number;
  guardrail_blocked_actions: string[];
  proximity_alert_radius_km: number;
  proximity_alert_min_severity: number;
  agent_model_high_severity: string;
  agent_model_low_severity: string;
  agent_severity_model_threshold: number;
  agent_enabled: boolean;
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
  proximity_alert_radius_km: 100,
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
];

/* ── Reusable components ────────────────────────────────── */

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
      <div className="min-w-0">
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

function CompactSlider({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.5,
  unit = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-mono font-bold tabular-nums">
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-primary h-1.5"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

/* ── Agent Governance Tab (compact 2-col layout) ────────── */

function GovernanceTab({
  settings,
  update,
}: {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
}) {
  const [newBlockedAction, setNewBlockedAction] = useState("");

  return (
    <div className="space-y-4">
      {/* Row 1: Agent toggle + Severity band */}
      <div className="grid grid-cols-3 gap-4">
        {/* Agent toggle */}
        <Card className="col-span-1">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" /> Agent Status
            </div>
            <Toggle
              checked={settings.agent_enabled}
              onChange={(v) => update({ agent_enabled: v })}
              label={settings.agent_enabled ? "Active" : "Disabled"}
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">High-Severity Model</label>
                <select
                  value={settings.agent_model_high_severity}
                  onChange={(e) => update({ agent_model_high_severity: e.target.value })}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Low-Severity Model</label>
                <select
                  value={settings.agent_model_low_severity}
                  onChange={(e) => update({ agent_model_low_severity: e.target.value })}
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="claude-opus-4-20250514">Claude Opus 4</option>
                  <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                  <option value="claude-haiku-3-5-20241022">Claude Haiku 3.5</option>
                </select>
              </div>
            </div>
            <CompactSlider
              label="Model Switch Threshold"
              value={settings.agent_severity_model_threshold}
              onChange={(v) => update({ agent_severity_model_threshold: v })}
              min={1}
              max={10}
            />
          </CardContent>
        </Card>

        {/* Severity band visualization */}
        <Card className="col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Sliders className="h-4 w-4" /> Severity Response Thresholds
            </div>
            {/* Visual band */}
            <div className="mb-4 space-y-1.5">
              <div className="flex items-center gap-0.5 text-[10px] font-medium">
                <div className="flex-1 text-center">
                  <div className="h-4 rounded-l-full bg-green-500/80 flex items-center justify-center text-white">
                    Auto-Approve
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-4 bg-yellow-500/80 flex items-center justify-center text-white">
                    Notify
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-4 bg-orange-500/80 flex items-center justify-center text-white">
                    Approval Required
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="h-4 rounded-r-full bg-red-500/80 flex items-center justify-center text-white">
                    Escalate
                  </div>
                </div>
              </div>
              <div className="flex text-[10px] text-muted-foreground">
                <span className="flex-1 text-center">0 — {settings.guardrail_auto_approve_max_severity}</span>
                <span className="flex-1 text-center">{settings.guardrail_auto_approve_max_severity} — {settings.guardrail_require_approval_min_severity}</span>
                <span className="flex-1 text-center">{settings.guardrail_require_approval_min_severity} — {settings.guardrail_escalate_min_severity}</span>
                <span className="flex-1 text-center">{settings.guardrail_escalate_min_severity} — 10</span>
              </div>
            </div>

            {/* 3 sliders side by side */}
            <div className="grid grid-cols-3 gap-4">
              <CompactSlider
                label="Auto-Approve Max"
                value={settings.guardrail_auto_approve_max_severity}
                onChange={(v) => update({ guardrail_auto_approve_max_severity: v })}
                min={1}
                max={10}
              />
              <CompactSlider
                label="Require Approval"
                value={settings.guardrail_require_approval_min_severity}
                onChange={(v) => update({ guardrail_require_approval_min_severity: v })}
                min={1}
                max={10}
              />
              <CompactSlider
                label="Escalation"
                value={settings.guardrail_escalate_min_severity}
                onChange={(v) => update({ guardrail_escalate_min_severity: v })}
                min={1}
                max={10}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Rate limits + Blocked actions */}
      <div className="grid grid-cols-2 gap-4">
        {/* Rate Limits */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Zap className="h-4 w-4" /> Rate Limits
            </div>
            <div className="space-y-4">
              <CompactSlider
                label="Max Actions / Hour"
                value={settings.guardrail_max_actions_per_hour}
                onChange={(v) => update({ guardrail_max_actions_per_hour: v })}
                min={5}
                max={100}
                step={5}
              />
              <CompactSlider
                label="Approval Timeout"
                value={settings.guardrail_approval_timeout_minutes}
                onChange={(v) => update({ guardrail_approval_timeout_minutes: v })}
                min={15}
                max={480}
                step={15}
                unit=" min"
              />
            </div>
          </CardContent>
        </Card>

        {/* Blocked Actions */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm font-semibold mb-2">
              <Lock className="h-4 w-4" /> Blocked Actions
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              The agent will escalate instead of executing these actions.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {settings.guardrail_blocked_actions.map((action) => (
                <Badge key={action} variant="destructive" className="gap-1 text-xs">
                  {action.replace(/_/g, " ")}
                  <button
                    onClick={() =>
                      update({
                        guardrail_blocked_actions: settings.guardrail_blocked_actions.filter(
                          (a) => a !== action
                        ),
                      })
                    }
                    className="ml-0.5 hover:text-foreground"
                  >
                    x
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. delete_asset"
                className="h-8 text-xs"
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
                className="h-8 text-xs"
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
      </div>
    </div>
  );
}

/* ── Alerts & Notifications Tab (compact 2-col) ─────────── */

function AlertsTab({
  settings,
  update,
}: {
  settings: Settings;
  update: (partial: Partial<Settings>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Proximity Alerts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3">
            <AlertTriangle className="h-4 w-4" /> Proximity Alert Rules
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Alerts fire when a risk event occurs within a set radius of your assets.
          </p>
          <div className="space-y-4">
            <CompactSlider
              label="Alert Radius"
              value={settings.proximity_alert_radius_km}
              onChange={(v) => update({ proximity_alert_radius_km: v })}
              min={1}
              max={250}
              step={5}
              unit=" km"
            />
            <div className="text-xs text-muted-foreground">
              ≈ {Math.round(settings.proximity_alert_radius_km * 0.621371)} miles
            </div>
            <CompactSlider
              label="Min Severity"
              value={settings.proximity_alert_min_severity}
              onChange={(v) => update({ proximity_alert_min_severity: v })}
              min={1}
              max={10}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bell className="h-4 w-4" /> Notification Channels
          </div>

          <Toggle
            checked={settings.notification_in_app_enabled}
            onChange={(v) => update({ notification_in_app_enabled: v })}
            label="In-App Notifications"
            description="Notification center alerts"
          />

          <div className="border-t border-border pt-3 space-y-2">
            <Toggle
              checked={settings.notification_email_enabled}
              onChange={(v) => update({ notification_email_enabled: v })}
              label="Email Notifications"
              description="Alerts for high-severity events"
            />
            {settings.notification_email_enabled && (
              <Input
                type="email"
                placeholder="alerts@yourcompany.com"
                className="h-8 text-xs"
                value={settings.notification_email_address}
                onChange={(e) => update({ notification_email_address: e.target.value })}
              />
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-2">
            <Toggle
              checked={settings.notification_webhook_enabled}
              onChange={(v) => update({ notification_webhook_enabled: v })}
              label="Webhook"
              description="Slack, Teams, PagerDuty, etc."
            />
            {settings.notification_webhook_enabled && (
              <Input
                type="url"
                placeholder="https://hooks.slack.com/..."
                className="h-8 text-xs"
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

/* ── Main Settings Page ─────────────────────────────────── */

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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Agent governance, alert rules, and notification preferences.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <AlertTriangle className="h-3 w-3" /> Unsaved
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle className="h-3.5 w-3.5" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Saving..." : saved ? "Saved!" : "Save"}
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
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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

      {/* Tab Content */}
      {tab === "governance" && <GovernanceTab settings={settings} update={update} />}
      {tab === "alerts" && <AlertsTab settings={settings} update={update} />}
    </div>
  );
}
