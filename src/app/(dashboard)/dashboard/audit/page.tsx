"use client";

/**
 * Audit Log viewer.
 *
 * Append-only record of every action taken in the workspace. The backend
 * enforces immutability at the DB layer (trigger raises on UPDATE/DELETE on
 * the audit_events table), so this UI is pure read + export.
 *
 * Filter state lives in the URL querystring (useSearchParams / router.replace)
 * so auditors can refresh the page, share a filtered view as a link, or
 * bookmark a specific review slice.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ScrollText,
  Download,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";
import {
  listAuditEvents,
  downloadAuditEventsCsv,
  type AuditEvent,
  type ActorType,
  type AuditEventListParams,
} from "@/lib/audit-events";
import { AuditEventRow } from "@/components/audit/audit-event-row";

const PAGE_SIZE = 50;
const ACTOR_OPTIONS: { value: ActorType | "all"; label: string }[] = [
  { value: "all", label: "All actors" },
  { value: "user", label: "User" },
  { value: "agent", label: "Agent" },
  { value: "system", label: "System" },
  { value: "integration", label: "Integration" },
];

/** Normalize a ?raw param into either the concrete string or undefined. */
function q(sp: URLSearchParams, key: string): string | undefined {
  const v = sp.get(key);
  return v && v.length > 0 ? v : undefined;
}

/**
 * Local form state mirrors the querystring, but the user edits freely in the
 * form before hitting "Apply". Only "Apply" pushes changes to the URL,
 * which is what triggers a new fetch. "Clear" resets both.
 */
interface FilterDraft {
  actor_type: ActorType | "all";
  action: string;
  resource_type: string;
  date_from: string;
  date_to: string;
}

const EMPTY_DRAFT: FilterDraft = {
  actor_type: "all",
  action: "",
  resource_type: "",
  date_from: "",
  date_to: "",
};

function draftFromSearchParams(sp: URLSearchParams): FilterDraft {
  const actor = q(sp, "actor_type");
  const valid: ActorType[] = ["user", "agent", "system", "integration"];
  return {
    actor_type:
      actor && valid.includes(actor as ActorType)
        ? (actor as ActorType)
        : "all",
    action: q(sp, "action") ?? "",
    resource_type: q(sp, "resource_type") ?? "",
    date_from: q(sp, "date_from") ?? "",
    date_to: q(sp, "date_to") ?? "",
  };
}

// Next.js 16 requires useSearchParams() callers to be wrapped in <Suspense>
// during static prerender. The default export is a thin wrapper; the real
// content lives in AuditLogPageContent.
export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditLogFallback />}>
      <AuditLogPageContent />
    </Suspense>
  );
}

function AuditLogFallback() {
  return (
    <div className="p-6">
      <div className="h-8 w-48 bg-muted/50 rounded animate-pulse mb-6" />
      <div className="h-64 bg-muted/30 rounded animate-pulse" />
    </div>
  );
}

function AuditLogPageContent() {
  const { companyId } = useCompany();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Parse URL → list params used for the fetch.
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const listParams: AuditEventListParams = useMemo(() => {
    const d = draftFromSearchParams(new URLSearchParams(searchParams.toString()));
    return {
      page,
      page_size: PAGE_SIZE,
      actor_type: d.actor_type === "all" ? undefined : d.actor_type,
      action: d.action || undefined,
      resource_type: d.resource_type || undefined,
      date_from: d.date_from || undefined,
      date_to: d.date_to || undefined,
    };
  }, [searchParams, page]);

  // Local draft — pre-seeded from URL so a refresh keeps the form populated.
  const [draft, setDraft] = useState<FilterDraft>(() =>
    draftFromSearchParams(new URLSearchParams(searchParams.toString()))
  );

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the form in sync if the user hits Back/Forward and the URL changes
  // from under us.
  useEffect(() => {
    setDraft(draftFromSearchParams(new URLSearchParams(searchParams.toString())));
  }, [searchParams]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAuditEvents(companyId, listParams);
      setEvents(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.pages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setEvents([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [companyId, listParams]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /** Push the current draft (plus optional page override) into the URL. */
  const pushFilters = useCallback(
    (next: FilterDraft, nextPage = 1) => {
      const qs = new URLSearchParams();
      if (next.actor_type !== "all") qs.set("actor_type", next.actor_type);
      if (next.action) qs.set("action", next.action);
      if (next.resource_type) qs.set("resource_type", next.resource_type);
      if (next.date_from) qs.set("date_from", next.date_from);
      if (next.date_to) qs.set("date_to", next.date_to);
      if (nextPage > 1) qs.set("page", String(nextPage));
      const query = qs.toString();
      router.replace(`/dashboard/audit${query ? `?${query}` : ""}`);
    },
    [router]
  );

  function handleApply() {
    pushFilters(draft, 1);
  }

  function handleClear() {
    setDraft(EMPTY_DRAFT);
    pushFilters(EMPTY_DRAFT, 1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages) return;
    pushFilters(draft, nextPage);
  }

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadAuditEventsCsv(companyId, {
        actor_type: listParams.actor_type,
        action: listParams.action,
        resource_type: listParams.resource_type,
        date_from: listParams.date_from,
        date_to: listParams.date_to,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const activeFilterCount =
    (listParams.actor_type ? 1 : 0) +
    (listParams.action ? 1 : 0) +
    (listParams.resource_type ? 1 : 0) +
    (listParams.date_from ? 1 : 0) +
    (listParams.date_to ? 1 : 0);

  const firstIdx = events.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastIdx = (page - 1) * PAGE_SIZE + events.length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" /> Audit Log
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Append-only record of every action taken in your workspace.
            Required for compliance review.
          </p>
        </div>
        <div>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4" /> Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {activeFilterCount} active
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Actor type
              </label>
              <select
                value={draft.actor_type}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    actor_type: e.target.value as FilterDraft["actor_type"],
                  }))
                }
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {ACTOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Action
              </label>
              <Input
                className="mt-1 h-9"
                placeholder="e.g. approve, update"
                value={draft.action}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, action: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Resource type
              </label>
              <Input
                className="mt-1 h-9"
                placeholder="e.g. agent_decision"
                value={draft.resource_type}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, resource_type: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                From
              </label>
              <Input
                type="date"
                className="mt-1 h-9"
                value={draft.date_from}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date_from: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                To
              </label>
              <Input
                type="date"
                className="mt-1 h-9"
                value={draft.date_to}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date_to: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleApply} size="sm">
              Apply Filters
            </Button>
            <Button onClick={handleClear} size="sm" variant="outline">
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results meta */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {loading
            ? "Loading..."
            : total === 0
              ? "No events match the current filters."
              : `Showing ${firstIdx}–${lastIdx} of ${total.toLocaleString()} events`}
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Failed to load audit events: {error}
        </div>
      )}

      {/* Events */}
      {!loading && events.length === 0 && !error ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-base font-semibold">No audit events yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {activeFilterCount > 0
                  ? "Try widening your filters — the log is append-only, so anything recorded is still here."
                  : "Actions taken by users, agents, integrations, and the system will appear here."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <AuditEventRow key={event.id} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => goToPage(page + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
