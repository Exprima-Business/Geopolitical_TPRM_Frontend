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
  BookOpen, ChevronDown, ChevronRight, Plus, Trash2,
} from "lucide-react";
import {
  type ActionTemplate,
  type TemplateStep,
  DEFAULT_TEMPLATES,
  TEMPLATE_ICONS,
  loadTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resetTemplates,
} from "@/lib/action-templates";
import {
  type IntegrationConnection,
  loadConnections,
} from "@/lib/integration-connections";
import { INTEGRATIONS, findIntegration } from "@/lib/integrations";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

type Tab = "governance" | "alerts" | "templates";

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
  { id: "templates", label: "Action Templates", icon: BookOpen },
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

/* ── Action Templates Tab ───────────────────────────────── */

function TemplateCard({
  template,
  connections,
  onChange,
  onDelete,
}: {
  template: ActionTemplate;
  connections: IntegrationConnection[];
  onChange: (next: ActionTemplate) => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [newStep, setNewStep] = useState("");
  const [newRisk, setNewRisk] = useState("");
  const Icon = TEMPLATE_ICONS[template.action_key] ?? BookOpen;

  // Sensible default for a new step: pick the first configured connection and
  // its first capability. Falls back to webhook if no connections configured.
  const makeStep = (label: string): TemplateStep => {
    const firstConn = connections[0];
    const spec = firstConn ? findIntegration(firstConn.integration_id) : undefined;
    return {
      step_order: template.steps.length,
      label,
      integration_connection_id: firstConn?.id,
      integration_id: firstConn?.integration_id ?? "webhook",
      action_key: spec?.capabilities[0]?.action ?? "send_payload",
      params_template: {},
      required: false,
      timeout_seconds: 30,
    };
  };

  return (
    <Card className={!template.is_enabled ? "opacity-60" : ""}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">{template.name}</h3>
              {template.is_custom && (
                <Badge variant="outline" className="text-[10px]">Custom</Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                Severity {template.severity_min}–{template.severity_max}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span>⏱ {template.estimated_duration}</span>
              <span>👥 {template.required_roles.join(", ")}</span>
              <span>{template.steps.length} steps · {template.risks.length} risks</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={template.is_enabled}
              onClick={() => onChange({ ...template, is_enabled: !template.is_enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                template.is_enabled ? "bg-primary" : "bg-muted"
              }`}
              aria-label={template.is_enabled ? "Disable template" : "Enable template"}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
                  template.is_enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 border-t border-border pt-3">
            {/* Severity range */}
            <div className="grid grid-cols-2 gap-4">
              <CompactSlider
                label="Min Severity"
                value={template.severity_min}
                onChange={(v) =>
                  onChange({
                    ...template,
                    severity_min: v,
                    severity_max: Math.max(v, template.severity_max),
                  })
                }
                min={1}
                max={10}
              />
              <CompactSlider
                label="Max Severity"
                value={template.severity_max}
                onChange={(v) =>
                  onChange({
                    ...template,
                    severity_max: v,
                    severity_min: Math.min(v, template.severity_min),
                  })
                }
                min={1}
                max={10}
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Estimated Duration</label>
                <Input
                  className="h-8 text-xs"
                  value={template.estimated_duration}
                  onChange={(e) => onChange({ ...template, estimated_duration: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">
                  Required Roles (comma-separated)
                </label>
                <Input
                  className="h-8 text-xs"
                  value={template.required_roles.join(", ")}
                  onChange={(e) =>
                    onChange({
                      ...template,
                      required_roles: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>

            {/* Steps */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Playbook Steps
                </label>
                <span className="text-[10px] text-muted-foreground">{template.steps.length}</span>
              </div>
              {connections.length === 0 && (
                <div className="mb-2 p-2 rounded border border-yellow-400/30 bg-yellow-400/5 text-[11px] text-yellow-100/90">
                  <AlertTriangle className="h-3 w-3 inline mr-1 text-yellow-400" />
                  No integrations configured. Steps added here won&apos;t run until you connect an integration in
                  Settings → Integrations.
                </div>
              )}
              <ol className="space-y-2 mb-2">
                {template.steps.map((step, i) => {
                  const stepConn = step.integration_connection_id
                    ? connections.find((c) => c.id === step.integration_connection_id)
                    : connections.find((c) => c.integration_id === step.integration_id && c.is_enabled);
                  const stepSpec = findIntegration(step.integration_id);
                  const availableForSpec = connections.filter(
                    (c) => c.integration_id === step.integration_id,
                  );
                  const stepOpen = expandedStep === i;

                  return (
                    <li key={i} className="rounded-md border border-border bg-muted/20">
                      <div className="flex items-start gap-2 p-2">
                        <span className="text-[10px] text-muted-foreground font-mono mt-2 w-4 shrink-0">
                          {i + 1}.
                        </span>
                        <div className="flex-1 min-w-0 space-y-1">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Step label (shown on agent decision cards)"
                            value={step.label}
                            onChange={(e) => {
                              const steps = [...template.steps];
                              steps[i] = { ...steps[i], label: e.target.value };
                              onChange({ ...template, steps });
                            }}
                          />
                          <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                            <Badge
                              variant={stepConn?.status === "connected" ? "default" : "outline"}
                              className="text-[10px] px-1.5 py-0"
                            >
                              {stepSpec?.name ?? step.integration_id}
                            </Badge>
                            <span className="text-muted-foreground font-mono">·</span>
                            <span className="text-muted-foreground font-mono">{step.action_key}</span>
                            {stepConn ? (
                              <>
                                <span className="text-muted-foreground font-mono">·</span>
                                <span className="text-muted-foreground">{stepConn.display_name}</span>
                              </>
                            ) : (
                              <span className="text-red-400">· no matching connection</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => setExpandedStep(stepOpen ? null : i)}
                          className="text-muted-foreground hover:text-foreground p-1.5 shrink-0"
                          aria-label="Configure step"
                        >
                          {stepOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() =>
                            onChange({
                              ...template,
                              steps: template.steps
                                .filter((_, idx) => idx !== i)
                                .map((s, idx) => ({ ...s, step_order: idx })),
                            })
                          }
                          className="text-muted-foreground hover:text-red-400 p-1.5 shrink-0"
                          aria-label="Delete step"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {stepOpen && (
                        <div className="px-2 pb-3 pt-1 space-y-2 border-t border-border/60">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                                Integration
                              </label>
                              <select
                                value={step.integration_id}
                                onChange={(e) => {
                                  const newIntegrationId = e.target.value;
                                  const spec = findIntegration(newIntegrationId);
                                  const conn = connections.find(
                                    (c) => c.integration_id === newIntegrationId,
                                  );
                                  const steps = [...template.steps];
                                  steps[i] = {
                                    ...steps[i],
                                    integration_id: newIntegrationId,
                                    integration_connection_id: conn?.id,
                                    action_key: spec?.capabilities[0]?.action ?? steps[i].action_key,
                                  };
                                  onChange({ ...template, steps });
                                }}
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                              >
                                {INTEGRATIONS.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                                Connection
                              </label>
                              <select
                                value={step.integration_connection_id ?? ""}
                                onChange={(e) => {
                                  const steps = [...template.steps];
                                  steps[i] = {
                                    ...steps[i],
                                    integration_connection_id: e.target.value || undefined,
                                  };
                                  onChange({ ...template, steps });
                                }}
                                className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                                disabled={availableForSpec.length === 0}
                              >
                                {availableForSpec.length === 0 ? (
                                  <option value="">(none configured)</option>
                                ) : (
                                  <>
                                    <option value="">First connected (automatic)</option>
                                    {availableForSpec.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.display_name} {c.status === "connected" ? "✓" : ""}
                                      </option>
                                    ))}
                                  </>
                                )}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                              Action
                            </label>
                            <select
                              value={step.action_key}
                              onChange={(e) => {
                                const steps = [...template.steps];
                                steps[i] = { ...steps[i], action_key: e.target.value };
                                onChange({ ...template, steps });
                              }}
                              className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                            >
                              {(stepSpec?.capabilities ?? []).map((cap) => (
                                <option key={cap.action} value={cap.action}>
                                  {cap.label}
                                </option>
                              ))}
                            </select>
                            {stepSpec?.capabilities.find((c) => c.action === step.action_key) && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                {
                                  stepSpec.capabilities.find((c) => c.action === step.action_key)
                                    ?.description
                                }
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase block mb-1">
                              Params (JSON, supports {"{{event.title}}"}, {"{{asset.name}}"}, etc.)
                            </label>
                            <textarea
                              className="flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-[11px] font-mono min-h-[72px]"
                              value={JSON.stringify(step.params_template ?? {}, null, 2)}
                              onChange={(e) => {
                                const steps = [...template.steps];
                                try {
                                  steps[i] = {
                                    ...steps[i],
                                    params_template: e.target.value
                                      ? JSON.parse(e.target.value)
                                      : {},
                                  };
                                  onChange({ ...template, steps });
                                } catch {
                                  // Ignore invalid JSON while typing
                                }
                              }}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <label className="flex items-center gap-2 text-[11px]">
                              <input
                                type="checkbox"
                                checked={step.required}
                                onChange={(e) => {
                                  const steps = [...template.steps];
                                  steps[i] = { ...steps[i], required: e.target.checked };
                                  onChange({ ...template, steps });
                                }}
                              />
                              Required (halt pipeline on failure)
                            </label>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="text-muted-foreground">Timeout</span>
                              <Input
                                type="number"
                                min={1}
                                max={300}
                                className="h-7 text-xs w-20"
                                value={step.timeout_seconds}
                                onChange={(e) => {
                                  const steps = [...template.steps];
                                  steps[i] = {
                                    ...steps[i],
                                    timeout_seconds: Math.max(1, Math.min(300, Number(e.target.value) || 30)),
                                  };
                                  onChange({ ...template, steps });
                                }}
                              />
                              <span className="text-muted-foreground">sec</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Add step..."
                  value={newStep}
                  onChange={(e) => setNewStep(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newStep.trim()) {
                      onChange({
                        ...template,
                        steps: [...template.steps, makeStep(newStep.trim())],
                      });
                      setNewStep("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!newStep.trim()}
                  onClick={() => {
                    onChange({
                      ...template,
                      steps: [...template.steps, makeStep(newStep.trim())],
                    });
                    setNewStep("");
                  }}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>

            {/* Risks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Risks of Action
                </label>
                <span className="text-[10px] text-muted-foreground">{template.risks.length}</span>
              </div>
              <ul className="space-y-1.5 mb-2">
                {template.risks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 mt-2 shrink-0" />
                    <Input
                      className="h-8 text-xs"
                      value={risk}
                      onChange={(e) => {
                        const risks = [...template.risks];
                        risks[i] = e.target.value;
                        onChange({ ...template, risks });
                      }}
                    />
                    <button
                      onClick={() =>
                        onChange({
                          ...template,
                          risks: template.risks.filter((_, idx) => idx !== i),
                        })
                      }
                      className="text-muted-foreground hover:text-red-400 p-1.5 shrink-0"
                      aria-label="Delete risk"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-xs"
                  placeholder="Add risk..."
                  value={newRisk}
                  onChange={(e) => setNewRisk(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newRisk.trim()) {
                      onChange({ ...template, risks: [...template.risks, newRisk.trim()] });
                      setNewRisk("");
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!newRisk.trim()}
                  onClick={() => {
                    onChange({ ...template, risks: [...template.risks, newRisk.trim()] });
                    setNewRisk("");
                  }}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
            </div>

            {template.is_custom && onDelete && (
              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Template
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TemplatesTab({
  templates,
  connections,
  onLocalChange,
  onPersist,
  onDelete,
  onCreate,
}: {
  templates: ActionTemplate[];
  connections: IntegrationConnection[];
  onLocalChange: (next: ActionTemplate[]) => void;
  onPersist: (tpl: ActionTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (tpl: ActionTemplate) => Promise<void>;
}) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAction, setNewAction] = useState("");

  function handleChange(id: string | undefined, next: ActionTemplate) {
    onLocalChange(templates.map((t) => (t.id === id ? next : t)));
    if (id) void onPersist(next);
  }

  function handleDelete(id: string | undefined) {
    if (!id) return;
    onLocalChange(templates.filter((t) => t.id !== id));
    void onDelete(id);
  }

  function addCustom() {
    const action = newAction.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!newName.trim() || !action) return;
    const tpl: ActionTemplate = {
      action_key: action,
      name: newName.trim(),
      description: "Custom action template.",
      severity_min: 5,
      severity_max: 8,
      estimated_duration: "TBD",
      required_roles: [],
      steps: [],
      risks: [],
      is_enabled: true,
      is_custom: true,
    };
    void onCreate(tpl);
    setNewName("");
    setNewAction("");
    setShowNewForm(false);
  }

  const enabledCount = templates.filter((t) => t.is_enabled).length;

  return (
    <div className="space-y-4">
      {/* Summary + controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Response Playbooks</h2>
                <p className="text-xs text-muted-foreground">
                  Predefined action templates the agent selects from when recommending mitigations.{" "}
                  <span className="text-foreground font-medium">{enabledCount} enabled</span> of {templates.length}.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewForm((x) => !x)}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New Template
            </Button>
          </div>

          {showNewForm && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-[1fr_1fr_auto] gap-2">
              <Input
                placeholder="Template name (e.g. Isolate Network Segment)"
                className="h-8 text-xs"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Input
                placeholder="action_key (e.g. isolate_network)"
                className="h-8 text-xs font-mono"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!newName.trim() || !newAction.trim()}
                onClick={addCustom}
              >
                Create
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template cards */}
      <div className="space-y-3">
        {templates.map((tpl) => (
          <TemplateCard
            key={tpl.id ?? tpl.action_key}
            template={tpl}
            connections={connections}
            onChange={(next) => handleChange(tpl.id, next)}
            onDelete={tpl.is_custom ? () => handleDelete(tpl.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Main Settings Page ─────────────────────────────────── */

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("governance");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [templates, setTemplatesState] = useState<ActionTemplate[]>(DEFAULT_TEMPLATES);
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTemplates(COMPANY_ID).then(setTemplatesState).catch(console.error);
    loadConnections(COMPANY_ID).then(setConnections).catch(console.error);
  }, []);

  async function persistTemplate(tpl: ActionTemplate) {
    if (!tpl.id) return;
    try {
      const next = await updateTemplate(COMPANY_ID, tpl.id, {
        name: tpl.name,
        description: tpl.description,
        severity_min: tpl.severity_min,
        severity_max: tpl.severity_max,
        estimated_duration: tpl.estimated_duration,
        required_roles: tpl.required_roles,
        risks: tpl.risks,
        is_enabled: tpl.is_enabled,
        steps: tpl.steps,
      });
      setTemplatesState((prev) => prev.map((t) => (t.id === next.id ? next : t)));
    } catch (err) {
      console.error("Failed to save template:", err);
    }
  }

  async function createNewTemplate(tpl: ActionTemplate) {
    try {
      const created = await createTemplate(COMPANY_ID, tpl);
      setTemplatesState((prev) => [...prev, created]);
    } catch (err) {
      console.error("Failed to create template:", err);
    }
  }

  async function removeTemplate(id: string) {
    try {
      await deleteTemplate(COMPANY_ID, id);
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  }

  async function resetTemplatesToDefaults() {
    try {
      setTemplatesState(await resetTemplates(COMPANY_ID));
    } catch (err) {
      console.error("Failed to reset templates:", err);
    }
  }

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
          {tab === "templates" ? (
            <>
              <span className="text-xs text-muted-foreground">Templates auto-save</span>
              <Button variant="outline" size="sm" onClick={resetTemplatesToDefaults}>
                <RotateCcw className="h-3.5 w-3.5" /> Reset Templates
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
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
      {tab === "templates" && (
        <TemplatesTab
          templates={templates}
          connections={connections}
          onLocalChange={setTemplatesState}
          onPersist={persistTemplate}
          onDelete={removeTemplate}
          onCreate={createNewTemplate}
        />
      )}
      {tab === "alerts" && <AlertsTab settings={settings} update={update} />}
    </div>
  );
}
