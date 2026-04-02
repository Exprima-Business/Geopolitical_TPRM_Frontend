"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Map } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { _GlobeView as GlobeView, MapView } from "@deck.gl/core";
import { ScatterplotLayer, ArcLayer } from "@deck.gl/layers";
import { HeatmapLayer } from "@deck.gl/aggregation-layers";
import { useMapStore } from "@/stores/map-store";
import { api } from "@/lib/api";
import { getSeverityLevel, formatEventTitle, getSeverityLabel, getEventCoordinates, haversineKm } from "@/lib/risk-utils";
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

interface ProximityArc {
  source: [number, number];
  target: [number, number];
  severity: number;
  distanceKm: number;
  eventTitle: string;
  assetName: string;
}

// Risk event colors by severity
const SEVERITY_COLORS: Record<string, [number, number, number, number]> = {
  critical: [239, 68, 68, 220],
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

// Asset colors — blue/cyan palette
const ASSET_COLORS: Record<string, [number, number, number, number]> = {
  office: [59, 130, 246, 230],
  data_center: [16, 185, 129, 230],
  cloud_region: [99, 102, 241, 210],
  warehouse: [14, 165, 233, 210],
  factory: [20, 184, 166, 210],
  default: [139, 92, 246, 210],
};

export function RiskMap({ onAssetClick }: { onAssetClick?: (asset: Asset) => void }) {
  const {
    viewState, setViewState,
    viewMode,
    showArcs, showHeatmap, proximityRadiusKm,
    selectedEventId, setSelectedEventId,
    severityFilter, eventTypeFilter,
  } = useMapStore();

  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; text: string; subtext: string; color: string;
  } | null>(null);
  // Fetch data
  useEffect(() => {
    api.riskEvents.active().then((data) => setEvents(data as RiskEvent[])).catch(console.error);
    api.companies(COMPANY_ID).assets.list().then((data) => {
      const result = data as { items?: Asset[] } | Asset[];
      setAssets(Array.isArray(result) ? result : result.items || []);
    }).catch(console.error);
  }, []);

  // Map risk events to coordinates
  const mappedEvents = useMemo(() => {
    return events
      .map((e) => {
        const coords = getEventCoordinates(e);
        if (!coords) return null;
        return { ...e, _coords: coords } as MappedEvent;
      })
      .filter((e): e is MappedEvent => e !== null);
  }, [events]);

  // Map assets with jitter
  const mappedAssets = useMemo(() => {
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
        if (coords) result.push({ ...group[i], _coords: coords });
      }
    }
    return result;
  }, [assets]);

  // Apply severity/type filters
  const filteredEvents = useMemo(() => {
    return mappedEvents.filter((e) => {
      if (severityFilter.length > 0 && !severityFilter.includes(getSeverityLevel(e.severity))) return false;
      if (eventTypeFilter.length > 0 && !eventTypeFilter.includes(e.category)) return false;
      return true;
    });
  }, [mappedEvents, severityFilter, eventTypeFilter]);

  // Compute proximity arcs: event → nearby asset
  const proximityArcs = useMemo(() => {
    if (!showArcs || mappedAssets.length === 0 || filteredEvents.length === 0) return [];

    const arcs: ProximityArc[] = [];
    // Only check critical/high events for arcs to limit visual noise
    const significantEvents = filteredEvents.filter((e) => e.severity >= 6);

    for (const event of significantEvents) {
      for (const asset of mappedAssets) {
        const dist = haversineKm(event._coords, asset._coords);
        if (dist <= proximityRadiusKm && dist > 0) {
          arcs.push({
            source: event._coords,
            target: asset._coords,
            severity: event.severity,
            distanceKm: dist,
            eventTitle: formatEventTitle(event),
            assetName: asset.name,
          });
        }
      }
    }
    return arcs;
  }, [filteredEvents, mappedAssets, showArcs, proximityRadiusKm]);

  // Build all layers
  const layers = useMemo(() => {
    const result: unknown[] = [];

    // Layer 1: Heat map (bottom — subtle density glow)
    if (showHeatmap && filteredEvents.length > 0) {
      result.push(
        new HeatmapLayer({
          id: "heatmap",
          data: filteredEvents,
          getPosition: (d: MappedEvent) => d._coords,
          getWeight: (d: MappedEvent) => d.severity / 10,
          radiusPixels: 60,
          intensity: 1.5,
          threshold: 0.1,
          colorRange: [
            [255, 255, 178, 0],
            [254, 204, 92, 60],
            [253, 141, 60, 120],
            [240, 59, 32, 160],
            [189, 0, 38, 200],
          ],
        })
      );
    }

    // Layer 2: Proximity arcs (animated threat → asset connections)
    if (showArcs && proximityArcs.length > 0) {
      result.push(
        new ArcLayer<ProximityArc>({
          id: "proximity-arcs",
          data: proximityArcs,
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getSourceColor: (d) => {
            const sev = getSeverityLevel(d.severity);
            return sev === "critical" ? [239, 68, 68, 180] : [249, 115, 22, 140];
          },
          getTargetColor: [99, 102, 241, 120], // indigo at target (asset)
          getWidth: (d) => Math.max(1, (d.severity / 10) * 3),
          getHeight: 0.3,
          greatCircle: true,
          pickable: true,
          onHover: ({ object, x, y }) => {
            if (object) {
              setTooltip({
                x, y,
                text: `⚠️ ${object.eventTitle}`,
                subtext: `→ ${object.assetName} (${Math.round(object.distanceKm)}km away)`,
                color: "text-red-400",
              });
            } else {
              setTooltip(null);
            }
          },
        })
      );
    }

    // Layer 3: Risk events (circles with glow effect via double layer)
    result.push(
      // Outer glow for critical events (static, no animation — CSS pulse handles the visual effect)
      new ScatterplotLayer<MappedEvent>({
        id: "risk-events-glow",
        data: filteredEvents.filter((e) => e.severity >= 8),
        getPosition: (d) => d._coords,
        getRadius: (d) => (SEVERITY_RADII[getSeverityLevel(d.severity)] || 30000) * 1.8,
        getFillColor: [239, 68, 68, 50],
        radiusMinPixels: 10,
        radiusMaxPixels: 60,
      }),
      // Main event dots
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
      })
    );

    // Layer 4: Assets (white-stroked colored circles)
    result.push(
      new ScatterplotLayer<MappedAsset>({
        id: "assets",
        data: mappedAssets,
        getPosition: (d) => d._coords,
        getRadius: 15000,
        getFillColor: (d) => ASSET_COLORS[d.asset_type] || ASSET_COLORS.default,
        getLineColor: [255, 255, 255, 220],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        radiusMinPixels: 7,
        radiusMaxPixels: 14,
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
      })
    );

    return result;
  }, [
    filteredEvents, mappedAssets, proximityArcs, showArcs, showHeatmap,
    selectedEventId, severityFilter, eventTypeFilter, onAssetClick,
    setSelectedEventId,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onViewStateChange = useCallback(
    ({ viewState: vs }: any) => setViewState(vs),
    [setViewState]
  );

  // Choose view based on mode
  const views = viewMode === "globe"
    ? new GlobeView({ id: "globe", controller: true })
    : new MapView({ id: "map", controller: true });

  return (
    <div className={`absolute inset-0 ${viewMode === "globe" ? "globe-bg" : ""}`}>
      <DeckGL
        views={views}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers as any}
      >
        {viewMode === "flat" && (
          <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" />
        )}
      </DeckGL>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl max-w-xs"
          style={{ left: tooltip.x + 10, top: tooltip.y + 10 }}
        >
          <p className="font-semibold text-sm">{tooltip.text}</p>
          <p className={`text-xs mt-1 ${tooltip.color}`}>{tooltip.subtext}</p>
        </div>
      )}
    </div>
  );
}

export { type MappedEvent, type MappedAsset };
