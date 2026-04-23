"use client";

import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getSeverityLabel } from "@/lib/risk-utils";
import {
  type ActionTemplate,
  loadTemplates,
  findTemplateForAction,
  TEMPLATE_ICONS,
} from "@/lib/action-templates";
import type { RiskEvent } from "@/types";
import {
  Bot, CheckCircle, XCircle, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Shield, Zap, Eye, Send,
  Clock, FileText, Brain, Wrench, ArrowRight, Activity,
  BarChart3, Target, Info, BookOpen, Users, Gauge,
  Lightbulb, TrendingUp,
} from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

/* ── Reasoning parser ───────────────────────────────────── */

/**
 * The agent returns reasoning text with markdown-ish inline labels like:
 *   **Business Impact Risk Level:** Low **Recommended Action:** Monitor
 *   **Justification:** Despite ...
 * Parse it into structured sections so the UI can render them with visual
 * hierarchy instead of a wall of text.
 */
interface ParsedReasoning {
  sections: { label: string; value: string }[];
  remainder: string;
}

function parseReasoning(text: string): ParsedReasoning {
  if (!text) return { sections: [], remainder: "" };

  // Split on bold-labelled segments: **Label:** value
  const pattern = /\*\*([^*]+?):\*\*\s*/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) {
    return { sections: [], remainder: text.trim() };
  }

  const sections: { label: string; value: string }[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const label = match[1].trim();
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    let value = text.slice(start, end).trim();
    // Strip trailing **
    value = value.replace(/\s*\*\*\s*$/g, "").trim();
    sections.push({ label, value });
  }

  // Anything before the first bold label is preamble; keep it as remainder.
  const preamble = text.slice(0, matches[0].index).trim();
  return { sections, remainder: preamble };
}

/** Map a parsed label to an icon + color */
function labelVisuals(label: string): { icon: typeof Shield; color: string } {
  const lower = label.toLowerCase();
  if (lower.includes("risk level") || lower.includes("severity")) return { icon: Gauge, color: "text-orange-400" };
  if (lower.includes("recommended action") || lower.includes("action")) return { icon: Zap, color: "text-blue-400" };
  if (lower.includes("justification") || lower.includes("reasoning")) return { icon: Lightbulb, color: "text-yellow-400" };
  if (lower.includes("assessment") || lower.includes("summary")) return { icon: FileText, color: "text-primary" };
  if (lower.includes("actions taken")) return { icon: CheckCircle, color: "text-emerald-400" };
  if (lower.includes("recommendation")) return { icon: TrendingUp, color: "text-cyan-400" };
  if (lower.includes("impact")) return { icon: Target, color: "text-purple-400" };
  return { icon: Info, color: "text-muted-foreground" };
}

