import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface MapStore {
  viewState: ViewState;
  setViewState: (viewState: ViewState) => void;
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
      }),
    }
  )
);
