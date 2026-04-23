"use client";

/**
 * Dismiss-decision confirmation panel.
 *
 * Renders as a fixed-position overlay (no portal) since the codebase doesn't
 * have a Radix / shadcn Dialog primitive. The parent controls open/close
 * state so it can be opened from a button, a context menu, etc.
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Ban,
  Loader2,
  X,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";
import { dismissDecision } from "@/lib/dismissal-rules";

export interface DismissDecisionContext {
  event_title?: string | null;
  event_severity?: number | null;
  event_country_code?: string | null;
  event_region?: string | null;
  event_category?: string | null;
}

export interface DismissDialogProps {
  decisionId: string;
  decisionContext: DismissDecisionContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful dismissal — the parent should refresh. */
  onDismissed: () => void;
}

/**
 * Build the preview of the rule the backend would derive if
 * `create_rule_from_decision` were true. The backend's exact logic is
 * `severity_max = ceil(event.severity) + 1` capped at 10, plus equality
 * filters on country/region/category when present. We mirror that here
 * for display only — the server is the source of truth.
 */
function buildRulePreview(ctx: DismissDecisionContext): {
  parts: string[];
  sevMax: number | null;
} {
  const parts: string[] = [];
  let sevMax: number | null = null;
  if (ctx.event_severity != null) {
    sevMax = Math.min(10, Math.ceil(ctx.event_severity) + 1);
    parts.push(`severity ≤ ${sevMax}`);
  }
  if (ctx.event_country_code) parts.push(`country = ${ctx.event_country_code}`);
  if (ctx.event_region) parts.push(`region = ${ctx.event_region}`);
  if (ctx.event_category) parts.push(`category = ${ctx.event_category}`);
  return { parts, sevMax };
}

export function DismissDialog({
  decisionId,
  decisionContext,
  open,
  onOpenChange,
  onDismissed,
}: DismissDialogProps) {
  const { companyId } = useCompany();
  const [reason, setReason] = useState("");
  const [createRule, setCreateRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(
    () => buildRulePreview(decisionContext),
    [decisionContext],
  );

  if (!open) return null;

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      await dismissDecision(companyId, decisionId, reason.trim(), createRule);
      onDismissed();
      onOpenChange(false);
      // Reset local state so re-opening starts clean.
      setReason("");
      setCreateRule(false);
    } catch (err) {
      console.error("Failed to dismiss decision:", err);
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const hasNoFilters = createRule && preview.parts.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dismiss-dialog-title"
      onClick={(e) => {
        // Click outside content closes the dialog
        if (e.target === e.currentTarget && !submitting) {
          onOpenChange(false);
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-border bg-card text-card-foreground shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-start gap-2">
            <Ban className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h2 id="dismiss-dialog-title" className="text-base font-semibold">
                Dismiss this decision?
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                The decision is marked as dismissed; related actions are not
                executed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Context summary */}
          {(decisionContext.event_title ||
            decisionContext.event_severity != null ||
            decisionContext.event_country_code ||
            decisionContext.event_region ||
            decisionContext.event_category) && (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-1.5">
              {decisionContext.event_title && (
                <div className="text-sm font-medium line-clamp-2">
                  {decisionContext.event_title}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                {decisionContext.event_severity != null && (
                  <Badge variant="secondary" className="text-[10px]">
                    Severity {decisionContext.event_severity.toFixed(1)}
                  </Badge>
                )}
                {decisionContext.event_category && (
                  <Badge variant="outline" className="text-[10px]">
                    {decisionContext.event_category}
                  </Badge>
                )}
                {decisionContext.event_country_code && (
                  <Badge variant="outline" className="text-[10px]">
                    {decisionContext.event_country_code}
                  </Badge>
                )}
                {decisionContext.event_region && (
                  <Badge variant="outline" className="text-[10px]">
                    {decisionContext.event_region}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Reason textarea */}
          <div>
            <label className="text-xs font-medium block mb-1">
              Why are you dismissing this?{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              className="flex w-full min-h-[72px] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="e.g. Event is too far from any asset to matter"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              maxLength={1000}
            />
          </div>

          {/* Create-rule checkbox */}
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              disabled={submitting}
              className="mt-0.5"
            />
            <div className="text-sm">
              <div className="font-medium">
                Also create a standing rule to auto-dismiss future matching alerts
              </div>
              <p className="text-xs text-muted-foreground">
                Based on this event&rsquo;s attributes. You can adjust or disable
                the rule later in Settings.
              </p>
            </div>
          </label>

          {/* Rule preview */}
          {createRule && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">
                Preview: rule that will be created
              </div>
              {preview.parts.length > 0 ? (
                <div className="text-xs font-mono text-foreground/90">
                  {preview.parts.join(", ")}
                </div>
              ) : (
                <div className="text-xs text-yellow-300 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    The event has no severity, country, region, or category —
                    the resulting rule would match <strong>every</strong> alert.
                    Consider skipping the rule and editing filters manually in
                    Settings.
                  </span>
                </div>
              )}
              {preview.sevMax != null && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Severity cap is this event&rsquo;s ceiling + 1 (max 10) so
                  similar-or-lower-severity alerts match.
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={submitting || hasNoFilters}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Dismissing…
              </>
            ) : (
              <>
                <Ban className="h-3.5 w-3.5" /> Dismiss
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default DismissDialog;
