/**
 * Action template API client + default seed templates.
 *
 * Templates are stored server-side in the action_templates + template_steps
 * tables. The DEFAULT_TEMPLATES array below seeds a fresh company — the UI
 * "Reset Templates" button replaces the stored set with these defaults.
 *
 * Icon metadata is kept client-side only (the server does not return
 * IconLucide instances).
 */

import {
  Shield, Bell, Activity, Truck, Server, AlertTriangle, Eye,
  type LucideIcon,
} from "lucide-react";
import { api } from "./api";

export interface TemplateStep {
  id?: string;
  step_order: number;
  label: string;
  integration_connection_id?: string | null;
  integration_id: string;
  action_key: string;
  params_template: Record<string, unknown>;
  required: boolean;
  timeout_seconds: number;
}

export interface ActionTemplate {
  id?: string;
  company_id?: string;
  action_key: string;
  name: string;
  description: string;
  severity_min: number;
  severity_max: number;
  estimated_duration: string;
  required_roles: string[];
  risks: string[];
  is_enabled: boolean;
  is_custom?: boolean;
  steps: TemplateStep[];
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

/**
 * Default seed templates — canonical list kept in sync with the agent's tool
 * catalog at apps/api/app/agents/tools.py. Every action_key below corresponds
 * to an `action` value the agent can write to agent_decisions.action:
 *
 *   - propose_mitigation → increase_monitoring | notify_vendor | activate_backup
 *                        | reroute | failover
 *   - send_alert        → send_alert_email | send_alert_webhook | send_alert_in_app
 *   - escalate_to_human → escalate_to_human
 *   - assess_risk       → assess_risk_for_asset
 *
 * Steps default to empty — customers bind them to their configured integrations
 * in the UI (Settings → Action Templates → expand step).
 */
export const DEFAULT_TEMPLATES: ActionTemplate[] = [
  /* ── Mitigation actions (from handle_propose_mitigation) ───────────── */
  {
    action_key: "increase_monitoring",
    name: "Increase Monitoring",
    description: "Raise log verbosity and alert frequency for affected assets while the threat is active.",
    severity_min: 3,
    severity_max: 6,
    estimated_duration: "< 5 min",
    required_roles: ["Security Ops"],
    risks: [
      "Higher log storage cost during monitoring window",
      "Additional noise for on-call team",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "notify_vendor",
    name: "Notify Vendor",
    description: "Send a formal notice to the vendor / third-party of potential disruption so they can respond.",
    severity_min: 4,
    severity_max: 8,
    estimated_duration: "< 15 min",
    required_roles: ["Vendor Management", "TPRM Lead"],
    risks: [
      "Premature notice may damage vendor relationship",
      "Vendor may lack authority to act on short notice",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "activate_backup",
    name: "Activate Backup Systems",
    description: "Spin up standby infrastructure so services remain available if primary systems degrade.",
    severity_min: 6,
    severity_max: 9,
    estimated_duration: "15 – 45 min",
    required_roles: ["IT Ops", "Security Ops"],
    risks: [
      "Backup infrastructure cost while armed",
      "Data replication lag if primary fails during activation",
      "Configuration drift between primary and backup",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "reroute",
    name: "Reroute Traffic / Supply Chain",
    description: "Redirect network traffic or physical supply routes away from affected regions.",
    severity_min: 6,
    severity_max: 9,
    estimated_duration: "30 – 90 min",
    required_roles: ["IT Ops", "Supply Chain Lead"],
    risks: [
      "Alternate route may have higher latency or cost",
      "Reroute may trigger SLA clauses with downstream partners",
      "Rollback requires same coordination",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "failover",
    name: "Failover to DR Site",
    description: "Cut over primary services to the disaster-recovery site. Highest-disruption option.",
    severity_min: 8,
    severity_max: 10,
    estimated_duration: "1 – 4 hours",
    required_roles: ["IT Ops Lead", "CTO Approval", "Security Ops"],
    risks: [
      "Data loss window (RPO) if replication was lagging",
      "Extended downtime if DR site has undetected drift",
      "Failback is a second high-risk operation",
      "Customer-visible outage during cutover",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },

  /* ── Alert actions (from handle_send_alert — channel becomes suffix) ── */
  {
    action_key: "send_alert_email",
    name: "Email Alert",
    description: "Send an alert email to stakeholders via SendGrid or an SMTP relay.",
    severity_min: 3,
    severity_max: 10,
    estimated_duration: "< 1 min",
    required_roles: ["On-Call"],
    risks: [
      "Email may be missed if recipient is offline",
      "Spam filters may delay delivery",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "send_alert_webhook",
    name: "Webhook Alert",
    description: "POST an alert payload to a configured webhook (Slack, Microsoft Teams, custom receiver).",
    severity_min: 3,
    severity_max: 10,
    estimated_duration: "< 1 min",
    required_roles: [],
    risks: [
      "Downstream webhook may be rate-limited or offline",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
  {
    action_key: "send_alert_in_app",
    name: "In-App Alert",
    description: "Record an in-app notification visible on the dashboard notification center.",
    severity_min: 1,
    severity_max: 10,
    estimated_duration: "< 1 min",
    required_roles: [],
    risks: [
      "Notification fatigue if severity threshold is too low",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },

  /* ── Escalation (from handle_escalate) ────────────────────────────── */
  {
    action_key: "escalate_to_human",
    name: "Escalate to Human Review",
    description: "Pause autonomous action and hand off the decision to a named approver.",
    severity_min: 1,
    severity_max: 10,
    estimated_duration: "Depends on approver SLA",
    required_roles: ["Designated Approver"],
    risks: [
      "Delay while awaiting human response",
      "Approver may lack context the agent already has",
    ],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },

  /* ── Assessment (from handle_assess_risk) ─────────────────────────── */
  {
    action_key: "assess_risk_for_asset",
    name: "Risk Assessment Logged",
    description:
      "Record that the agent performed a per-asset risk assessment. Typically informational — no external action required, but you can wire notifications here if you want an audit trail.",
    severity_min: 1,
    severity_max: 10,
    estimated_duration: "< 1 min",
    required_roles: [],
    risks: [],
    is_enabled: true,
    is_custom: false,
    steps: [],
  },
];

export async function loadTemplates(companyId: string): Promise<ActionTemplate[]> {
  try {
    const data = await api.companies(companyId).actionTemplates.list();
    const list = Array.isArray(data) ? (data as ActionTemplate[]) : [];
    return list.length > 0 ? list : DEFAULT_TEMPLATES;
  } catch (err) {
    console.error("Failed to load action templates:", err);
    return DEFAULT_TEMPLATES;
  }
}

export async function createTemplate(
  companyId: string,
  template: ActionTemplate
): Promise<ActionTemplate> {
  return (await api.companies(companyId).actionTemplates.create({
    action_key: template.action_key,
    name: template.name,
    description: template.description,
    severity_min: template.severity_min,
    severity_max: template.severity_max,
    estimated_duration: template.estimated_duration,
    required_roles: template.required_roles,
    risks: template.risks,
    is_enabled: template.is_enabled,
    is_custom: template.is_custom ?? true,
    steps: template.steps,
  })) as ActionTemplate;
}

export async function updateTemplate(
  companyId: string,
  templateId: string,
  patch: Partial<ActionTemplate>
): Promise<ActionTemplate> {
  return (await api
    .companies(companyId)
    .actionTemplates.update(templateId, patch)) as ActionTemplate;
}

export async function deleteTemplate(companyId: string, templateId: string): Promise<void> {
  await api.companies(companyId).actionTemplates.delete(templateId);
}

/** Replace the stored templates for this company with DEFAULT_TEMPLATES. */
export async function resetTemplates(companyId: string): Promise<ActionTemplate[]> {
  const existing = await loadTemplates(companyId);
  for (const t of existing) {
    if (t.id) {
      try {
        await deleteTemplate(companyId, t.id);
      } catch (err) {
        console.error("Failed to delete template during reset:", err);
      }
    }
  }
  const created: ActionTemplate[] = [];
  for (const tpl of DEFAULT_TEMPLATES) {
    try {
      created.push(await createTemplate(companyId, tpl));
    } catch (err) {
      console.error("Failed to seed default template:", err);
    }
  }
  return created;
}

/**
 * Insert any DEFAULT_TEMPLATES whose action_key is missing from the stored set.
 * Non-destructive: existing templates (including customized defaults) are left
 * untouched. Returns the new full list.
 */
export async function seedMissingDefaults(companyId: string): Promise<ActionTemplate[]> {
  const existing = await loadTemplates(companyId);
  const existingKeys = new Set(existing.map((t) => t.action_key));
  const toCreate = DEFAULT_TEMPLATES.filter((d) => !existingKeys.has(d.action_key));
  for (const tpl of toCreate) {
    try {
      await createTemplate(companyId, tpl);
    } catch (err) {
      console.error(`Failed to seed default template ${tpl.action_key}:`, err);
    }
  }
  return await loadTemplates(companyId);
}

export function findTemplateForAction(
  action: string,
  templates: ActionTemplate[]
): ActionTemplate | null {
  return templates.find((t) => t.action_key === action && t.is_enabled) ?? null;
}
