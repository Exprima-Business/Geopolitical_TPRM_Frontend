import {
  Shield, Bell, Activity, Truck, Server, AlertTriangle, Eye,
  type LucideIcon,
} from "lucide-react";

export interface ActionTemplate {
  id: string;
  action: string;
  name: string;
  description: string;
  severity_min: number;
  severity_max: number;
  estimated_duration: string;
  required_roles: string[];
  steps: string[];
  risks: string[];
  enabled: boolean;
  custom?: boolean;
}

export const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  increase_monitoring: Eye,
  notify_vendor: Bell,
  activate_backup: Server,
  reroute: Truck,
  failover: Activity,
  escalate_to_human: AlertTriangle,
  assess_risk_for_asset: Shield,
};

export const DEFAULT_TEMPLATES: ActionTemplate[] = [
  {
    id: "tpl_increase_monitoring",
    action: "increase_monitoring",
    name: "Increase Monitoring",
    description: "Raise log verbosity and alert frequency for affected assets while the threat is active.",
    severity_min: 3,
    severity_max: 6,
    estimated_duration: "< 5 min",
    required_roles: ["Security Ops"],
    steps: [
      "Enable verbose logging on affected assets",
      "Lower alert thresholds for anomalous traffic",
      "Add affected region to watch list",
      "Schedule review after 24h",
    ],
    risks: [
      "Higher log storage cost during monitoring window",
      "Additional noise for on-call team",
    ],
    enabled: true,
  },
  {
    id: "tpl_notify_vendor",
    action: "notify_vendor",
    name: "Notify Vendor",
    description: "Send a formal notice to the vendor / third-party of potential disruption so they can respond.",
    severity_min: 4,
    severity_max: 8,
    estimated_duration: "< 15 min",
    required_roles: ["Vendor Management", "TPRM Lead"],
    steps: [
      "Identify primary vendor contact from contract metadata",
      "Draft notification with event summary and affected assets",
      "Send via primary and secondary channels (email + webhook)",
      "Log acknowledgment or escalate if no reply in 2h",
    ],
    risks: [
      "Premature notice may damage vendor relationship",
      "Vendor may lack authority to act on short notice",
    ],
    enabled: true,
  },
  {
    id: "tpl_activate_backup",
    action: "activate_backup",
    name: "Activate Backup Systems",
    description: "Spin up standby infrastructure so services remain available if primary systems degrade.",
    severity_min: 6,
    severity_max: 9,
    estimated_duration: "15 – 45 min",
    required_roles: ["IT Ops", "Security Ops"],
    steps: [
      "Verify backup systems are current and healthy",
      "Pre-warm caches and establish connections",
      "Replicate most recent data snapshot",
      "Place backup in warm-standby, not live traffic",
      "Notify on-call team that standby is armed",
    ],
    risks: [
      "Backup infrastructure cost while armed",
      "Data replication lag if primary fails during activation",
      "Configuration drift between primary and backup",
    ],
    enabled: true,
  },
  {
    id: "tpl_reroute",
    action: "reroute",
    name: "Reroute Traffic / Supply Chain",
    description: "Redirect network traffic or physical supply routes away from affected regions.",
    severity_min: 6,
    severity_max: 9,
    estimated_duration: "30 – 90 min",
    required_roles: ["IT Ops", "Supply Chain Lead"],
    steps: [
      "Identify alternate routes with sufficient capacity",
      "Update DNS / CDN / BGP or shipping manifests",
      "Drain connections from affected path",
      "Monitor latency and error rate on new route",
      "Document reroute for compliance audit",
    ],
    risks: [
      "Alternate route may have higher latency or cost",
      "Reroute may trigger SLA clauses with downstream partners",
      "Rollback requires same coordination",
    ],
    enabled: true,
  },
  {
    id: "tpl_failover",
    action: "failover",
    name: "Failover to DR Site",
    description: "Cut over primary services to the disaster-recovery site. Highest-disruption option.",
    severity_min: 8,
    severity_max: 10,
    estimated_duration: "1 – 4 hours",
    required_roles: ["IT Ops Lead", "CTO Approval", "Security Ops"],
    steps: [
      "Final approval checkpoint with exec sponsor",
      "Freeze writes on primary site",
      "Promote DR replica to primary",
      "Redirect traffic via DNS / load balancer",
      "Verify data consistency and run smoke tests",
      "Communicate status to customers",
    ],
    risks: [
      "Data loss window (RPO) if replication was lagging",
      "Extended downtime if DR site has undetected drift",
      "Failback is a second high-risk operation",
      "Customer-visible outage during cutover",
    ],
    enabled: true,
  },
  {
    id: "tpl_escalate_to_human",
    action: "escalate_to_human",
    name: "Escalate to Human Review",
    description: "Pause autonomous action and hand off the decision to a named approver.",
    severity_min: 1,
    severity_max: 10,
    estimated_duration: "Depends on approver SLA",
    required_roles: ["Designated Approver"],
    steps: [
      "Package event context, affected assets, and agent reasoning",
      "Notify approver via configured channel",
      "Block dependent actions until decision received",
      "Log full audit trail of decision rationale",
    ],
    risks: [
      "Delay while awaiting human response",
      "Approver may lack context the agent already has",
    ],
    enabled: true,
  },
];

const STORAGE_KEY_PREFIX = "tprm:action_templates:";

function storageKey(companyId: string): string {
  return `${STORAGE_KEY_PREFIX}${companyId}`;
}

export function loadTemplates(companyId: string): ActionTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw) as ActionTemplate[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TEMPLATES;
    const byAction = new Map(parsed.map((t) => [t.action, t]));
    const merged = DEFAULT_TEMPLATES.map((d) => byAction.get(d.action) ?? d);
    const customs = parsed.filter((t) => t.custom);
    return [...merged, ...customs];
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplates(companyId: string, templates: ActionTemplate[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(companyId), JSON.stringify(templates));
}

export function resetTemplates(companyId: string): ActionTemplate[] {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(storageKey(companyId));
  }
  return DEFAULT_TEMPLATES;
}

export function findTemplateForAction(
  action: string,
  templates: ActionTemplate[]
): ActionTemplate | null {
  return templates.find((t) => t.action === action && t.enabled) ?? null;
}
