"use client";

import { useEffect, useState } from "react";
import { RiskMap } from "@/components/maps/risk-map";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { getSeverityLevel, getSeverityLabel, formatEventTitle } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";
import { AlertTriangle, MapPin, Shield, Bot } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

interface Stats {
  riskEvents: number;
  assets: number;
  pendingDecisions: number;
  mitigations: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ riskEvents: 0, assets: 0, pendingDecisions: 0, mitigations: 0 });
  const [recentEvents, setRecentEvents] = useState<RiskEvent[]>([]);

  useEffect(() => {
    const company = api.companies(COMPANY_ID);

    Promise.allSettled([
      api.riskEvents.active(),
      company.assets.list(),
      company.decisions.pending(),
      company.mitigations.list(),
    ]).then(([eventsRes, assetsRes, decisionsRes, mitigationsRes]) => {
      const events = eventsRes.status === "fulfilled" ? (eventsRes.value as RiskEvent[]) : [];
      const assets = assetsRes.status === "fulfilled" ? (assetsRes.value as unknown[]) : [];
      const decisions = decisionsRes.status === "fulfilled" ? (decisionsRes.value as unknown[]) : [];
      const mitigations = mitigationsRes.status === "fulfilled" ? (mitigationsRes.value as unknown[]) : [];

      setStats({
        riskEvents: events.length,
        assets: assets.length,
        pendingDecisions: decisions.length,
        mitigations: mitigations.length,
      });

      setRecentEvents(events.slice(0, 5));
    });
  }, []);

  const statCards = [
    { label: "Active Risk Events", value: stats.riskEvents, icon: AlertTriangle, color: "text-red-400" },
    { label: "Monitored Assets", value: stats.assets, icon: MapPin, color: "text-blue-400" },
    { label: "Pending Approvals", value: stats.pendingDecisions, icon: Bot, color: "text-yellow-400" },
    { label: "Mitigations", value: stats.mitigations, icon: Shield, color: "text-green-400" },
  ];

  return (
    <div className="flex flex-col h-screen">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 p-6 pb-0">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
              <s.icon className={`h-8 w-8 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-1 gap-4 p-6 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-border relative">
          <RiskMap />
        </div>

        <div className="w-80 shrink-0 overflow-y-auto space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Recent Risk Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-tight line-clamp-2">{formatEventTitle(event)}</p>
                    <Badge variant={getSeverityLevel(event.severity)}>
                      {getSeverityLabel(event.severity)}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
