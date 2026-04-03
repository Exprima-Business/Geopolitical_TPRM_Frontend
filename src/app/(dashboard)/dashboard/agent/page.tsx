"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSeverityLevel, getSeverityLabel, getTrendIndicator } from "@/lib/risk-utils";
import type { RiskEvent, Decision } from "@/types";
import {
  Bot, CheckCircle, XCircle, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, Shield, Zap, Eye, Send,
  Clock, FileText,
} from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

function parseList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) return (data as { items: T[] }).items || [];
  return [];
}

// Decision type icons and colors
const DECISION_ICONS: Record<string, { icon: typeof Bot; color: string; label: string }> = {
  assess: { icon: Eye, color: "text-blue-400", label: "Assessment" },
  mitigate: { icon: Shield, color: "text-green-400", label: "Mitigation" },
  alert: { icon: Send, color: "text-yellow-400", label: "Alert" },
  escalate: { icon: AlertTriangle, color: "text-red-400", label: "Escalation" },
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

function DecisionCard({
  decision,
  onApprove,
  onReject,
}: {
  decision: AgentDecision;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = DECISION_ICONS[decision.decision_type] || DECISION_ICONS.assess;
  const Icon = typeInfo.icon;
  const approvalInfo = APPROVAL_BADGES[decision.approval_status] || APPROVAL_BADGES.pending_approval;

  return (
    <Card className={decision.approval_status === "pending_approval" ? "border-yellow-500/30" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`mt-1 ${typeInfo.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium">{ACTION_LABELS[decision.action] || decision.action}</h3>
                <Badge variant={approvalInfo.variant} className="text-xs">
                  {approvalInfo.label}
                </Badge>
              </div>
              <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            {/* Summary */}
            {decision.reasoning && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{decision.reasoning}</p>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className={typeInfo.color}>{typeInfo.label}</span>
              {decision.confidence != null && (
                <span>Confidence: {Math.round(decision.confidence * 100)}%</span>
              )}
              <span><Clock className="h-3 w-3 inline mr-1" />{new Date(decision.created_at).toLocaleString()}</span>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                {/* Full reasoning */}
                {decision.reasoning && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                      <FileText className="h-3.5 w-3.5" /> Reasoning
                    </h4>
                    <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
                  </div>
                )}

                {/* Guardrail checks */}
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

                {/* Execution result */}
                {decision.result && Object.keys(decision.result).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold flex items-center gap-1 mb-1">
                      <Zap className="h-3.5 w-3.5" /> Result
                    </h4>
                    <div className="p-3 rounded bg-muted/50 text-xs font-mono">
                      {Object.entries(decision.result).map(([key, val]) => (
                        <div key={key}><span className="text-muted-foreground">{key}:</span> {String(val)}</div>
                      ))}
                    </div>
                  </div>
                )}

                {decision.executed_at && (
                  <p className="text-xs text-muted-foreground">
                    Executed: {new Date(decision.executed_at).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Approval buttons for pending decisions */}
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

export default function AgentPage() {
  const [decisions, setDecisions] = useState<AgentDecision[]>([]);
  const [pending, setPending] = useState<AgentDecision[]>([]);
  const [activeEvents, setActiveEvents] = useState<RiskEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Load active events for the trigger dropdown
    api.riskEvents.active().then((data) => {
      const events = (data as RiskEvent[]).slice(0, 20); // Top 20 by severity
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
    setTriggerResult(null);
    try {
      const result = await api.post<Record<string, unknown>>(
        `/api/v1/companies/${COMPANY_ID}/agent/trigger`,
        { risk_event_id: selectedEventId }
      );
      const res = result as { decisions?: unknown[]; tool_calls_made?: number; error?: string };
      if (res.error) {
        setTriggerResult(`Error: ${res.error}`);
      } else {
        setTriggerResult(
          `Agent completed: ${res.decisions?.length || 0} decisions, ${res.tool_calls_made || 0} tool calls`
        );
      }
      await loadData();
    } catch (err) {
      setTriggerResult(`Failed: ${err}`);
    }
    setTriggering(false);
  }

  async function handleApproval(decisionId: string, approved: boolean) {
    try {
      await api.companies(COMPANY_ID).decisions.approve(
        decisionId,
        approved
      );
      await loadData();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">AI Agent</h1>
        <p className="text-muted-foreground">
          Autonomous risk assessment and mitigation engine. The agent analyzes threats,
          assesses asset impact, proposes mitigations, and executes approved actions.
        </p>
      </div>

      {/* Trigger Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Trigger Agent Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Select Risk Event to Analyze</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {activeEvents.length === 0 && <option value="">No active events</option>}
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    [{getSeverityLabel(e.severity)}] {e.title.slice(0, 80)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={triggerAgent} disabled={triggering || !selectedEventId}>
                {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                {triggering ? "Analyzing..." : "Run Agent"}
              </Button>
            </div>
          </div>
          {triggerResult && (
            <div className={`p-3 rounded text-sm ${triggerResult.startsWith("Error") || triggerResult.startsWith("Failed") ? "bg-red-400/10 text-red-400 border border-red-400/20" : "bg-green-400/10 text-green-400 border border-green-400/20"}`}>
              {triggerResult}
            </div>
          )}
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>How it works:</strong> The agent uses Claude to analyze the selected risk event:</p>
            <p>1. Assesses which assets are impacted based on proximity and criticality</p>
            <p>2. Proposes mitigations (monitoring, backup activation, failover, etc.)</p>
            <p>3. Low-severity actions auto-execute; high-severity actions require your approval</p>
            <p>4. Sends alerts and escalates when uncertainty is high</p>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Pending Approvals ({pending.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            These actions require your review. High-severity or disruptive actions are held for human approval per guardrail policy.
          </p>
          {pending.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
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
        {decisions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Bot className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Agent Activity Yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Select an active risk event above and click &quot;Run Agent&quot; to start
                  an autonomous analysis. The agent will assess threats, propose mitigations,
                  and create an audit trail of all decisions.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          decisions.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              onApprove={(id) => handleApproval(id, true)}
              onReject={(id) => handleApproval(id, false)}
            />
          ))
        )}
      </div>
    </div>
  );
}
