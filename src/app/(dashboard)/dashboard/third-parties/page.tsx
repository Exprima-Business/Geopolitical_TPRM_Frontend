"use client";

/**
 * Third Parties list view.
 *
 * Mirrors the visual density of the Integrations catalog — cards not tables,
 * small severity pills, inline filter bar. Clicking a card drills into the
 * vendor detail page at /dashboard/third-parties/[id].
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  ExternalLink,
  Loader2,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import {
  listThirdParties,
  createThirdParty,
  tierBadgeVariant,
  scoreToGrade,
  scoreColorClass,
  countryFlag,
  daysSince,
  COMMON_COUNTRIES,
  type ThirdParty,
  type ThirdPartyTier,
  type ThirdPartyCreate,
  type ThirdPartyUpdate,
} from "@/lib/third-parties";
import { ThirdPartyForm } from "@/components/third-parties/third-party-form";

const TIER_OPTIONS: (ThirdPartyTier | "all")[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];

export default function ThirdPartiesPage() {
  const { companyId } = useCompany();
  const [vendors, setVendors] = useState<ThirdParty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<ThirdPartyTier | "all">("all");
  const [industry, setIndustry] = useState("");
  const [country, setCountry] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listThirdParties(companyId);
      setVendors(data);
    } catch (err) {
      setLoadError(String(err));
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function handleCreate(payload: ThirdPartyCreate | ThirdPartyUpdate) {
    // The form hands back `ThirdPartyCreate | ThirdPartyUpdate` — in create
    // mode `name` and `tier` are always populated by the form's initial
    // state, so we can safely narrow.
    await createThirdParty(companyId, payload as ThirdPartyCreate);
    setShowForm(false);
    await refresh();
  }

  // Client-side filtering on top of the server filters, so typing in the
  // search box feels instant even with the dropdown already applied.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (tier !== "all" && v.tier !== tier) return false;
      if (
        industry &&
        !(v.industry ?? "").toLowerCase().includes(industry.toLowerCase())
      ) {
        return false;
      }
      if (country && v.country_code !== country) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.industry ?? "").toLowerCase().includes(q) ||
        (v.website ?? "").toLowerCase().includes(q)
      );
    });
  }, [vendors, search, tier, industry, country]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Third Parties
          </h1>
          <p className="text-sm text-muted-foreground">
            Your vendor catalog — suppliers, SaaS providers, and downstream
            dependencies monitored for security and geopolitical risk.
          </p>
        </div>
        <Button onClick={() => setShowForm((x) => !x)}>
          <Plus className="h-4 w-4" /> Add Third Party
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, industry, or website..."
            className="pl-9 h-9"
          />
        </div>
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value as ThirdPartyTier | "all")}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          {TIER_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === "all"
                ? "All Tiers"
                : t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>
        <Input
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          placeholder="Industry"
          className="h-9 w-40"
        />
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
        >
          <option value="">All Countries</option>
          {COMMON_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Inline create form */}
      {showForm && (
        <ThirdPartyForm
          existing={null}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {loading
          ? "Loading..."
          : `${filtered.length} of ${vendors.length} ${
              vendors.length === 1 ? "vendor" : "vendors"
            } shown`}
      </p>

      {/* Load error */}
      {loadError && (
        <Card>
          <CardContent className="p-4 flex items-start gap-2 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Could not load third parties</div>
              <div className="text-xs text-muted-foreground mt-1 break-all">
                {loadError}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={refresh}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !loadError && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading vendors...
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !loadError && vendors.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Briefcase className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold">No third parties yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your third-party catalog is empty. Add your first vendor to get
                started.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Add First Vendor
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filtered-but-empty state */}
      {!loading &&
        !loadError &&
        vendors.length > 0 &&
        filtered.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No vendors match your filters.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────── */

function VendorCard({ vendor }: { vendor: ThirdParty }) {
  const grade = scoreToGrade(vendor.security_score);
  const scoreClass = scoreColorClass(vendor.security_score);
  const ageDays = daysSince(vendor.security_score_updated_at);
  const flag = countryFlag(vendor.country_code);

  return (
    <Link
      href={`/dashboard/third-parties/${vendor.id}`}
      className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-xl"
    >
      <Card className="h-full hover:border-primary/40 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate">{vendor.name}</h3>
                <Badge
                  variant={tierBadgeVariant(vendor.tier)}
                  className="text-[10px]"
                >
                  {vendor.tier}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                {vendor.industry && <span>{vendor.industry}</span>}
                {vendor.country_code && (
                  <span>
                    {flag} {vendor.country_code}
                  </span>
                )}
              </div>
            </div>
            {vendor.security_score != null && (
              <div className="shrink-0 text-right">
                <div className={`text-xl font-bold leading-none ${scoreClass}`}>
                  {grade}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {vendor.security_score.toFixed(0)}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border text-[11px] text-muted-foreground">
            {vendor.website ? (
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 hover:text-primary truncate max-w-[60%]"
              >
                <span className="truncate">
                  {vendor.website.replace(/^https?:\/\//, "")}
                </span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            ) : (
              <span className="text-muted-foreground/60">No website</span>
            )}
            <span>
              {vendor.security_score_updated_at
                ? ageDays === 0
                  ? "Updated today"
                  : `Updated ${ageDays}d ago`
                : "No score yet"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
