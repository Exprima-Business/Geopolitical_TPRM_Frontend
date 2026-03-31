"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSeverityLevel, getSeverityLabel, formatEventTitle, formatEventDescription } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";
import { Search, ExternalLink, X, Users, Globe, TrendingDown, Newspaper } from "lucide-react";

const QUAD_CLASS_LABELS: Record<string, string> = {
  "1": "Verbal Cooperation",
  "2": "Material Cooperation",
  "3": "Verbal Conflict",
  "4": "Material Conflict",
};

function EventDetailPanel({ event, onClose }: { event: RiskEvent; onClose: () => void }) {
  const raw = event.raw_data;
  const severityLevel = getSeverityLevel(event.severity);

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-card border-l border-border shadow-2xl z-50 overflow-y-auto">
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Event Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Title + severity */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <h3 className="text-xl font-bold leading-tight flex-1">{formatEventTitle(event)}</h3>
            <Badge variant={severityLevel} className="shrink-0">
              {getSeverityLabel(event.severity)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{event.description}</p>
        </div>

        {/* Source link */}
        {raw?.source_url && (
          <a
            href={raw.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg border border-border bg-accent/50 hover:bg-accent transition-colors"
          >
            <Newspaper className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Read Source Article</p>
              <p className="text-xs text-muted-foreground truncate">{raw.source_url}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        )}

        {/* Actors */}
        {(raw?.actor1_name || raw?.actor2_name) && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Actors Involved
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {raw?.actor1_name && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Actor 1</p>
                  <p className="font-medium">{raw.actor1_name}</p>
                  {raw.actor1_country && <p className="text-xs text-muted-foreground">{raw.actor1_country}</p>}
                </div>
              )}
              {raw?.actor2_name && (
                <div className="p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">Actor 2</p>
                  <p className="font-medium">{raw.actor2_name}</p>
                  {raw.actor2_country && <p className="text-xs text-muted-foreground">{raw.actor2_country}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4" /> Location
          </h4>
          <div className="p-3 rounded-lg border border-border">
            {event.region && <p className="font-medium">{event.region}</p>}
            {event.country_code && <p className="text-sm text-muted-foreground">Country: {event.country_code}</p>}
            {event.latitude != null && event.longitude != null && (
              <p className="text-xs text-muted-foreground">{event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}</p>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingDown className="h-4 w-4" /> Event Metrics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Severity</p>
              <p className="text-lg font-bold">{event.severity.toFixed(1)}<span className="text-sm font-normal text-muted-foreground">/10</span></p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <p className="text-lg font-bold">{Math.round(event.confidence * 100)}<span className="text-sm font-normal text-muted-foreground">%</span></p>
            </div>
            {raw?.goldstein_scale != null && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Goldstein Scale</p>
                <p className={`text-lg font-bold ${raw.goldstein_scale < 0 ? "text-red-400" : "text-green-400"}`}>
                  {raw.goldstein_scale > 0 ? "+" : ""}{raw.goldstein_scale.toFixed(1)}
                </p>
              </div>
            )}
            {raw?.num_mentions != null && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Media Mentions</p>
                <p className="text-lg font-bold">{raw.num_mentions}</p>
              </div>
            )}
            {raw?.avg_tone != null && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Media Tone</p>
                <p className={`text-lg font-bold ${raw.avg_tone < 0 ? "text-red-400" : "text-green-400"}`}>
                  {raw.avg_tone.toFixed(1)}
                </p>
              </div>
            )}
            {raw?.quad_class && (
              <div className="p-3 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Event Class</p>
                <p className="font-medium text-sm">{QUAD_CLASS_LABELS[raw.quad_class] || raw.quad_class}</p>
              </div>
            )}
          </div>
        </div>

        {/* Timestamps */}
        <div className="space-y-1 text-sm text-muted-foreground border-t border-border pt-4">
          {event.started_at && <p>Started: {new Date(event.started_at).toLocaleString()}</p>}
          <p>Recorded: {new Date(event.created_at).toLocaleString()}</p>
          {raw?.event_code && <p>CAMEO Code: {raw.event_code}</p>}
        </div>
      </div>
    </div>
  );
}

export default function RisksPage() {
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);

  useEffect(() => {
    api.riskEvents.list().then((data) => {
      const result = data as { items?: RiskEvent[] } | RiskEvent[];
      const items = Array.isArray(result) ? result : result.items || [];
      setEvents(items);
    }).catch(console.error);
  }, []);

  const filtered = events.filter((e) => {
    const title = formatEventTitle(e).toLowerCase();
    const matchesSearch = !search || title.includes(search.toLowerCase()) || e.region?.toLowerCase().includes(search.toLowerCase()) || e.category?.toLowerCase().includes(search.toLowerCase()) || e.raw_data?.actor1_name?.toLowerCase().includes(search.toLowerCase()) || e.raw_data?.actor2_name?.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = severityFilter === "all" || getSeverityLevel(e.severity) === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk Events</h1>
        <p className="text-muted-foreground">GDELT-sourced geopolitical risk events — click any event for full details</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, region, actor, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} events</p>

      <div className="space-y-3">
        {filtered.map((event) => (
          <Card
            key={event.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedEvent(event)}
          >
            <CardContent className="p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{formatEventTitle(event)}</h3>
                  <Badge variant={getSeverityLevel(event.severity)}>
                    {getSeverityLabel(event.severity)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatEventDescription(event)}
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {event.raw_data?.actor1_name && (
                    <span className="text-foreground/70">{event.raw_data.actor1_name}</span>
                  )}
                  {event.raw_data?.actor2_name && (
                    <span className="text-foreground/70">vs {event.raw_data.actor2_name}</span>
                  )}
                  {event.category && event.category !== "unknown" && <span>{event.category}</span>}
                  <span>{new Date(event.created_at).toLocaleDateString()}</span>
                  {event.raw_data?.source_url && (
                    <span className="text-primary">Has source article</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail panel */}
      {selectedEvent && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedEvent(null)} />
          <EventDetailPanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </>
      )}
    </div>
  );
}
