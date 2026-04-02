"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { ScatterplotLayer } from "@deck.gl/layers";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api";
import { getSeverityLevel, formatEventTitle, getSeverityLabel, getEventCoordinates } from "@/lib/risk-utils";
import { getAssetCoordinates, getAssetIcon, getAssetTypeLabel, getAssetLocation } from "@/lib/asset-utils";
import type { RiskEvent, Asset } from "@/types";
import "maplibre-gl/dist/maplibre-gl.css";

const COMPANY_ID = "cb9875d1-1a9f-491f-838f-de64fc489251";

interface MappedEvent extends RiskEvent {
  _coords: [number, number];
}

interface MappedAsset extends Asset {
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

// Asset type colors — blue/cyan/teal palette, distinct from risk red/orange/yellow
const ASSET_COLORS: Record<string, [number, number, number, number]> = {
  office: [59, 130, 246, 220],         // blue
  data_center: [16, 185, 129, 220],    // emerald
  cloud_region: [99, 102, 241, 200],   // indigo
  warehouse: [14, 165, 233, 200],      // sky
  factory: [20, 184, 166, 200],        // teal
  default: [139, 92, 246, 200],        // violet
};

export function RiskMap({ onAssetClick }: { onAssetClick?: (asset: Asset) => void }) {
  const { viewState, setViewState, selectedEventId, setSelectedEventId, severityFilter, eventTypeFilter } = useMapStore();
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; subtext: string; color: string } | null>(null);

  useEffect(() => {
    api.riskEvents.active().then((data) => {
      setEvents(data as RiskEvent[]);
    }).catch(console.error);

    api.companies(COMPANY_ID).assets.list().then((data) => {
      const result = data as { items?: Asset[] } | Asset[];
      setAssets(Array.isArray(result) ? result : result.items || []);
    }).catch(console.error);
  }, []);

  // Map risk events
  const mappedEvents = useMemo(() => {
    return events
      .map((e) => {
        const coords = getEventCoordinates(e);
        if (!coords) return null;
        return { ...e, _coords: coords } as MappedEvent;
      })
      .filter((e): e is MappedEvent => e !== null);
  }, [events]);

  // Map assets with jitter for same-region clustering
  const mappedAssets = useMemo(() => {
    // Group by location key to compute per-group indices
    const groups: Record<string, Asset[]> = {};
    for (const a of assets) {
      const key = a.cloud_region_code || a.address || a.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }

    const result: MappedAsset[] = [];
    for (const group of Object.values(groups)) {
      for (let i = 0; i < group.length; i++) {
        const coords = getAssetCoordinates(group[i], i, group.length);
        if (coords) {
          result.push({ ...group[i], _coords: coords });
        }
      }
    }
    return result;
  }, [assets]);

  // Apply store filters to events
  const filteredEvents = useMemo(() => {
    return mappedEvents.filter((e) => {
      if (severityFilter.length > 0 && !severityFilter.includes(getSeverityLevel(e.severity))) return false;
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(e.category)) return false;
      return true;
    });
  }, [mappedEvents, severityFilter, eventTypeFilter]);

  const layers = [
    // Risk events layer (circles)
    new ScatterplotLayer<MappedEvent>({
      id: "risk-events",
      data: filteredEvents,
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
        if (object) {
          setTooltip({
            x, y,
            text: formatEventTitle(object),
            subtext: `${getSeverityLabel(object.severity)} · ${object.severity.toFixed(1)}/10`,
            color: getSeverityLevel(object.severity) === "critical" ? "text-red-400"
              : getSeverityLevel(object.severity) === "high" ? "text-orange-400"
              : getSeverityLevel(object.severity) === "medium" ? "text-yellow-400"
              : "text-green-400",
          });
        } else {
          setTooltip(null);
        }
      },
      updateTriggers: {
        getFillColor: [severityFilter, eventTypeFilter],
        getLineColor: [selectedEventId],
      },
    }),
    // Assets layer (smaller, diamond-shaped via stroked circles)
    new ScatterplotLayer<MappedAsset>({
      id: "assets",
      data: mappedAssets,
      getPosition: (d) => d._coords,
      getRadius: 15000,
      getFillColor: (d) => ASSET_COLORS[d.asset_type] || ASSET_COLORS.default,
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      radiusMinPixels: 6,
      radiusMaxPixels: 12,
      onClick: ({ object }) => {
        if (object && onAssetClick) onAssetClick(object);
      },
      onHover: ({ object, x, y }) => {
        if (object) {
          setTooltip({
            x, y,
            text: `${getAssetIcon(object)} ${object.name}`,
            subtext: `${getAssetTypeLabel(object)} · ${getAssetLocation(object)}`,
            color: "text-blue-400",
          });
        } else {
          setTooltip(null);
        }
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
          <p className="font-semibold text-sm">{tooltip.text}</p>
          <p className={`text-xs mt-1 ${tooltip.color}`}>{tooltip.subtext}</p>
        </div>
      )}
    </div>
  );
}

export { type MappedEvent };
