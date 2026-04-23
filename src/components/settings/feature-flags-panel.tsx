"use client";

/**
 * Feature Flags panel for the Settings page.
 *
 * Renders the list of resolved flags for the current company, lets the user
 * flip each one, and shows a "Reset" link to remove the company-level
 * override (reverting to the global default).
 *
 * Drop this into a new tab in `src/app/(dashboard)/dashboard/settings/page.tsx`
 * — it self-manages its data via `useFeatureFlags()` and the Settings-tab
 * page doesn't need to pass any props.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Flag, RotateCcw } from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { useFeatureFlags } from "@/lib/feature-flag-context";
import {
  setFlag,
  unsetFlag,
  type FeatureFlagState,
} from "@/lib/feature-flags";

function FlagToggle({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function FlagRow({
  flag,
  busy,
  onToggle,
  onReset,
}: {
  flag: FeatureFlagState;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onReset: () => void;
}) {
  const isOverridden = flag.source === "company_override";

  return (
    <li className="flex items-start gap-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="text-sm font-mono font-medium">{flag.key}</code>
          {isOverridden ? (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              overridden
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              default
            </Badge>
          )}
        </div>
        {flag.description && (
          <p className="text-xs text-muted-foreground">{flag.description}</p>
        )}
        {isOverridden && (
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" /> Reset to default
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {busy && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
        <FlagToggle
          checked={flag.value}
          onChange={onToggle}
          disabled={busy}
          ariaLabel={`Toggle ${flag.key}`}
        />
      </div>
    </li>
  );
}

export function FeatureFlagsPanel() {
  const { companyId } = useCompany();
  const { flags, loading, error, refreshFlags } = useFeatureFlags();
  // Per-key busy state so toggling one flag doesn't block the others.
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleToggle(flag: FeatureFlagState, nextValue: boolean) {
    setBusyKeys((p) => ({ ...p, [flag.key]: true }));
    setRowError(null);
    try {
      await setFlag(companyId, flag.key, nextValue);
      await refreshFlags();
    } catch (err) {
      console.error("Failed to set feature flag:", err);
      setRowError(`Failed to update ${flag.key}: ${(err as Error).message}`);
    } finally {
      setBusyKeys((p) => {
        const n = { ...p };
        delete n[flag.key];
        return n;
      });
    }
  }

  async function handleReset(flag: FeatureFlagState) {
    setBusyKeys((p) => ({ ...p, [flag.key]: true }));
    setRowError(null);
    try {
      await unsetFlag(companyId, flag.key);
      await refreshFlags();
    } catch (err) {
      console.error("Failed to reset feature flag:", err);
      setRowError(`Failed to reset ${flag.key}: ${(err as Error).message}`);
    } finally {
      setBusyKeys((p) => {
        const n = { ...p };
        delete n[flag.key];
        return n;
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-1">
            <Flag className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold">Feature Flags</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Enable or disable product features for your workspace.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-xs">Loading flags…</span>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-3 rounded border border-red-400/30 bg-red-400/5 text-xs text-red-200">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Failed to load feature flags.</p>
                <p className="text-muted-foreground mt-0.5">{error}</p>
              </div>
            </div>
          ) : flags.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No feature flags defined
            </div>
          ) : (
            <>
              {rowError && (
                <div className="mb-3 flex items-start gap-2 p-2 rounded border border-red-400/30 bg-red-400/5 text-[11px] text-red-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span>{rowError}</span>
                </div>
              )}
              <ul>
                {flags.map((flag) => (
                  <FlagRow
                    key={flag.key}
                    flag={flag}
                    busy={Boolean(busyKeys[flag.key])}
                    onToggle={(next) => handleToggle(flag, next)}
                    onReset={() => handleReset(flag)}
                  />
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FeatureFlagsPanel;
