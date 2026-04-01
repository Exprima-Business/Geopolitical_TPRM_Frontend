"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSeverityLevel, getSeverityLabel, formatEventTitle } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";
import { X, ExternalLink, Users, Globe, TrendingDown, Newspaper } from "lucide-react";

const QUAD_CLASS_LABELS: Record<string, string> = {
  "1": "Verbal Cooperation",
  "2": "Material Cooperation",
  "3": "Verbal Conflict",
  "4": "Material Conflict",
};

export function EventDetailPanel({ event, onClose }: { event: RiskEvent; onClose: () => void }) {
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
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <h3 className="text-xl font-bold leading-tight flex-1">{formatEventTitle(event)}</h3>
            <Badge variant={severityLevel} className="shrink-0">
              {getSeverityLabel(event.severity)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{event.description}</p>
        </div>

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

        <div className="space-y-1 text-sm text-muted-foreground border-t border-border pt-4">
          {event.started_at && <p>Started: {new Date(event.started_at).toLocaleString()}</p>}
          <p>Recorded: {new Date(event.created_at).toLocaleString()}</p>
          {raw?.event_code && <p>CAMEO Code: {raw.event_code}</p>}
        </div>
      </div>
    </div>
  );
}
