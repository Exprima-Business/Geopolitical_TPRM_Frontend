"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Decision } from "@/types";
import { Bot, CheckCircle, XCircle, Loader2 } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

function parseList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && "items" in data) return (data as { items: T[] }).items || [];
  return [];
}

export default function AgentPage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pending, setPending] = useState<Decision[]>([]);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const company = api.companies(COMPANY_ID);
    const [allDec, pendDec] = await Promise.allSettled([
      company.decisions.list(),
      company.decisions.pending(),
    ]);
    if (allDec.status === "fulfilled") setDecisions(parseList<Decision>(allDec.value));
    if (pendDec.status === "fulfilled") setPending(parseList<Decision>(pendDec.value));
  }

  async function triggerAgent() {
    setTriggering(true);
    try {
      await api.companies(COMPANY_ID).agent.trigger();
      await loadData();
    } catch (err) {
      console.error(err);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <p className="text-muted-foreground">Autonomous risk assessment and mitigation proposals</p>
        </div>
        <Button onClick={triggerAgent} disabled={triggering}>
          {triggering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          {triggering ? "Running..." : "Trigger Agent"}
        </Button>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-yellow-400">Pending Approvals ({pending.length})</h2>
          {pending.map((d) => (
            <Card key={d.id} className="border-yellow-500/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-medium">{d.summary}</h3>
                    <p className="text-sm text-muted-foreground">{d.decision_type}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproval(d.id, true)}>
                      <CheckCircle className="h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApproval(d.id, false)}>
                      <XCircle className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* All decisions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Decision History ({decisions.length})</h2>
        {decisions.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center space-y-4">
              <Bot className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No Agent Decisions Yet</h3>
                <p className="text-muted-foreground">
                  Click &quot;Trigger Agent&quot; to start an autonomous risk assessment.
                  The agent will analyze active threats near your assets and propose mitigations.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          decisions.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-medium">{d.summary}</h3>
                  <p className="text-xs text-muted-foreground">
                    {d.decision_type} &middot; {new Date(d.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge
                  variant={d.status === "approved" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}
                >
                  {d.status}
                </Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
