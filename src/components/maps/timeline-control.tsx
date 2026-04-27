"use client";

import { useMemo } from "react";
import { useMapStore, TIME_RANGE_PRESETS } from "@/stores/map-store";
import { getSeverityLevel } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";

const BUCKET_COUNT = 30;

// Tailwind bg classes by max-severity-in-bucket. Empty buckets stay muted.
const SEVERITY_BAR_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

interface Bucket {
  count: number;
  maxSeverity: number;
}

interface TimelineControlProps {
  events: RiskEvent[];
}

export function TimelineControl({ events }: TimelineControlProps) {
  const { timeRangeHours, setTimeRangeHours } = useMapStore();

  const { buckets, maxCount, totalInRange } = useMemo(() => {
    const now = Date.now();
    // For the histogram window:
    //  - If a range is selected, bucket the last N hours.
    //  - If "All", bucket from the earliest started_at event up to now.
    let windowStartMs: number;
    if (timeRangeHours !== null) {
      windowStartMs = now - timeRangeHours * 3600_000;
    } else {
      const earliest = events
        .map((e) => (e.started_at ? new Date(e.started_at).getTime() : NaN))
        .filter((t) => !Number.isNaN(t));
      windowStartMs = earliest.length > 0 ? Math.min(...earliest) : now - 24 * 3600_000;
    }
    const windowMs = Math.max(now - windowStartMs, 1);
    const bucketMs = windowMs / BUCKET_COUNT;

    const bs: Bucket[] = Array.from({ length: BUCKET_COUNT }, () => ({ count: 0, maxSeverity: 0 }));
    let total = 0;
    for (const e of events) {
      if (!e.started_at) continue;
      const t = new Date(e.started_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t < windowStartMs || t > now) continue;
      const idx = Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor((t - windowStartMs) / bucketMs)));
      bs[idx].count += 1;
      if (e.severity > bs[idx].maxSeverity) bs[idx].maxSeverity = e.severity;
      total += 1;
    }
    const mc = bs.reduce((m, b) => (b.count > m ? b.count : m), 0);
    return { buckets: bs, maxCount: mc, totalInRange: total };
  }, [events, timeRangeHours]);

  return (
    <div className="flex flex-col gap-2">
      {/* Preset pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Time range:</span>
        {TIME_RANGE_PRESETS.map((preset) => {
          const active = timeRangeHours === preset.value;
          return (
            <button
              key={preset.label}
              onClick={() => setTimeRangeHours(preset.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <span className="text-xs text-muted-foreground ml-2">
          {totalInRange} event{totalInRange === 1 ? "" : "s"} in range
        </span>
      </div>

      {/* Histogram */}
      {totalInRange === 0 ? (
        <p className="text-xs text-muted-foreground pl-1">
          No events in the selected time range
        </p>
      ) : (
        <div className="flex items-end gap-0.5 h-10 w-full max-w-md">
          {buckets.map((b, i) => {
            const heightPct = maxCount > 0 ? Math.max(4, (b.count / maxCount) * 100) : 4;
            const colorClass =
              b.count === 0
                ? "bg-muted/40"
                : SEVERITY_BAR_COLORS[getSeverityLevel(b.maxSeverity)] || "bg-muted";
            const opacityClass = b.count === 0 ? "opacity-50" : "";
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm ${colorClass} ${opacityClass} transition-all`}
                style={{ height: `${heightPct}%` }}
                title={`${b.count} event${b.count === 1 ? "" : "s"}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
