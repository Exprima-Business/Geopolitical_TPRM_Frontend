import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

interface AuthStore {
  user: User | null;
  companyId: string | null;
  setUser: (user: User | null) => void;
  setCompanyId: (id: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  companyId: null,
  setUser: (user) => set({ user }),
  setCompanyId: (id) => set({ companyId: id }),
}));
