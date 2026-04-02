"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { RiskMap } from "@/components/maps/risk-map";
import { EventDetailPanel } from "@/components/events/event-detail-panel";
import { AssetDetailPanel } from "@/components/events/asset-detail-panel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useMapStore } from "@/stores/map-store";
import { getSeverityLevel, getSeverityLabel, formatEventTitle } from "@/lib/risk-utils";
import type { RiskEvent, Asset } from "@/types";
import { AlertTriangle, MapPin, Shield, Bot, X } from "lucide-react";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

const SEVERITY_LEVELS = ["critical", "high", "medium", "low"] as const;
const EVENT_CATEGORIES = [
  "military_conflict",
  "civil_unrest",
  "economic_sanctions",
  "cyber",
  "weather",
  "pandemic_health",
  "infrastructure_failure",
] as const;

function formatCategory(cat: string) {
  return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Stats {
  riskEvents: number;
  assets: number;
  pendingDecisions: number;
  mitigations: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ riskEvents: 0, assets: 0, pendingDecisions: 0, mitigations: 0 });
  const [allEvents, setAllEvents] = useState<RiskEvent[]>([]);

  const {
    selectedEventId, setSelectedEventId,
    severityFilter, toggleSeverity,
    eventTypeFilter, toggleEventType,
    clearFilters,
  } = useMapStore();

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

      setAllEvents(events);
      setStats({
        riskEvents: events.length,
        assets: assets.length,
        pendingDecisions: decisions.length,
        mitigations: mitigations.length,
      });
    });
  }, []);

  // Apply filters for sidebar
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (severityFilter.length > 0 && !severityFilter.includes(getSeverityLevel(e.severity))) return false;
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(e.category)) return false;
      return true;
    });
  }, [allEvents, severityFilter, eventTypeFilter]);

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const recentEvents = filteredEvents.slice(0, 8);
  const selectedEvent = selectedEventId ? allEvents.find((e) => e.id === selectedEventId) || null : null;
  const hasFilters = severityFilter.length > 0 || eventTypeFilter.length > 0;

  const handleAssetClick = useCallback((asset: Asset) => {
    setSelectedEventId(null); // clear event selection
    setSelectedAsset(asset);
  }, [setSelectedEventId]);

  const statCards = [
    { label: "Active Risk Events", value: hasFilters ? filteredEvents.length : stats.riskEvents, icon: AlertTriangle, color: "text-red-400" },
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

      {/* Filter bar */}
      <div className="px-6 pt-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground mr-1">Severity:</span>
        {SEVERITY_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => toggleSeverity(level)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              severityFilter.includes(level)
                ? level === "critical" ? "bg-red-600 text-white border-red-600"
                : level === "high" ? "bg-orange-500 text-white border-orange-500"
                : level === "medium" ? "bg-yellow-500 text-black border-yellow-500"
                : "bg-green-500 text-white border-green-500"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}

        <span className="text-xs text-muted-foreground ml-3 mr-1">Type:</span>
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleEventType(cat)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              eventTypeFilter.includes(cat)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
          >
            {formatCategory(cat)}
          </button>
        ))}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-2 h-7 text-xs">
            <X className="h-3 w-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Map + sidebar */}
      <div className="flex flex-1 gap-4 p-6 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 rounded-xl overflow-hidden border border-border relative">
          <RiskMap onAssetClick={handleAssetClick} />
        </div>

        <div className="w-80 shrink-0 overflow-y-auto space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Recent Risk Events
                {hasFilters && <span className="text-muted-foreground font-normal"> ({filteredEvents.length} filtered)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {allEvents.length === 0 ? "Loading..." : "No events match filters"}
                </p>
              ) : (
                recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-2 cursor-pointer hover:bg-accent/50 rounded-md p-1.5 -mx-1.5 transition-colors"
                    onClick={() => setSelectedEventId(event.id)}
                  >
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

      {/* Detail panels from map click or sidebar click */}
      {selectedEvent && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedEventId(null)} />
          <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEventId(null)} />
        </>
      )}
      {selectedAsset && !selectedEvent && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedAsset(null)} />
          <AssetDetailPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
        </>
      )}
    </div>
  );
}
