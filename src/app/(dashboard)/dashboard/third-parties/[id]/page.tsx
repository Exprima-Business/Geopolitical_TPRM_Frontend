"use client";

/**
 * Third-party detail view.
 *
 * Shows vendor overview, current + historical security scores, a form
 * to record a new score, downstream impact (affected assets + sub-vendors),
 * and the SLA terms blob. All data comes from the live backend endpoints —
 * there is no mock layer.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCompany } from "@/lib/company-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Pencil,
  Globe,
  Mail,
  Building2,
  MapPin,
  Calendar,
  AlertTriangle,
  Network,
  FileText,
  Save,
  Plus,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import {
  getThirdParty,
  updateThirdParty,
  deleteThirdParty,
  listScores,
  recordScore,
  getDownstream,
  scoreColorClass,
  scoreToGrade,
  tierBadgeVariant,
  countryFlag,
  SCORE_SOURCE_OPTIONS,
  type ThirdParty,
  type ThirdPartyCreate,
  type ThirdPartyUpdate,
  type VendorRiskScore,
  type VendorScoreSource,
  type DownstreamImpact,
} from "@/lib/third-parties";
import { ThirdPartyForm } from "@/components/third-parties/third-party-form";

export default function ThirdPartyDetailPage() {
  const { companyId } = useCompany();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vendorId = params?.id;

  const [vendor, setVendor] = useState<ThirdParty | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [scores, setScores] = useState<VendorRiskScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [downstream, setDownstream] = useState<DownstreamImpact | null>(null);
  const [downstreamLoading, setDownstreamLoading] = useState(false);
  const [downstreamError, setDownstreamError] = useState<string | null>(null);

  /* ── Loaders ─────────────────────────────────────────── */

  const loadVendor = useCallback(async () => {
    if (!vendorId) return;
    setLoading(true);
    setNotFound(false);
    setLoadError(null);
    try {
      const data = await getThirdParty(companyId, vendorId);
      setVendor(data);
    } catch (err) {
      const msg = String(err);
      if (msg.includes("404")) {
        setNotFound(true);
      } else {
        setLoadError(msg);
      }
      setVendor(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, vendorId]);

  const loadScores = useCallback(async () => {
    if (!vendorId) return;
    setScoresLoading(true);
    try {
      const data = await listScores(companyId, vendorId);
      // Most-recent first. Backend ordering isn't guaranteed — sort defensively.
      data.sort(
        (a, b) =>
          new Date(b.snapshot_at).getTime() -
          new Date(a.snapshot_at).getTime()
      );
      setScores(data);
    } catch (err) {
      console.error("Failed to load score history", err);
      setScores([]);
    } finally {
      setScoresLoading(false);
    }
  }, [companyId, vendorId]);

  const loadDownstream = useCallback(async () => {
    if (!vendorId) return;
    setDownstreamLoading(true);
    setDownstreamError(null);
    try {
      const data = await getDownstream(companyId, vendorId);
      setDownstream(data);
    } catch (err) {
      setDownstreamError(String(err));
      setDownstream(null);
    } finally {
      setDownstreamLoading(false);
    }
  }, [companyId, vendorId]);

  useEffect(() => {
    loadVendor();
    loadScores();
    loadDownstream();
  }, [loadVendor, loadScores, loadDownstream]);

  /* ── Actions ─────────────────────────────────────────── */

  async function handleEditSubmit(
    payload: ThirdPartyCreate | ThirdPartyUpdate
  ) {
    if (!vendor) return;
    const updated = await updateThirdParty(
      companyId,
      vendor.id,
      payload as ThirdPartyUpdate
    );
    setVendor(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!vendor) return;
    if (
      !confirm(
        `Delete third party "${vendor.name}"? This cannot be undone. Downstream dependencies will be detached.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await deleteThirdParty(companyId, vendor.id);
      router.push("/dashboard/third-parties");
    } catch (err) {
      alert(`Delete failed: ${err}`);
      setDeleting(false);
    }
  }

  /* ── Render ──────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading vendor...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notFound || (!vendor && !loadError)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <h3 className="font-semibold">Third party not found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The vendor you're looking for doesn't exist or has been deleted.
              </p>
            </div>
            <Link href="/dashboard/third-parties">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" /> Back to list
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loadError || !vendor) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-start gap-2 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-medium">Could not load vendor</div>
                <div className="text-xs text-muted-foreground mt-1 break-all">
                  {loadError}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadVendor}>
                Retry
              </Button>
              <Link href="/dashboard/third-parties">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <Link
          href="/dashboard/third-parties"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Third Parties
        </Link>
        <ThirdPartyForm
          existing={vendor}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Breadcrumb */}
      <Link
        href="/dashboard/third-parties"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Third Parties
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{vendor.name}</h1>
            <Badge variant={tierBadgeVariant(vendor.tier)}>{vendor.tier}</Badge>
            {!vendor.is_active && (
              <Badge variant="outline" className="text-[10px]">
                Inactive
              </Badge>
            )}
          </div>
          {vendor.industry && (
            <p className="text-sm text-muted-foreground mt-1">
              {vendor.industry}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-400 hover:text-red-400"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete
          </Button>
        </div>
      </div>

      {/* Two-column layout on wide screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OverviewCard vendor={vendor} />
        <SecurityScoreCard
          vendor={vendor}
          scores={scores}
          scoresLoading={scoresLoading}
          onScoreRecorded={async () => {
            await Promise.all([loadVendor(), loadScores()]);
          }}
          companyId={companyId}
          vendorId={vendor.id}
        />
        <DownstreamCard
          impact={downstream}
          loading={downstreamLoading}
          error={downstreamError}
          onRetry={loadDownstream}
        />
        <SlaTermsCard terms={vendor.sla_terms} />
      </div>
    </div>
  );
}

/* ── Overview ───────────────────────────────────────────── */

function OverviewCard({ vendor }: { vendor: ThirdParty }) {
  const flag = countryFlag(vendor.country_code);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Overview
        </h2>
        <dl className="grid grid-cols-1 gap-2 text-sm">
          <InfoRow
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Industry"
            value={vendor.industry ?? "—"}
          />
          <InfoRow
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Country"
            value={
              vendor.country_code
                ? `${flag} ${vendor.country_code}`
                : "—"
            }
          />
          <InfoRow
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Website"
            value={
              vendor.website ? (
                <a
                  href={vendor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  {vendor.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoRow
            icon={<Mail className="h-3.5 w-3.5" />}
            label="Contact"
            value={
              vendor.contact_email ? (
                <a
                  href={`mailto:${vendor.contact_email}`}
                  className="text-primary hover:underline"
                >
                  {vendor.contact_email}
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Added"
            value={new Date(vendor.created_at).toLocaleDateString()}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <dt className="text-[10px] uppercase text-muted-foreground tracking-wide">
          {label}
        </dt>
        <dd className="text-sm truncate">{value}</dd>
      </div>
    </div>
  );
}

/* ── Security Score ─────────────────────────────────────── */

function SecurityScoreCard({
  vendor,
  scores,
  scoresLoading,
  onScoreRecorded,
  companyId,
  vendorId,
}: {
  vendor: ThirdParty;
  scores: VendorRiskScore[];
  scoresLoading: boolean;
  onScoreRecorded: () => Promise<void>;
  companyId: string;
  vendorId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState<VendorScoreSource>("manual");
  const [scoreValue, setScoreValue] = useState("");
  const [grade, setGrade] = useState("");
  const [findings, setFindings] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentScore = vendor.security_score;
  const currentGrade = scoreToGrade(currentScore);
  const scoreClass = scoreColorClass(currentScore);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = Number(scoreValue);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Score must be a number between 0 and 100");
      return;
    }
    setSubmitting(true);
    try {
      await recordScore(companyId, vendorId, {
        source,
        score: n,
        grade: grade.trim() || null,
        findings: findings.trim() || null,
      });
      setShowForm(false);
      setScoreValue("");
      setGrade("");
      setFindings("");
      await onScoreRecorded();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Small sparkline-ish list — the last 10 scores in reverse-chron order,
  // already sorted upstream.
  const recent = useMemo(() => scores.slice(0, 10), [scores]);

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Security Score
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowForm((x) => !x)}
          >
            <Plus className="h-3 w-3" /> Record Score
          </Button>
        </div>

        {/* Current */}
        <div className="flex items-center gap-4">
          <div className={`text-5xl font-bold leading-none ${scoreClass}`}>
            {currentGrade}
          </div>
          <div>
            <div className={`text-2xl font-semibold ${scoreClass}`}>
              {currentScore != null ? currentScore.toFixed(0) : "—"}
              <span className="text-sm text-muted-foreground font-normal">
                {" "}
                / 100
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {vendor.security_score_source
                ? `Source: ${vendor.security_score_source}`
                : "No score recorded"}
              {vendor.security_score_updated_at && (
                <>
                  {" · "}
                  {new Date(
                    vendor.security_score_updated_at
                  ).toLocaleDateString()}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Record score form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="border-t border-border pt-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Source</label>
                <select
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value as VendorScoreSource)
                  }
                  className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  {SCORE_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  Score (0–100) <span className="text-red-400">*</span>
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="1"
                  value={scoreValue}
                  onChange={(e) => setScoreValue(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Grade</label>
                <Input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="A, B, C..."
                  className="h-8 text-xs"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Findings</label>
              <textarea
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                placeholder="Optional notes (open CVEs, audit findings, etc.)"
                className="flex w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs min-h-[60px]"
              />
            </div>
            {error && (
              <div className="text-xs text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Record
              </Button>
            </div>
          </form>
        )}

        {/* History */}
        <div className="border-t border-border pt-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
            Recent History
          </div>
          {scoresLoading ? (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : recent.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No scores recorded yet.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-mono font-semibold ${scoreColorClass(
                        s.score
                      )}`}
                    >
                      {s.grade ?? scoreToGrade(s.score)}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>{s.score.toFixed(0)}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground truncate">
                      {s.source}
                    </span>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(s.snapshot_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Downstream ─────────────────────────────────────────── */

function DownstreamCard({
  impact,
  loading,
  error,
  onRetry,
}: {
  impact: DownstreamImpact | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Network className="h-4 w-4" /> Downstream Impact
        </h2>
        {loading ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading...
          </div>
        ) : error ? (
          <div className="text-xs text-red-400 space-y-2">
            <div className="flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px]"
              onClick={onRetry}
            >
              Retry
            </Button>
          </div>
        ) : !impact ||
          (impact.assets.length === 0 && impact.sub_vendors.length === 0) ? (
          <p className="text-xs text-muted-foreground">
            No downstream dependencies mapped. Link this vendor to assets or
            sub-vendors to see blast-radius analysis here.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Affected Assets ({impact.assets.length})
              </div>
              {impact.assets.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1">
                  {impact.assets.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate">{a.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.asset_type && (
                          <Badge variant="outline" className="text-[10px]">
                            {a.asset_type.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {a.criticality && (
                          <Badge
                            variant={
                              (a.criticality as
                                | "critical"
                                | "high"
                                | "medium"
                                | "low") ?? "outline"
                            }
                            className="text-[10px]"
                          >
                            {a.criticality}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                Sub-Vendors ({impact.sub_vendors.length})
              </div>
              {impact.sub_vendors.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1">
                  {impact.sub_vendors.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <Link
                        href={`/dashboard/third-parties/${v.id}`}
                        className="truncate hover:text-primary hover:underline"
                      >
                        {v.name}
                      </Link>
                      <div className="flex items-center gap-1 shrink-0">
                        {v.relationship && (
                          <span className="text-muted-foreground text-[10px]">
                            {v.relationship}
                          </span>
                        )}
                        {v.tier && (
                          <Badge
                            variant={tierBadgeVariant(v.tier)}
                            className="text-[10px]"
                          >
                            {v.tier}
                          </Badge>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── SLA Terms ──────────────────────────────────────────── */

function SlaTermsCard({
  terms,
}: {
  terms: Record<string, unknown> | null;
}) {
  const entries = terms ? Object.entries(terms) : [];
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> SLA Terms
        </h2>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Not configured. Edit this vendor to add SLA terms (response times,
            uptime commitments, penalty clauses).
          </p>
        ) : (
          <dl className="grid grid-cols-1 gap-2 text-sm">
            {entries.map(([key, value]) => (
              <div
                key={key}
                className="flex items-start justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0"
              >
                <dt className="text-xs text-muted-foreground capitalize">
                  {key.replace(/_/g, " ")}
                </dt>
                <dd className="text-xs font-mono text-right break-all max-w-[60%]">
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
