"use client";

/**
 * Shared create/edit form for third-party vendors.
 *
 * Used by:
 *   - /dashboard/third-parties (inline panel above the list)
 *   - /dashboard/third-parties/[id] (edit mode in-page)
 *
 * All fields map 1:1 to `ThirdPartyCreate` / `ThirdPartyUpdate` on the
 * backend. `sla_terms` is edited as a raw JSON textarea — it's a small
 * free-form blob (response times, penalty clauses, etc.) that we don't
 * want to over-engineer with a structured editor yet.
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, X, AlertTriangle } from "lucide-react";
import {
  COMMON_COUNTRIES,
  type ThirdParty,
  type ThirdPartyCreate,
  type ThirdPartyTier,
  type ThirdPartyUpdate,
} from "@/lib/third-parties";

export interface ThirdPartyFormProps {
  /** Existing vendor when editing; `null` when creating. */
  existing: ThirdParty | null;
  /** Called with the form payload — the parent handles the API call. */
  onSubmit: (payload: ThirdPartyCreate | ThirdPartyUpdate) => Promise<void>;
  onCancel: () => void;
  /** Optional label override (defaults to "Save"/"Create"). */
  submitLabel?: string;
}

const TIERS: ThirdPartyTier[] = ["critical", "high", "medium", "low"];

export function ThirdPartyForm({
  existing,
  onSubmit,
  onCancel,
  submitLabel,
}: ThirdPartyFormProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [tier, setTier] = useState<ThirdPartyTier>(existing?.tier ?? "medium");
  const [industry, setIndustry] = useState(existing?.industry ?? "");
  const [countryCode, setCountryCode] = useState(existing?.country_code ?? "");
  const [website, setWebsite] = useState(existing?.website ?? "");
  const [contactEmail, setContactEmail] = useState(
    existing?.contact_email ?? ""
  );
  const [slaTermsText, setSlaTermsText] = useState<string>(() =>
    existing?.sla_terms ? JSON.stringify(existing.sla_terms, null, 2) : ""
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  function validate(): { ok: true; sla: Record<string, unknown> | null } | { ok: false; errors: string[] } {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Name is required");
    if (countryCode && countryCode.trim().length !== 2) {
      errs.push("Country code must be a 2-letter ISO code (e.g. US, GB, DE)");
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errs.push("Contact email is not a valid address");
    }
    let sla: Record<string, unknown> | null = null;
    const slaText = slaTermsText.trim();
    if (slaText) {
      try {
        const parsed = JSON.parse(slaText);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          errs.push("SLA terms must be a JSON object (e.g. {\"response_hours\": 4})");
        } else {
          sla = parsed as Record<string, unknown>;
        }
      } catch {
        errs.push("SLA terms is not valid JSON");
      }
    }
    if (errs.length) return { ok: false, errors: errs };
    return { ok: true, sla };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = validate();
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setSaving(true);
    try {
      const payload: ThirdPartyCreate | ThirdPartyUpdate = {
        name: name.trim(),
        tier,
        industry: industry.trim() || null,
        country_code: countryCode.trim().toUpperCase() || null,
        website: website.trim() || null,
        contact_email: contactEmail.trim() || null,
        sla_terms: result.sla,
      };
      await onSubmit(payload);
    } catch (err) {
      setErrors([String(err)]);
    } finally {
      setSaving(false);
    }
  }

  const title = existing ? "Edit Third Party" : "Add Third Party";
  const buttonLabel =
    submitLabel ?? (existing ? "Save Changes" : "Create Third Party");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">
              Name <span className="text-red-400">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Cloud Services, Inc."
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tier</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as ThirdPartyTier)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Determines escalation priority when risk events affect this vendor.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Industry</label>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Cloud Infrastructure"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Country Code</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="">— Select —</option>
              {COMMON_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Website</label>
            <Input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">Contact Email</label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="security@acme.com"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium">SLA Terms (JSON)</label>
            <textarea
              value={slaTermsText}
              onChange={(e) => setSlaTermsText(e.target.value)}
              placeholder={`{\n  "response_hours": 4,\n  "uptime_pct": 99.9\n}`}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono min-h-[120px] placeholder:text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Optional. Free-form JSON object of contractual commitments (uptime,
              response time, penalty clauses).
            </p>
          </div>

          {errors.length > 0 && (
            <div className="md:col-span-2 p-3 rounded-md border border-red-400/30 bg-red-400/10 text-sm text-red-400 space-y-1">
              {errors.map((err, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Saving..." : buttonLabel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
