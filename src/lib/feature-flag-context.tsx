"use client";

/**
 * Feature flag context + hooks.
 *
 * Wrap the dashboard layout in <FeatureFlagProvider> once; any client
 * component below can then call `useFlag("some_key")` to gate UI on a
 * boolean, or `useFlags()` to render the full resolved list (for the
 * Settings > Feature Flags tab).
 *
 * Loading semantics: fail-safe-closed. While the initial fetch is in
 * flight — and on any subsequent fetch error — `useFlag` returns `false`.
 * This means a gated feature stays hidden until we confirm it's on, which
 * is the conservative choice for things like `decision_dismissal_enabled`
 * (where a transient network blip shouldn't accidentally expose an action).
 *
 * After a toggle in the Settings panel, call `refreshFlags()` from the
 * context to re-fetch and propagate the new state to every consumer.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCompany } from "./company-context";
import { listFlags, type FeatureFlagState } from "./feature-flags";

interface FeatureFlagContextValue {
  flags: FeatureFlagState[];
  flagMap: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { companyId } = useCompany();
  const [flags, setFlags] = useState<FeatureFlagState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest company id so an in-flight fetch for a previous company
  // doesn't clobber state after the user switches workspaces.
  const activeCompanyRef = useRef(companyId);

  const fetchFlags = useCallback(async () => {
    const cid = activeCompanyRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await listFlags(cid);
      if (activeCompanyRef.current !== cid) return;
      setFlags(next);
    } catch (err) {
      if (activeCompanyRef.current !== cid) return;
      console.error("Failed to load feature flags", err);
      setError((err as Error).message);
      // Fail-safe-closed: clear flags so `useFlag` returns false.
      setFlags([]);
    } finally {
      if (activeCompanyRef.current === cid) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    activeCompanyRef.current = companyId;
    void fetchFlags();
  }, [companyId, fetchFlags]);

  // Flat { key -> value } lookup for O(1) reads in `useFlag`.
  const flagMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const f of flags) m[f.key] = f.value;
    return m;
  }, [flags]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      flags,
      flagMap,
      loading,
      error,
      refreshFlags: fetchFlags,
    }),
    [flags, flagMap, loading, error, fetchFlags]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

function useFeatureFlagContext(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error(
      "Feature flag hooks must be used inside a <FeatureFlagProvider>"
    );
  }
  return ctx;
}

/**
 * Returns the current value of a feature flag.
 *
 * Fail-safe-closed: returns `false` while loading, on fetch error, or when
 * the key is unknown. Callers should therefore wrap the *new* behavior,
 * not the fallback: `if (useFlag("x_enabled")) { show new thing }`.
 */
export function useFlag(key: string): boolean {
  const { flagMap, loading } = useFeatureFlagContext();
  if (loading) return false;
  return flagMap[key] === true;
}

/** Returns the full resolved list of flags — for the Settings UI. */
export function useFlags(): FeatureFlagState[] {
  return useFeatureFlagContext().flags;
}

/**
 * Returns the full context (flags, loading, error, refreshFlags). Useful
 * for the Settings panel which needs to trigger a refresh after a toggle.
 */
export function useFeatureFlags(): FeatureFlagContextValue {
  return useFeatureFlagContext();
}
