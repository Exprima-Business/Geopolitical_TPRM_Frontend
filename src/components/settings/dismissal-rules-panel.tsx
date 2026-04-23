"use client";

/**
 * Dismissal Rules management panel.
 *
 * Standalone panel — import into the Settings tab list to expose it as a
 * tab. Load is scoped to the current useCompany() id. All writes round-trip
 * to the backend immediately; no local-only edits.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  Ban,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useCompany } from "@/lib/company-context";
import {
  type DismissalRule,
  type DismissalRuleCreate,
  type DismissalRuleUpdate,
  createDismissalRule,
  deleteDismissalRule,
  describeRuleFilters,
  listDismissalRules,
  updateDismissalRule,
} from "@/lib/dismissal-rules";

/* ── Form state ─────────────────────────────────────────── */

interface FormState {
  name: string;
  description: string;
  country_code: string;
  region: string;
  category: string;
  severity_max_enabled: boolean;
  severity_max: number;
  asset_distance_enabled: boolean;
  asset_distance_min_km: number;
  is_enabled: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  country_code: "",
  region: "",
  category: "",
  severity_max_enabled: false,
  severity_max: 5,
  asset_distance_enabled: false,
  asset_distance_min_km: 500,
  is_enabled: true,
};

function ruleToForm(rule: DismissalRule): FormState {
  return {
    name: rule.name,
    description: rule.description ?? "",
    country_code: rule.country_code ?? "",
    region: rule.region ?? "",
    category: rule.category ?? "",
    severity_max_enabled: rule.severity_max != null,
    severity_max: rule.severity_max ?? 5,
    asset_distance_enabled: rule.asset_distance_min_km != null,
    asset_distance_min_km: rule.asset_distance_min_km ?? 500,
    is_enabled: rule.is_enabled,
  };
}

function formToPayload(form: FormState): DismissalRuleCreate {
  // Normalize blank strings to null so the backend sees them as
  // "don't filter on this dimension".
  const trim = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    name: form.name.trim(),
    description: trim(form.description),
    is_enabled: form.is_enabled,
    country_code: trim(form.country_code),
    region: trim(form.region),
    category: trim(form.category),
    severity_max: form.severity_max_enabled ? form.severity_max : null,
    asset_distance_min_km: form.asset_distance_enabled
      ? form.asset_distance_min_km
      : null,
  };
}

/* ── Reusable UI atoms ──────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
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

function NullableSlider({
  label,
  enabled,
  onEnabledChange,
  value,
  onValueChange,
  min,
  max,
  step = 1,
  unit = "",
  nullLabel,
  help,
}: {
  label: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  nullLabel: string;
  help?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
          />
          Filter on this
        </label>
      </div>
      {enabled ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{min}{unit}</span>
            <span className="text-sm font-mono font-bold tabular-nums">
              {value}
              {unit}
            </span>
            <span className="text-[11px] text-muted-foreground">{max}{unit}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onValueChange(parseFloat(e.target.value))}
            className="w-full accent-primary h-1.5"
          />
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">{nullLabel}</p>
      )}
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  );
}

/* ── Rule form (create + edit share this) ───────────────── */

function RuleForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
}) {
  const valid = form.name.trim().length > 0;
  const patch = (partial: Partial<FormState>) => onChange({ ...form, ...partial });

  return (
    <div className="space-y-4">
      {/* Row 1: name + enabled toggle */}
      <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className="text-xs font-medium block mb-1">
            Rule name <span className="text-red-400">*</span>
          </label>
          <Input
            placeholder="e.g. Low-severity earthquakes far from assets"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <span className="text-xs text-muted-foreground">
            {form.is_enabled ? "Active" : "Disabled"}
          </span>
          <Toggle
            checked={form.is_enabled}
            onChange={(v) => patch({ is_enabled: v })}
            ariaLabel={form.is_enabled ? "Disable rule" : "Enable rule"}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium block mb-1">
          Description <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          placeholder="Why this rule exists — visible to other admins."
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>

      {/* Filter columns section */}
      <div className="rounded-md border border-border bg-muted/10 p-3 space-y-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            An incoming decision is dismissed only when it matches{" "}
            <strong>every filter you set below</strong>. Leaving a field blank
            means &ldquo;don&rsquo;t filter on this dimension.&rdquo; A rule with no filters
            set dismisses every alert, so at least one filter is recommended.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Country</label>
            <Input
              placeholder="e.g. JP"
              maxLength={2}
              className="uppercase"
              value={form.country_code}
              onChange={(e) =>
                patch({ country_code: e.target.value.toUpperCase() })
              }
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              ISO-2 code. Leave blank to match any country.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Region</label>
            <Input
              placeholder="e.g. us-west-2 or Kanto"
              value={form.region}
              onChange={(e) => patch({ region: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave blank to match any region.
            </p>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Category</label>
            <Input
              placeholder="e.g. earthquake, cyber, labor"
              value={form.category}
              onChange={(e) => patch({ category: e.target.value })}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Leave blank to match any category.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-1">
          <NullableSlider
            label="Max severity"
            enabled={form.severity_max_enabled}
            onEnabledChange={(v) => patch({ severity_max_enabled: v })}
            value={form.severity_max}
            onValueChange={(v) => patch({ severity_max: v })}
            min={0}
            max={10}
            step={1}
            nullLabel="Matches any severity."
            help="Dismiss alerts at or below this severity."
          />
          <NullableSlider
            label="Min distance from assets"
            enabled={form.asset_distance_enabled}
            onEnabledChange={(v) => patch({ asset_distance_enabled: v })}
            value={form.asset_distance_min_km}
            onValueChange={(v) => patch({ asset_distance_min_km: v })}
            min={0}
            max={5000}
            step={50}
            unit=" km"
            nullLabel="Matches any distance."
            help="Dismiss alerts whose nearest asset is farther than this."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={submitting || !valid}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

/* ── Rule list row ──────────────────────────────────────── */

function RuleRow({
  rule,
  onToggle,
  onEdit,
  onDelete,
  togglePending,
}: {
  rule: DismissalRule;
  onToggle: (rule: DismissalRule) => void;
  onEdit: (rule: DismissalRule) => void;
  onDelete: (rule: DismissalRule) => void;
  togglePending: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-border bg-muted/20 p-3 ${
        rule.is_enabled ? "" : "opacity-60"
      }`}
    >
      <div className="pt-1">
        <Toggle
          checked={rule.is_enabled}
          onChange={() => onToggle(rule)}
          ariaLabel={rule.is_enabled ? "Disable rule" : "Enable rule"}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium">{rule.name}</h3>
          {!rule.is_enabled && (
            <Badge variant="outline" className="text-[10px]">
              Disabled
            </Badge>
          )}
          {togglePending && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {rule.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-mono">{describeRuleFilters(rule)}</span>
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span>
            Matched{" "}
            <span className="text-foreground font-semibold">
              {rule.match_count}
            </span>{" "}
            {rule.match_count === 1 ? "decision" : "decisions"}
          </span>
          {rule.last_matched_at && (
            <span>
              Last match{" "}
              {new Date(rule.last_matched_at).toLocaleString()}
            </span>
          )}
          <span>
            Created {new Date(rule.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(rule)}
          aria-label="Edit rule"
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(rule)}
          aria-label="Delete rule"
          className="h-8 w-8 p-0 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ── Panel ──────────────────────────────────────────────── */

export function DismissalRulesPanel() {
  const { companyId } = useCompany();
  const [rules, setRules] = useState<DismissalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  // Per-rule in-flight flags so toggles/deletes show a spinner without
  // blocking the whole panel.
  const [togglePending, setTogglePending] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await listDismissalRules(companyId);
      setRules(data);
    } catch (err) {
      console.error("Failed to load dismissal rules:", err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const created = await createDismissalRule(companyId, formToPayload(createForm));
      setRules((prev) => [created, ...prev]);
      setShowCreate(false);
      setCreateForm(EMPTY_FORM);
    } catch (err) {
      console.error("Failed to create dismissal rule:", err);
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSave() {
    if (!editingId) return;
    setSubmitting(true);
    try {
      const updated = await updateDismissalRule(
        companyId,
        editingId,
        formToPayload(editForm) as DismissalRuleUpdate,
      );
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditingId(null);
    } catch (err) {
      console.error("Failed to update dismissal rule:", err);
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(rule: DismissalRule) {
    setTogglePending((prev) => ({ ...prev, [rule.id]: true }));
    // Optimistic update so the switch flips immediately.
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r)),
    );
    try {
      const updated = await updateDismissalRule(companyId, rule.id, {
        is_enabled: !rule.is_enabled,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      console.error("Failed to toggle rule:", err);
      // Roll back optimistic update
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id ? { ...r, is_enabled: rule.is_enabled } : r,
        ),
      );
      setError((err as Error).message);
    } finally {
      setTogglePending((prev) => {
        const next = { ...prev };
        delete next[rule.id];
        return next;
      });
    }
  }

  async function handleDelete(rule: DismissalRule) {
    if (
      !window.confirm(
        `Delete rule "${rule.name}"? This will NOT un-dismiss past decisions it matched, but future matching alerts will no longer be auto-dismissed.`,
      )
    ) {
      return;
    }
    try {
      await deleteDismissalRule(companyId, rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      console.error("Failed to delete rule:", err);
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = rules.filter((r) => r.is_enabled).length;

  return (
    <div className="space-y-4">
      {/* Header / summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Ban className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Dismissal Rules</h2>
                <p className="text-xs text-muted-foreground">
                  Auto-dismiss incoming decisions that match every filter you
                  set. Useful for silencing recurring low-relevance alerts.{" "}
                  <span className="text-foreground font-medium">
                    {enabledCount} active
                  </span>{" "}
                  of {rules.length}.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreate((x) => !x);
                if (!showCreate) setCreateForm(EMPTY_FORM);
              }}
              className="h-8 text-xs"
            >
              {showCreate ? (
                <>
                  <X className="h-3.5 w-3.5" /> Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" /> New Rule
                </>
              )}
            </Button>
          </div>

          {error && (
            <div className="mt-3 p-2 rounded border border-red-500/30 bg-red-500/5 text-[11px] text-red-300 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {showCreate && (
            <div className="mt-4 pt-4 border-t border-border">
              <RuleForm
                form={createForm}
                onChange={setCreateForm}
                onSubmit={handleCreate}
                onCancel={() => {
                  setShowCreate(false);
                  setCreateForm(EMPTY_FORM);
                }}
                submitting={submitting}
                submitLabel="Create Rule"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule list */}
      {rules.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="p-10 text-center space-y-2">
            <Ban className="h-10 w-10 mx-auto text-muted-foreground" />
            <h3 className="text-sm font-semibold">No dismissal rules configured</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Create a rule to automatically dismiss recurring non-relevant
              alerts — for example, low-severity events far from your assets,
              or earthquakes in regions where you have no presence.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreate(true)}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> New Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) =>
            editingId === rule.id ? (
              <Card key={rule.id} className="border-primary/40">
                <CardContent className="p-4">
                  <div className="mb-3 text-xs text-muted-foreground">
                    Editing <span className="font-medium text-foreground">{rule.name}</span>
                  </div>
                  <RuleForm
                    form={editForm}
                    onChange={setEditForm}
                    onSubmit={handleEditSave}
                    onCancel={() => setEditingId(null)}
                    submitting={submitting}
                    submitLabel="Save Changes"
                  />
                </CardContent>
              </Card>
            ) : (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={handleToggle}
                onEdit={(r) => {
                  setEditingId(r.id);
                  setEditForm(ruleToForm(r));
                }}
                onDelete={handleDelete}
                togglePending={!!togglePending[rule.id]}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default DismissalRulesPanel;
