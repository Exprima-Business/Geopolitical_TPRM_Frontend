"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventDetailPanel } from "@/components/events/event-detail-panel";
import { getSeverityLevel, getSeverityLabel, formatEventTitle, formatEventDescription, getTrendIndicator } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const SEVERITY_RANGES: Record<string, { min: string; max: string }> = {
  critical: { min: "8", max: "10" },
  high: { min: "6", max: "8" },
  medium: { min: "4", max: "6" },
  low: { min: "0", max: "4" },
};

export default function RisksPage() {
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null);

  // Server-side filter state
  const [severityFilter, setSeverityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [severityFilter, categoryFilter, debouncedSearch]);

  // Fetch events with server-side params
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: "20",
      };
      if (severityFilter !== "all") {
        const range = SEVERITY_RANGES[severityFilter];
        if (range) {
          params.min_severity = range.min;
          params.max_severity = range.max;
        }
      }
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (debouncedSearch) params.search = debouncedSearch;

      const data = await api.riskEvents.list(params);
      const result = data as { items?: RiskEvent[]; total?: number; pages?: number; page?: number };

      if (result.items) {
        setEvents(result.items);
        setTotal(result.total || 0);
        setTotalPages(result.pages || 1);
      } else if (Array.isArray(data)) {
        setEvents(data as RiskEvent[]);
        setTotal((data as RiskEvent[]).length);
        setTotalPages(1);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, [page, severityFilter, categoryFilter, debouncedSearch]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk Events</h1>
        <p className="text-muted-foreground">GDELT-sourced geopolitical risk events — click any event for full details</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, region, or actor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="all">All Categories</option>
          <option value="military_conflict">Military Conflict</option>
          <option value="civil_unrest">Civil Unrest</option>
          <option value="economic_sanctions">Economic Sanctions</option>
          <option value="cyber">Cyber</option>
          <option value="weather">Weather</option>
          <option value="natural_disaster">Natural Disaster</option>
          <option value="pandemic_health">Pandemic / Health</option>
          <option value="infrastructure_failure">Infrastructure Failure</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {loading ? "Loading..." : `Showing ${events.length} of ${total} events`}
      </p>

      {/* Event list */}
      <div className="space-y-3">
        {events.map((event) => (
          <Card
            key={event.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setSelectedEvent(event)}
          >
            <CardContent className="p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{formatEventTitle(event)}</h3>
                  {event.severity_trend && event.severity_trend !== "stable" && (
                    <span className={`text-sm font-bold ${getTrendIndicator(event.severity_trend).color}`}>
                      {getTrendIndicator(event.severity_trend).arrow}
                    </span>
                  )}
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

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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
