"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api";
import { getSeverityLevel, formatEventTitle, getSeverityLabel, getEventCoordinates } from "@/lib/risk-utils";
import type { RiskEvent } from "@/types";
import "maplibre-gl/dist/maplibre-gl.css";

interface MappedEvent extends RiskEvent {
  _coords: [number, number];
}

const SEVERITY_COLORS: Record<string, [number, number, number, number]> = {
  critical: [239, 68, 68, 200],
  high: [249, 115, 22, 200],
  medium: [234, 179, 8, 180],
  low: [34, 197, 94, 160],
};

const SEVERITY_RADII: Record<string, number> = {
  critical: 80000,
  high: 60000,
  medium: 40000,
  low: 25000,
};

export function RiskMap() {
  const { viewState, setViewState, selectedEventId, setSelectedEventId } = useMapStore();
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; event: MappedEvent } | null>(null);

  useEffect(() => {
    api.riskEvents.active().then((data) => {
      setEvents(data as RiskEvent[]);
    }).catch(console.error);
  }, []);

  // Resolve coordinates for all events, filtering out those with no location
  const mappedEvents = useMemo(() => {
    return events
      .map((e) => {
        const coords = getEventCoordinates(e);
        if (!coords) return null;
        return { ...e, _coords: coords } as MappedEvent;
      })
      .filter((e): e is MappedEvent => e !== null);
  }, [events]);

  const layers = [
    new ScatterplotLayer<MappedEvent>({
      id: "risk-events",
      data: mappedEvents,
      getPosition: (d) => d._coords,
      getRadius: (d) => SEVERITY_RADII[getSeverityLevel(d.severity)] || 30000,
      getFillColor: (d) => SEVERITY_COLORS[getSeverityLevel(d.severity)] || [128, 128, 128, 160],
      getLineColor: (d) =>
        d.id === selectedEventId ? [255, 255, 255, 255] : [0, 0, 0, 0],
      lineWidthMinPixels: 2,
      pickable: true,
      radiusMinPixels: 5,
      radiusMaxPixels: 40,
      onClick: ({ object }) => {
        if (object) setSelectedEventId(object.id);
      },
      onHover: ({ object, x, y }) => {
        setTooltip(object ? { x, y, event: object } : null);
      },
    }),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onViewStateChange = useCallback(
    ({ viewState: vs }: any) => setViewState(vs),
    [setViewState]
  );

  return (
    <div className="absolute inset-0">
      <DeckGL
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers as any}
      >
        <Map
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        />
      </DeckGL>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-card border border-border rounded-lg p-3 shadow-lg max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <p className="font-semibold text-sm">{formatEventTitle(tooltip.event)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            <span
              className={
                getSeverityLevel(tooltip.event.severity) === "critical"
                  ? "text-red-400"
                  : getSeverityLevel(tooltip.event.severity) === "high"
                  ? "text-orange-400"
                  : getSeverityLevel(tooltip.event.severity) === "medium"
                  ? "text-yellow-400"
                  : "text-green-400"
              }
            >
              {getSeverityLabel(tooltip.event.severity)}
            </span>
            {" · "}{tooltip.event.severity.toFixed(1)}/10
          </p>
          {tooltip.event.region && (
            <p className="text-xs text-muted-foreground">{tooltip.event.region}</p>
          )}
        </div>
      )}
    </div>
  );
}