/** Color a risk-level value (Low/Medium/High/Critical) */
function riskLevelStyle(value: string): { bg: string; text: string; border: string } | null {
  const v = value.toLowerCase().trim().split(/\s+/)[0].replace(/[.,]/g, "");
  switch (v) {
    case "critical":
      return { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/40" };
    case "high":
      return { bg: "bg-orange-500/20", text: "text-orange-300", border: "border-orange-500/40" };
    case "medium":
    case "moderate":
      return { bg: "bg-yellow-500/20", text: "text-yellow-300", border: "border-yellow-500/40" };
    case "low":
      return { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/40" };
    case "negligible":
    case "minimal":
      return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
    default:
      return null;
  }
}

/** Render inline **bold** within a string to JSX */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Reasoning panel (compact, always-visible) ──────────── */

/**
 * Short-value section rendered as a tight icon + label + value pill. Fixed
 * width so it doesn't expand full-bleed. Severity-coded when the section is
 * a risk level.
 */
function ReasoningPill({
  section,
}: {
  section: { label: string; value: string };
}) {
  const { icon: Icon, color } = labelVisuals(section.label);
  const isRiskLevel = /risk level|severity|impact/i.test(section.label);
  const riskStyle = isRiskLevel ? riskLevelStyle(section.value) : null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${
        riskStyle ? `${riskStyle.bg} ${riskStyle.border}` : "bg-muted/40 border-border"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${riskStyle?.text ?? color}`} />
      <div className="leading-tight">
        <div
          className={`text-[9px] uppercase tracking-wide font-semibold ${
            riskStyle?.text ?? "text-muted-foreground"
          }`}
        >
          {section.label}
        </div>
        <div
          className={`text-sm font-bold whitespace-nowrap ${
            riskStyle?.text ?? "text-foreground"
          }`}
        >
          {section.value}
        </div>
      </div>
    </div>
  );
}

/**
 * Long-form section rendered as a labeled, bordered box. Uses line-clamp to
 * keep height bounded when collapsed; expands to show full text when the
 * card is expanded.
 */
function ReasoningBox({
  section,
  full,
}: {
  section: { label: string; value: string };
  full: boolean;
}) {
  const { icon: Icon, color } = labelVisuals(section.label);
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2.5 py-1.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <span className="text-[9px] uppercase tracking-wide font-semibold text-muted-foreground">
          {section.label}
        </span>
      </div>
      <p
        className={`text-xs leading-relaxed text-foreground/90 ${
          full ? "" : "line-clamp-2"
        }`}
      >
        {renderInline(section.value)}
      </p>
    </div>
  );
}

/**
 * Severity number → pill matching the same color scale as parsed risk-level
 * sections. Expects 0–10. "Severity 7.4 / 10" format with a tiny meter bar.
 */
function EventSeverityPill({ severity }: { severity: number }) {
  const level =
    severity >= 8 ? "critical" :
    severity >= 6 ? "high" :
    severity >= 4 ? "medium" : "low";
  const style = riskLevelStyle(level) ?? {
    bg: "bg-muted/40",
    text: "text-muted-foreground",
    border: "border-border",
  };
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${style.bg} ${style.border}`}
    >
      <Gauge className={`h-3.5 w-3.5 shrink-0 ${style.text}`} />
      <div className="leading-tight">
        <div className={`text-[9px] uppercase tracking-wide font-semibold ${style.text}`}>
          Event Severity
        </div>
        <div className={`text-sm font-bold ${style.text}`}>
          {severity.toFixed(1)} / 10
        </div>
      </div>
    </div>
  );
}

function EventContextBadge({
  title, region, country_code, started_at,
}: {
  title?: string | null;
  region?: string | null;
  country_code?: string | null;
  started_at?: string | null;
}) {
  const location = [region, country_code].filter(Boolean).join(", ");
  const started = started_at ? new Date(started_at).toLocaleString() : null;
  return (
    <div className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
      <Info className="h-3 w-3 mt-0.5 shrink-0" />
      <div className="min-w-0">
        {title && <span className="text-foreground/90 font-medium">{title}</span>}
        {location && <span> · {location}</span>}
        {started && <span> · started {started}</span>}
      </div>
    </div>
  );
}

function CompactReasoning({
  reasoning,
  expanded,
}: {
  reasoning: string;
  expanded: boolean;
}) {
  const parsed = parseReasoning(reasoning);

  if (parsed.sections.length === 0) {
    return (
      <p
        className={`text-sm text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}
      >
        {renderInline(parsed.remainder)}
      </p>
    );
  }

  // Split into "headline" pills (short, scannable) and "detail" boxes
  // (justification, recommendation, etc.). Pills render inline at their
  // natural width; detail boxes fill remaining horizontal space.
  const pills: { label: string; value: string }[] = [];
  const boxes: { label: string; value: string }[] = [];
  for (const sec of parsed.sections) {
    const short = sec.value.length <= 40 && !sec.value.includes("\n");
    if (short) pills.push(sec);
    else boxes.push(sec);
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      {pills.map((sec, i) => (
        <ReasoningPill key={`p-${i}`} section={sec} />
      ))}
      {boxes.map((sec, i) => (
        <div key={`b-${i}`} className="flex-1 min-w-[220px]">
          <ReasoningBox section={sec} full={expanded} />
        </div>
      ))}
    </div>
  );
}

function parseList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) return (data as { items: T[] }).items || [];
  return [];
}

/* ── Type definitions ───────────────────────────────────── */

interface ToolCallLog {
  iteration: number;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown>;
  success: boolean;
  duration_ms: number;
  timestamp: string;
}

interface AgentThinking {
  iteration: number;
  text: string;
  timestamp: string;
}

interface AgentDecisionSummary {
  id: string;
  decision_type: string;
  action: string;
  approval_status: string;
  guardrail_level?: string;
  reasoning?: string;
  confidence?: number;
  asset_id?: string;
}

interface AgentRunResult {
  risk_event_id: string;
  model_used: string;
  decisions: AgentDecisionSummary[];
  tool_calls: ToolCallLog[];
  thinking: AgentThinking[];
  summary?: string;
  tool_calls_made: number;
  iterations: number;
  completed: boolean;
  error?: string;
}

interface AgentDecision {
  id: string;
  company_id: string;
  risk_event_id: string | null;
  asset_id: string | null;
  decision_type: string;
  action: string;
  reasoning: string | null;
  confidence: number | null;
  guardrail_checks: Record<string, unknown> | null;
  approval_status: string;
  approved_by: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined from risk_events server-side so the UI can show severity / location
  // without a second round-trip.
  event_title?: string | null;
  event_severity?: number | null;
  event_category?: string | null;
  event_country_code?: string | null;
  event_region?: string | null;
  event_started_at?: string | null;
}

/* ── Constants ──────────────────────────────────────────── */

const DECISION_ICONS: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  assess: { icon: Eye, color: "text-blue-400", label: "Assessment" },
  mitigate: { icon: Shield, color: "text-green-400", label: "Mitigation" },
  alert: { icon: Send, color: "text-yellow-400", label: "Alert" },
  escalate: { icon: AlertTriangle, color: "text-red-400", label: "Escalation" },
};

const TOOL_ICONS: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  find_nearby_assets: { icon: Target, color: "text-cyan-400", label: "Find Nearby Assets" },
  assess_risk_for_asset: { icon: Eye, color: "text-blue-400", label: "Assess Asset Risk" },
  propose_mitigation: { icon: Shield, color: "text-green-400", label: "Propose Mitigation" },
  send_alert: { icon: Send, color: "text-yellow-400", label: "Send Alert" },
  escalate_to_human: { icon: AlertTriangle, color: "text-red-400", label: "Escalate to Human" },
};

const ACTION_LABELS: Record<string, string> = {
  increase_monitoring: "Increase Monitoring",
  notify_vendor: "Notify Vendor",
  activate_backup: "Activate Backup Systems",
  reroute: "Reroute Traffic / Supply Chain",
  failover: "Failover to DR",
  escalate_to_human: "Escalate to Human Review",
  assess_risk_for_asset: "Risk Assessment",
};

const APPROVAL_BADGES: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
  auto_approved: { variant: "default", label: "Auto-Approved" },
  approved: { variant: "default", label: "Approved" },
  pending_approval: { variant: "secondary", label: "Pending Approval" },
  rejected: { variant: "destructive", label: "Rejected" },
  expired: { variant: "outline", label: "Expired" },
};

/* ── Activity Feed Item ─────────────────────────────────── */

function ThinkingBlock({ entry }: { entry: AgentThinking }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Brain className="h-4 w-4 text-purple-400" />
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-purple-400">Agent Reasoning</span>
          <span className="text-[10px] text-muted-foreground">Step {entry.iteration}</span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{entry.text}</p>
      </div>
    </div>
  );
}

function ToolCallBlock({ entry }: { entry: ToolCallLog }) {
  const [expanded, setExpanded] = useState(false);
  const toolInfo = TOOL_ICONS[entry.tool_name] || { icon: Wrench, color: "text-muted-foreground", label: entry.tool_name };
  const Icon = toolInfo.icon;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${entry.success ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
          <Icon className={`h-4 w-4 ${entry.success ? toolInfo.color : "text-red-400"}`} />
        </div>
        <div className="w-px flex-1 bg-border mt-1" />
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{toolInfo.label}</span>
            <Badge variant={entry.success ? "default" : "destructive"} className="text-[10px] px-1.5 py-0">
              {entry.success ? "OK" : "Failed"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{entry.duration_ms}ms</span>
            <span className="text-[10px] text-muted-foreground">Step {entry.iteration}</span>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Always show a brief summary */}
        <div className="text-xs text-muted-foreground mt-1">
          {summarizeToolCall(entry)}
        </div>

        {expanded && (
          <div className="mt-2 space-y-2">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Input</span>
              <pre className="mt-1 p-2 rounded bg-muted/50 text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto">
                {JSON.stringify(entry.tool_input, null, 2)}
              </pre>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Output</span>
              <pre className={`mt-1 p-2 rounded text-xs font-mono overflow-x-auto max-h-40 overflow-y-auto ${entry.success ? "bg-muted/50" : "bg-red-500/10"}`}>
                {JSON.stringify(entry.tool_output, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function summarizeToolCall(entry: ToolCallLog): string {
  const input = entry.tool_input;
  const output = entry.tool_output;

  switch (entry.tool_name) {
    case "find_nearby_assets": {
      const count = (output as { assets_found?: number })?.assets_found || 0;
      const radius = (input as { radius_km?: number })?.radius_km || 500;
      const title = (output as { event_title?: string })?.event_title || "";
      return count > 0
        ? `Found ${count} assets within ${radius}km of "${title}"`
        : `No assets found within ${radius}km — event has low direct impact`;
    }
    case "assess_risk_for_asset": {
      const name = (output as { asset_name?: string })?.asset_name || "asset";
      const dist = (output as { distance_km?: number })?.distance_km;
      const level = (output as { risk_level?: string })?.risk_level || "";
      return `Assessed "${name}"${dist != null ? ` (${dist}km away)` : ""} — ${level} risk`;
    }
    case "propose_mitigation": {
      const action = (input as { action_type?: string })?.action_type || "action";
      const assetName = (output as { asset_name?: string })?.asset_name || "";
      const status = (output as { approval_status?: string })?.approval_status || "";
      return `Proposed "${action.replace(/_/g, " ")}" for ${assetName} — ${status.replace(/_/g, " ")}`;
    }
    case "send_alert": {
      const channel = (input as { channel?: string })?.channel || "notification";
      return `Sent ${channel} alert to stakeholders`;
    }
    case "escalate_to_human":
      return `Escalated for human review — awaiting approval`;
    default:
      return `Called ${entry.tool_name}`;
  }
}

/* ── Agent Run Result Panel ─────────────────────────────── */

function RunResultPanel({
  result,
  eventTitle,
}: {
  result: AgentRunResult;
  eventTitle: string;
}) {
  // Interleave thinking and tool calls by iteration order
  const activityFeed: { type: "thinking" | "tool"; entry: AgentThinking | ToolCallLog; sortKey: string }[] = [];

  for (const t of result.thinking) {
    activityFeed.push({ type: "thinking", entry: t, sortKey: `${t.iteration}-0-${t.timestamp}` });
  }
  for (const tc of result.tool_calls) {
    activityFeed.push({ type: "tool", entry: tc, sortKey: `${tc.iteration}-1-${tc.timestamp}` });
  }
  activityFeed.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Agent Analysis Results
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={result.completed ? "default" : "destructive"}>
              {result.completed ? "Completed" : "Failed"}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Event: <span className="font-medium text-foreground">{eventTitle}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-lg font-bold">{result.iterations}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Iterations</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-lg font-bold">{result.tool_calls_made}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Tool Calls</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-lg font-bold">{result.decisions.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Decisions</div>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <div className="text-xs font-mono font-bold truncate">{result.model_used.replace("claude-", "").replace("-20250514", "")}</div>
            <div className="text-[10px] text-muted-foreground uppercase">Model</div>
          </div>
        </div>

        {/* Error banner */}
        {result.error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            <strong>Error:</strong> {result.error}
          </div>
        )}

        {/* Summary */}
        {result.summary && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Agent Summary</span>
            </div>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>
        )}

        {/* Activity Feed */}
        {activityFeed.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4" /> Activity Log
            </h3>
            <div className="pl-1">
              {activityFeed.map((item, i) => (
                item.type === "thinking" ? (
                  <ThinkingBlock key={`t-${i}`} entry={item.entry as AgentThinking} />
                ) : (
                  <ToolCallBlock key={`tc-${i}`} entry={item.entry as ToolCallLog} />
                )
              ))}
              {/* End marker */}
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-muted-foreground">Analysis complete</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Decisions created */}
        {result.decisions.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" /> Decisions Created
            </h3>
            <div className="space-y-2">
              {result.decisions.map((d) => {
                const typeInfo = DECISION_ICONS[d.decision_type] || DECISION_ICONS.assess;
                const Icon = typeInfo.icon;
                const approvalInfo = APPROVAL_BADGES[d.approval_status] || APPROVAL_BADGES.pending_approval;
                return (
                  <div key={d.id} className="flex items-start gap-2 p-2 rounded bg-muted/30">
                    <Icon className={`h-4 w-4 mt-0.5 ${typeInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{ACTION_LABELS[d.action] || d.action}</span>
                        <Badge variant={approvalInfo.variant} className="text-[10px] px-1.5 py-0">
                          {approvalInfo.label}
                        </Badge>
                        {d.guardrail_level && (
                          <span className="text-[10px] text-muted-foreground">Guardrail: {d.guardrail_level}</span>
                        )}
                      </div>
                      {d.reasoning && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{d.reasoning}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Matched Playbook Block ─────────────────────────────── */

function TemplatePlaybookBlock({ template }: { template: ActionTemplate }) {
  const Icon = TEMPLATE_ICONS[template.action_key] ?? BookOpen;
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{template.name}</span>
            <Badge variant="outline" className="text-[10px]">
              Matched Playbook
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              Severity {template.severity_min}–{template.severity_max}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {template.estimated_duration}
            </span>
            {template.required_roles.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {template.required_roles.join(", ")}
              </span>
            )}
          </div>
        </div>
      </div>

      {template.steps.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
            Playbook Steps
          </div>
          <ol className="space-y-1">
            {template.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="text-muted-foreground font-mono w-4 shrink-0">{i + 1}.</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {template.risks.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">
            Risks of Action
          </div>
          <ul className="space-y-1">
            {template.risks.map((risk, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-yellow-400 mt-0.5 shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground italic border-t border-primary/10 pt-2">
        Playbook configured in{" "}
        <a href="/dashboard/settings" className="text-primary underline">
          Settings → Action Templates
        </a>
      </div>
    </div>
  );
}

/* ── Guardrail checks (why this was classified) ─────────── */

/**
 * Render the `guardrail_checks` JSON in a structured way so the user can
 * see exactly which threshold drove the decision. The backend writes:
 *   {
 *     severity, asset_count, proximity_radius_km, model_used,
 *     thresholds: { approve_min, escalate_min, ... },
 *     threshold_applied: "escalate_min_severity" | ...,
 *     source: "auto_triage" | ...,
 *     ...
 *   }
 * We pick out the most important keys and present them as badges with a
 * human-readable explanation line up top.
 */
function GuardrailChecksPanel({
  checks,
  severity,
}: {
  checks: Record<string, unknown>;
  severity: number | null;
}) {
  const thresholds = (checks.thresholds ?? {}) as Record<string, number>;
  const thresholdApplied = checks.threshold_applied as string | undefined;
  const proximityRadius = checks.proximity_radius_km as number | undefined;
  const modelUsed = checks.model_used as string | undefined;
  const assetCount = checks.asset_count as number | undefined;
  const source = checks.source as string | undefined;

  // Build a one-liner: which rule fired?
  let explanation: string | null = null;
  if (thresholdApplied && severity != null) {
    if (thresholdApplied === "escalate_min_severity" && thresholds.escalate_min != null) {
      explanation = `Severity ${severity.toFixed(1)} ≥ ${thresholds.escalate_min.toFixed(1)} escalation threshold → escalated`;
    } else if (thresholdApplied === "require_approval_min_severity" && thresholds.approve_min != null) {
      explanation = `Severity ${severity.toFixed(1)} ≥ ${thresholds.approve_min.toFixed(1)} approval threshold → pending approval`;
    } else if (thresholdApplied === "below_approval_threshold" && thresholds.approve_min != null) {
      explanation = `Severity ${severity.toFixed(1)} < ${thresholds.approve_min.toFixed(1)} approval threshold → auto-approved`;
    } else if (thresholdApplied === "proximity_proximity" && assetCount != null) {
      explanation = `${assetCount} asset(s) within proximity radius → escalated for review`;
    }
  }

  return (
    <div className="space-y-2">
      {explanation && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs text-foreground/90">
          {explanation}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {severity != null && (
          <GuardrailPill label="Severity" value={severity.toFixed(1)} />
        )}
        {thresholds.approve_min != null && (
          <GuardrailPill label="Approve ≥" value={thresholds.approve_min.toFixed(1)} />
        )}
        {thresholds.escalate_min != null && (
          <GuardrailPill label="Escalate ≥" value={thresholds.escalate_min.toFixed(1)} />
        )}
        {proximityRadius != null && (
          <GuardrailPill label="Proximity radius" value={`${proximityRadius} km`} />
        )}
        {assetCount != null && (
          <GuardrailPill label="Assets in radius" value={String(assetCount)} />
        )}
        {modelUsed && (
          <GuardrailPill label="Model" value={modelUsed.replace("claude-", "").replace(/-\d{8}$/, "")} />
        )}
        {source && (
          <GuardrailPill label="Source" value={source} />
        )}
      </div>
    </div>
  );
}

function GuardrailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-1 rounded border border-border bg-muted/30 inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

/* ── Action executions audit log ────────────────────────── */

interface ActionExecution {
  id: string;
  integration_id: string;
  action_key: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  request_method: string | null;
  request_url: string | null;
  response_status: number | null;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function ExecutionStatusBadge({ status }: { status: ActionExecution["status"] }) {
  if (status === "success") {
    return (
      <Badge variant="default" className="text-[10px] gap-1">
        <CheckCircle className="h-3 w-3" /> Success
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1">
        <XCircle className="h-3 w-3" /> Failed
      </Badge>
    );
  }
  if (status === "running") {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  }
  if (status === "skipped") {
    return (
      <Badge variant="outline" className="text-[10px]">Skipped</Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}

function ExecutionsPanel({ decisionId }: { decisionId: string }) {
  const [executions, setExecutions] = useState<ActionExecution[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .companies(COMPANY_ID)
      .executions.list({ agent_decision_id: decisionId, page_size: "50" })
      .then((data) => {
        if (cancelled) return;
        const items = (data as { items?: ActionExecution[] })?.items ?? [];
        setExecutions(items);
      })
      .catch(() => {
        if (!cancelled) setExecutions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [decisionId]);

  if (loading) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading executions…
      </div>
    );
  }

  if (!executions || executions.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
          <Zap className="h-3.5 w-3.5" /> Execution Log
        </h4>
        <p className="text-xs text-muted-foreground italic">
          No integration calls attempted for this decision.
        </p>
      </div>
    );
  }

  const succeeded = executions.filter((e) => e.status === "success").length;
  const failed = executions.filter((e) => e.status === "failed").length;
  const skipped = executions.filter((e) => e.status === "skipped").length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold flex items-center gap-1">
          <Zap className="h-3.5 w-3.5" /> Execution Log
          <span className="text-muted-foreground font-normal">({executions.length})</span>
        </h4>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {succeeded > 0 && <span className="text-emerald-400">{succeeded} success</span>}
          {failed > 0 && <span className="text-red-400">{failed} failed</span>}
          {skipped > 0 && <span>{skipped} skipped</span>}
        </div>
      </div>
      <div className="space-y-2">
        {executions.map((ex) => (
          <div key={ex.id} className="rounded-md border border-border bg-muted/20 p-2 text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {ex.integration_id}
                </Badge>
                <span className="font-mono text-muted-foreground">{ex.action_key}</span>
                <ExecutionStatusBadge status={ex.status} />
                {ex.response_status != null && (
                  <span className="text-muted-foreground">HTTP {ex.response_status}</span>
                )}
                {ex.duration_ms != null && (
                  <span className="text-muted-foreground">{ex.duration_ms}ms</span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(ex.created_at).toLocaleTimeString()}
              </span>
            </div>
            {ex.request_url && (
              <div className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
                {ex.request_method} {ex.request_url}
              </div>
            )}
            {ex.error_message && (
              <div className="mt-1 text-[11px] text-red-400">{ex.error_message}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Decision Card (for history/pending) ────────────────── */

function DecisionCard({
  decision,
  templates,
  onApprove,
  onReject,
}: {
  decision: AgentDecision;
  templates: ActionTemplate[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = DECISION_ICONS[decision.decision_type] || DECISION_ICONS.assess;
  const Icon = typeInfo.icon;
  const approvalInfo = APPROVAL_BADGES[decision.approval_status] || APPROVAL_BADGES.pending_approval;
  const matchedTemplate = findTemplateForAction(decision.action, templates);

  return (
    <Card className={decision.approval_status === "pending_approval" ? "border-yellow-500/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${typeInfo.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium">{ACTION_LABELS[decision.action] || decision.action}</h3>
                <Badge variant={approvalInfo.variant} className="text-xs">
                  {approvalInfo.label}
                </Badge>
                {matchedTemplate && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <BookOpen className="h-3 w-3" /> {matchedTemplate.name}
                  </Badge>
                )}
              </div>
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
              <span className={typeInfo.color}>{typeInfo.label}</span>
              {decision.confidence != null && (
                <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
              )}
              <span><Clock className="h-3 w-3 inline mr-1" />{new Date(decision.created_at).toLocaleString()}</span>
            </div>

            {/* Event context — title / location / when */}
            {(decision.event_title || decision.event_region) && (
              <EventContextBadge
                title={decision.event_title}
                region={decision.event_region}
                country_code={decision.event_country_code}
                started_at={decision.event_started_at}
              />
            )}

            {/* Always-visible compact reasoning: severity pill + parsed sections */}
            <div className="mt-3 flex flex-wrap items-start gap-2">
              {decision.event_severity != null && (
                <EventSeverityPill severity={decision.event_severity} />
              )}
              {decision.reasoning && (
                <div className="flex-1 min-w-[240px]">
                  <CompactReasoning reasoning={decision.reasoning} expanded={expanded} />
                </div>
              )}
            </div>

            {/* Always-visible "no playbook matched" banner (audit-critical) */}
            {!matchedTemplate && (
              <div className="mt-3 rounded-md border border-yellow-400/30 bg-yellow-400/5 px-2.5 py-1.5">
                <div className="flex items-start gap-1.5 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
                  <span className="text-yellow-100/90">
                    No playbook matched action{" "}
                    <code className="font-mono bg-yellow-400/10 px-1 rounded">{decision.action}</code>
                    {" — "}
                    <a href="/dashboard/settings" className="underline">
                      wire one up in Action Templates
                    </a>
                    .
                  </span>
                </div>
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {matchedTemplate && <TemplatePlaybookBlock template={matchedTemplate} />}

                {decision.guardrail_checks && Object.keys(decision.guardrail_checks).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold flex items-center gap-1 mb-1 text-muted-foreground uppercase tracking-wide">
                      <Shield className="h-3 w-3" /> Why this was classified
                    </h4>
                    <GuardrailChecksPanel checks={decision.guardrail_checks} severity={decision.event_severity ?? null} />
                  </div>
                )}

                <ExecutionsPanel decisionId={decision.id} />

                {decision.result && Object.keys(decision.result).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                      <ChevronRight className="h-3 w-3" /> Raw decision result JSON
                    </summary>
                    <pre className="mt-2 p-3 rounded bg-muted/50 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(decision.result, null, 2)}
                    </pre>
                  </details>
                )}

                {decision.executed_at && (
                  <p className="text-[11px] text-muted-foreground">
                    Executed: {new Date(decision.executed_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {decision.approval_status === "pending_approval" && (
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => onApprove(decision.id)}>
                  <CheckCircle className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onReject(decision.id)}>
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Main Page ──────────────────────────────────────────── */

export default function AgentPage() {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [pending, setPending] = useState<AgentDecision[]>([]);
  const [activeEvents, setActiveEvents] = useState<RiskEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [triggering, setTriggering] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<AgentRunResult | null>(null);
  const [eventSearch, setEventSearch] = useState("");
  const [templates, setTemplates] = useState<ActionTemplate[]>([]);

  useEffect(() => {
    loadData();
    loadTemplates(COMPANY_ID).then(setTemplates).catch(console.error);
    api.riskEvents.active().then((data) => {
      const events = data as RiskEvent[];
      setActiveEvents(events);
      if (events.length > 0) setSelectedEventId(events[0].id);
    }).catch(console.error);
  }, []);

  async function loadData() {
    const company = api.companies(COMPANY_ID);
    const [allDec, pendDec] = await Promise.allSettled([
      company.decisions.list(),
      company.decisions.pending(),
    ]);
    if (allDec.status === "fulfilled") setDecisions(parseList<AgentDecision>(allDec.value));
    if (pendDec.status === "fulfilled") setPending(parseList<AgentDecision>(pendDec.value));
  }

  async function triggerAgent() {
    if (!selectedEventId) return;
    setTriggering(true);
    setLastRunResult(null);
    try {
      const result = await api.post<AgentRunResult>(
        `/api/v1/companies/${COMPANY_ID}/agent/trigger`,
        { risk_event_id: selectedEventId }
      );
      setLastRunResult(result);
      await loadData();
    } catch (err) {
      setLastRunResult({
        risk_event_id: selectedEventId,
        model_used: "unknown",
        decisions: [],
        tool_calls: [],
        thinking: [],
        tool_calls_made: 0,
        iterations: 0,
        completed: false,
        error: String(err),
      });
    }
    setTriggering(false);
  }

  async function handleApproval(decisionId: string, approved: boolean) {
    try {
      await api.companies(COMPANY_ID).decisions.approve(decisionId, approved);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  }

  const selectedEvent = activeEvents.find((e) => e.id === selectedEventId);
  const filteredEvents = eventSearch
    ? activeEvents.filter((e) =>
        e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
        (e.country_code || "").toLowerCase().includes(eventSearch.toLowerCase()) ||
        (e.category || "").toLowerCase().includes(eventSearch.toLowerCase())
      )
    : activeEvents;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <p className="text-muted-foreground">
          Autonomous risk assessment and mitigation engine. Run analysis on any risk event
          to see the agent&apos;s full reasoning, tool usage, and decisions.
        </p>
      </div>

      {/* Trigger Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Select Risk Event</label>
                <span className="text-xs text-muted-foreground">{activeEvents.length} active events</span>
              </div>
              <Input
                placeholder="Search events by title, country, or category..."
                className="h-8 text-xs mb-1.5"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
              />
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                size={1}
              >
                {filteredEvents.length === 0 && <option value="">No matching events</option>}
                {filteredEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{getSeverityLabel(e.severity)}] {e.title.slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={triggerAgent} disabled={triggering || !selectedEventId} className="min-w-[140px]">
              {triggering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Run Analysis
                </>
              )}
            </Button>
          </div>

          {/* Workflow explainer */}
          {!lastRunResult && !triggering && (
            <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>What the agent does:</strong> Analyzes the selected event using Claude AI with access to your asset data.</p>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">1. Assess Assets</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">2. Evaluate Risk</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">3. Propose Actions</Badge>
                    <ArrowRight className="h-3 w-3" />
                    <Badge variant="outline" className="text-[10px]">4. Execute or Escalate</Badge>
                  </div>
                  <p>Actions are governed by your <a href="/dashboard/settings" className="text-primary underline">Settings</a> — low-severity actions auto-execute, high-severity actions require your approval.</p>
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {triggering && (
            <div className="mt-4 p-6 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bot className="h-8 w-8 text-primary" />
                  <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-medium">Agent is analyzing...</p>
                  <p className="text-xs text-muted-foreground">
                    Assessing nearby assets, evaluating risk exposure, and determining actions.
                    This may take 10-30 seconds.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Last Run Result */}
      {lastRunResult && (
        <RunResultPanel
          result={lastRunResult}
          eventTitle={selectedEvent?.title || "Unknown Event"}
        />
      )}

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Pending Approvals ({pending.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            High-severity or disruptive actions held for human review per your guardrail policy.
          </p>
          {pending.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              templates={templates}
              onApprove={(id) => handleApproval(id, true)}
              onReject={(id) => handleApproval(id, false)}
            />
          ))}
        </div>
      )}

      {/* Decision History */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Decision History ({decisions.length})
        </h2>
        {decisions.length === 0 && !lastRunResult ? (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Bot className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Agent Activity Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Select an active risk event and click &quot;Run Analysis&quot; to see the
                  agent assess threats, propose mitigations, and create a full audit trail.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          decisions.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              templates={templates}
              onApprove={(id) => handleApproval(id, true)}
              onReject={(id) => handleApproval(id, false)}
            />
          ))
        )}
      </div>
    </div>
  );
}
