"use client";

import { useEffect, useState } from "react";
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
  BarChart3, Target, Info, BookOpen, Users,
} from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

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
  const Icon = TEMPLATE_ICONS[template.action] ?? BookOpen;
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

            {decision.reasoning && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{decision.reasoning}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className={typeInfo.color}>{typeInfo.label}</span>
              {decision.confidence != null && (
                <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
              )}
              <span><Clock className="h-3 w-3 inline mr-1" />{new Date(decision.created_at).toLocaleString()}</span>
            </div>

            {expanded && (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                {matchedTemplate && <TemplatePlaybookBlock template={matchedTemplate} />}

                {decision.reasoning && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                      <FileText className="h-3.5 w-3.5" /> Full Reasoning
                    </h4>
                    <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
                  </div>
                )}

                {decision.guardrail_checks && Object.keys(decision.guardrail_checks).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                      <Shield className="h-3.5 w-3.5" /> Guardrail Analysis
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(decision.guardrail_checks).map(([key, val]) => (
                        <div key={key} className="p-2 rounded border border-border text-xs">
                          <span className="text-muted-foreground">{key.replace(/_/g, " ")}:</span>{" "}
                          <span className="font-medium">{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {decision.result && Object.keys(decision.result).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                      <Zap className="h-3.5 w-3.5" /> Execution Result
                    </h4>
                    <pre className="p-3 rounded bg-muted/50 text-xs font-mono overflow-x-auto">
                      {JSON.stringify(decision.result, null, 2)}
                    </pre>
                  </div>
                )}

                {decision.executed_at && (
                  <p className="text-xs text-muted-foreground">
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
