"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_COMPANY_ID } from "@/lib/company";

interface CompanyContextValue {
  companyId: string;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

/**
 * Resolve the active company id for the current session.
 *
 * TODO: when multi-tenancy lands, call `/api/v1/me` here to look up the
 * company associated with the authenticated Supabase user and cache the
 * result. For now we just return the demo constant so every screen shares
 * one source of truth.
 */
async function loadCompany(): Promise<string> {
  // TODO: replace with `await api.get<{ company_id: string }>("/api/v1/me")`
  // once the backend endpoint exists.
  return DEMO_COMPANY_ID;
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  // Start with the demo id synchronously so consumers never see an empty
  // string on first render. `loadCompany` is here so the async wiring is
  // already in place when the real lookup replaces it.
  const [companyId, setCompanyId] = useState<string>(DEMO_COMPANY_ID);

  useEffect(() => {
    let cancelled = false;
    loadCompany()
      .then((id) => {
        if (!cancelled) setCompanyId(id);
      })
      .catch((err) => {
        console.error("Failed to load company id", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <CompanyContext.Provider value={{ companyId }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return ctx;
}
