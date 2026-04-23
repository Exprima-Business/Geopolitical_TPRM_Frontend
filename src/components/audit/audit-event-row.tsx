"use client";

/**
 * Single row in the audit log viewer.
 *
 * Collapsed: one-line summary (who did what to which resource, when).
 * Expanded: before / after state JSON, metadata, IP + user agent footer.
 *
 * The JSON diff highlight is value-level: any key whose stringified value
 * differs between before_state and after_state gets a colored background on
 * both sides. This is a display helper, not a semantic diff — nested arrays
 * with reordered elements will light up, which is the right call for
 * auditors (they want to see anything that changed).
 */

import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User as UserIcon,
  Server,
  Plug,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { AuditEvent, ActorType } from "@/lib/audit-events";

/* ── Actor visuals ─────────────────────────────────────── */

const ACTOR_ICON: Record<ActorType, typeof Bot> = {
  user: UserIcon,
  agent: Bot,
  system: Server,
  integration: Plug,
};

const ACTOR_COLOR: Record<ActorType, string> = {
  user: "text-blue-400",
  agent: "text-purple-400",
  system: "text-muted-foreground",
  integration: "text-emerald-400",
};

const ACTOR_LABEL: Record<ActorType, string> = {
  user: "User",
  agent: "Agent",
  system: "System",
  integration: "Integration",
};

/* ── Relative-time helper ──────────────────────────────── */

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ── Diff highlight ────────────────────────────────────── */

function changedKeys(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): Set<string> {
  const changed = new Set<string>();
  if (!before && !after) return changed;
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const k of keys) {
    const b = JSON.stringify((before ?? {})[k]);
    const a = JSON.stringify((after ?? {})[k]);
    if (b !== a) changed.add(k);
  }
  return changed;
}

function JsonBlock({
  data,
  changed,
  variant,
}: {
  data: Record<string, unknown>;
  changed: Set<string>;
  variant: "before" | "after";
}) {
  const highlightClass =
    variant === "before"
      ? "bg-red-500/10 border-l-2 border-red-500/40"
      : "bg-emerald-500/10 border-l-2 border-emerald-500/40";
  const keys = Object.keys(data).sort();
  return (
    <div className="rounded bg-muted/40 p-2 font-mono text-[11px] overflow-x-auto max-h-80 overflow-y-auto">
      <div className="text-muted-foreground">{"{"}</div>
      {keys.map((k) => {
        const value = JSON.stringify(data[k], null, 2) ?? "null";
        const isChanged = changed.has(k);
        return (
          <div
            key={k}
            className={`pl-3 py-0.5 ${isChanged ? highlightClass + " pl-2 ml-1" : ""}`}
          >
            <span className="text-blue-300">{JSON.stringify(k)}</span>
            <span className="text-muted-foreground">: </span>
            <span className="whitespace-pre-wrap break-all">{value}</span>
            <span className="text-muted-foreground">,</span>
          </div>
        );
      })}
      <div className="text-muted-foreground">{"}"}</div>
    </div>
  );
}

/* ── Row ───────────────────────────────────────────────── */

export function AuditEventRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = useState(false);

  const Icon = ACTOR_ICON[event.actor_type] ?? Server;
  const iconColor = ACTOR_COLOR[event.actor_type] ?? "text-muted-foreground";
  const actorLabel =
    event.actor_email ??
    (event.actor_type ? ACTOR_LABEL[event.actor_type] : "Unknown");

  const changed = useMemo(
    () => changedKeys(event.before_state, event.after_state),
    [event.before_state, event.after_state]
  );

  const hasDetails =
    event.before_state ||
    event.after_state ||
    (event.metadata && Object.keys(event.metadata).length > 0);

  const bothStates = event.before_state && event.after_state;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/40 transition-colors"
        aria-expanded={expanded}
      >
        {/* Actor */}
        <div className="flex items-center gap-2 w-56 min-w-0 shrink-0">
          <div
            className={`h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center shrink-0 ${iconColor}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{actorLabel}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {ACTOR_LABEL[event.actor_type] ?? event.actor_type}
            </div>
          </div>
        </div>

        {/* Action / resource */}
        <div className="flex-1 min-w-0">
          <div className="text-sm flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {event.action}
            </Badge>
            <span className="text-muted-foreground">on</span>
            <span className="font-mono text-xs text-foreground">
              {event.resource_type}
            </span>
            {event.resource_id && (
              <span className="font-mono text-[10px] text-muted-foreground truncate">
                #{event.resource_id.slice(0, 8)}
              </span>
            )}
          </div>
          <div
            className="text-[11px] text-muted-foreground"
            title={new Date(event.created_at).toLocaleString()}
          >
            {relativeTime(event.created_at)}
          </div>
        </div>

        {/* Expander */}
        <div className="text-muted-foreground flex items-center gap-1 shrink-0">
          <span className="text-xs">
            {expanded ? "Hide" : "View"} details
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/10">
          {!hasDetails && (
            <p className="text-xs italic text-muted-foreground">
              No state payload recorded for this event.
            </p>
          )}

          {bothStates ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <StatePane
                title="Before"
                subtitle="Previous state"
                color="text-red-400"
              >
                <JsonBlock
                  data={event.before_state!}
                  changed={changed}
                  variant="before"
                />
              </StatePane>
              <StatePane
                title="After"
                subtitle="New state"
                color="text-emerald-400"
              >
                <JsonBlock
                  data={event.after_state!}
                  changed={changed}
                  variant="after"
                />
              </StatePane>
            </div>
          ) : event.after_state ? (
            <StatePane title="After" subtitle="New state" color="text-emerald-400">
              <JsonBlock
                data={event.after_state}
                changed={new Set()}
                variant="after"
              />
            </StatePane>
          ) : event.before_state ? (
            <StatePane title="Before" subtitle="Previous state" color="text-red-400">
              <JsonBlock
                data={event.before_state}
                changed={new Set()}
                variant="before"
              />
            </StatePane>
          ) : null}

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <StatePane
              title="Metadata"
              subtitle="Context at time of event"
              color="text-muted-foreground"
            >
              <pre className="rounded bg-muted/40 p-2 font-mono text-[11px] overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-all">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </StatePane>
          )}

          {/* Footer — IP + user agent + full timestamp + ids */}
          <div className="border-t border-border pt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
            <span>
              <strong className="text-foreground/70">Event ID:</strong>{" "}
              <span className="font-mono">{event.id}</span>
            </span>
            <span>
              <strong className="text-foreground/70">When:</strong>{" "}
              {new Date(event.created_at).toLocaleString()}
            </span>
            {event.ip_address && (
              <span>
                <strong className="text-foreground/70">IP:</strong>{" "}
                <span className="font-mono">{event.ip_address}</span>
              </span>
            )}
            {event.actor_id && (
              <span>
                <strong className="text-foreground/70">Actor ID:</strong>{" "}
                <span className="font-mono">{event.actor_id}</span>
              </span>
            )}
            {event.user_agent && (
              <span className="basis-full truncate" title={event.user_agent}>
                <strong className="text-foreground/70">User agent:</strong>{" "}
                <span className="font-mono">{event.user_agent}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatePane({
  title,
  subtitle,
  color,
  children,
}: {
  title: string;
  subtitle: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
          {title}
        </span>
        <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}
