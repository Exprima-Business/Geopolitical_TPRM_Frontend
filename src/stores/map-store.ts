import { create } from "zustand";

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
  eventTypeFilter: string[];
  setEventTypeFilter: (filters: string[]) => void;
}

export const useMapStore = create<MapStore>((set) => ({
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
  eventTypeFilter: [],
  setEventTypeFilter: (filters) => set({ eventTypeFilter: filters }),
}));
