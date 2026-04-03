import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

type MapViewMode = "flat" | "globe";

interface MapStore {
  viewState: ViewState;
  setViewState: (viewState: ViewState) => void;
  viewMode: MapViewMode;
  setViewMode: (mode: MapViewMode) => void;
  showArcs: boolean;
  toggleArcs: () => void;
  showHeatmap: boolean;
  toggleHeatmap: () => void;
  showSupplyChain: boolean;
  toggleSupplyChain: () => void;
  proximityRadiusKm: number;
  setProximityRadiusKm: (km: number) => void;
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
  severityFilter: string[];
  setSeverityFilter: (filters: string[]) => void;
  toggleSeverity: (level: string) => void;
  eventTypeFilter: string[];
  setEventTypeFilter: (filters: string[]) => void;
  toggleEventType: (type: string) => void;
  clearFilters: () => void;
}

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
      viewState: {
        longitude: 0,
        latitude: 20,
        zoom: 2,
        pitch: 0,
        bearing: 0,
      },
      setViewState: (viewState) => set({ viewState }),
      viewMode: "globe" as MapViewMode,
      setViewMode: (mode) => set({ viewMode: mode }),
      showArcs: true,
      toggleArcs: () => set((s) => ({ showArcs: !s.showArcs })),
      showHeatmap: true,
      toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
      showSupplyChain: true,
      toggleSupplyChain: () => set((s) => ({ showSupplyChain: !s.showSupplyChain })),
      proximityRadiusKm: 500,
      setProximityRadiusKm: (km) => set({ proximityRadiusKm: km }),
      selectedEventId: null,
      setSelectedEventId: (id) => set({ selectedEventId: id }),
      severityFilter: [],
      setSeverityFilter: (filters) => set({ severityFilter: filters }),
      toggleSeverity: (level) => {
        const current = get().severityFilter;
        set({
          severityFilter: current.includes(level)
            ? current.filter((s) => s !== level)
            : [...current, level],
        });
      },
      eventTypeFilter: [],
      setEventTypeFilter: (filters) => set({ eventTypeFilter: filters }),
      toggleEventType: (type) => {
        const current = get().eventTypeFilter;
        set({
          eventTypeFilter: current.includes(type)
            ? current.filter((t) => t !== type)
            : [...current, type],
        });
      },
      clearFilters: () => set({ severityFilter: [], eventTypeFilter: [] }),
    }),
    {
      name: "map-preferences",
      partialize: (state) => ({
        severityFilter: state.severityFilter,
        eventTypeFilter: state.eventTypeFilter,
        viewMode: state.viewMode,
        showArcs: state.showArcs,
        showHeatmap: state.showHeatmap,
        showSupplyChain: state.showSupplyChain,
        proximityRadiusKm: state.proximityRadiusKm,
      }),
    }
  )
);
