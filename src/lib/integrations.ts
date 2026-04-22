/**
 * Integration catalog.
 *
 * Every endpoint, URL pattern, auth mechanism, and field name in this file
 * reflects the provider's published API documentation. Nothing is invented.
 *
 * When wiring a backend executor, the `endpoint` on each capability is the
 * authoritative source: method + path (relative to `baseUrl` or
 * `baseUrlFrom`). The `authMode` declares how credentials should be turned
 * into an Authorization header (or URL). The `testEndpoint` is what a
 * "connection test" should call to validate credentials without side effects
 * where possible.
 *
 * Per-provider documentation is linked inline via `docsUrl` on the integration
 * spec and on each endpoint.
 */

import type { LucideIcon } from "lucide-react";
import {
  MessageSquare, Mail, Ticket, Webhook, Bell, Users,
  Shield, MessageCircle, Briefcase, Cloud, CloudCog,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────── */

export type IntegrationCategory =
  | "messaging"
  | "email"
  | "ticketing"
  | "incident"
  | "crm"
  | "identity"
  | "cloud"
  | "webhook";

export type FieldType =
  | "text"
  | "password"
  | "url"
  | "email"
  | "select"
  | "textarea";

export type AuthMode =
  /** The full URL contains the auth secret. Body is POSTed to the URL. */
  | "webhook_url"
  /** Authorization: Bearer <token>. Used by SendGrid, Slack Web API, Azure (after token exchange). */
  | "bearer_token"
  /** Authorization: Basic base64(user:pass). Used by ServiceNow, Jira Cloud. */
  | "basic_auth"
  /** Authorization: SSWS <api_token>. Okta's non-OAuth token scheme. */
  | "okta_sswS"
  /** Authorization: Token token=<api_key>. PagerDuty REST API v2 scheme. */
  | "pagerduty_token"
  /** Routing key embedded in POST body. PagerDuty Events API v2 scheme. */
  | "pagerduty_routing_key"
  /** SMTP handshake with STARTTLS / SSL. */
  | "smtp"
  /** OAuth 2.0 Client Credentials Grant (RFC 6749 §4.4). */
  | "oauth_client_credentials"
  /** OAuth 2.0 Resource Owner Password Grant (RFC 6749 §4.3). Legacy; Salesforce. */
  | "oauth_password_grant"
  /** AWS Signature Version 4 signed request. */
  | "aws_sigv4"
  /** Azure AD client credentials flow against /oauth2/v2.0/token. */
  | "azure_ad_client_credentials";

export interface IntegrationField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  secret?: boolean;
  options?: { value: string; label: string }[];
  pattern?: string;
  default?: string;
}

export interface EndpointSpec {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to baseUrl / baseUrlFrom value. Use {{field_key}} or {{param}} for substitutions. */
  path: string;
  /** Absolute override. Used when the path is not under the integration's primary baseUrl (e.g. AWS STS from an AWS SNS integration). */
  absoluteUrl?: string;
  /** Link to the provider's doc for this specific endpoint. */
  docsUrl: string;
  /** Short human note on what this does. */
  description?: string;
}

export interface IntegrationCapability {
  action: string;
  label: string;
  description: string;
  endpoint: EndpointSpec;
}

export interface IntegrationSpec {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  icon: LucideIcon;
  color: string;
  /** Top-level provider docs URL. */
  docsUrl: string;
  authMode: AuthMode;
  /**
   * Human-readable description of the auth header / URL pattern, shown in the UI
   * so users understand how their credentials will be used. Use {{field}} tokens
   * that match field keys — the UI can preview with obfuscation.
   */
  authPreview: string;
  /** Static base URL if fixed for this integration. */
  baseUrl?: string;
  /** Field key whose value is the base URL (e.g., 'instance_url' for ServiceNow). */
  baseUrlFrom?: string;
  fields: IntegrationField[];
  capabilities: IntegrationCapability[];
  /** Endpoint called to validate credentials. Should be idempotent / side-effect-free where possible. */
  testEndpoint?: EndpointSpec;
  /** Additional notes shown in the UI (e.g., deprecation warnings, setup guidance). */
  notes?: string;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  messaging: "Messaging",
  email: "Email",
  ticketing: "Ticketing",
  incident: "Incident Response",
  crm: "CRM",
  identity: "Identity & Access",
  cloud: "Cloud",
  webhook: "Generic",
};

/* ── Integrations ───────────────────────────────────────── */

export const INTEGRATIONS: IntegrationSpec[] = [
  /* ─────────────────────────────────────────────────────────
   * Slack — Incoming Webhooks
   * Docs: https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/
   * Note: Incoming Webhooks accept POST to the webhook URL. There is no
   * side-effect-free validation endpoint — "test" would POST a message.
   * ─────────────────────────────────────────────────────── */
  {
    id: "slack",
    name: "Slack",
    category: "messaging",
    description: "Post messages to Slack channels using an Incoming Webhook URL.",
    icon: MessageSquare,
    color: "text-[#4A154B]",
    docsUrl: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/",
    authMode: "webhook_url",
    authPreview: "POST {{webhook_url}}  (no Authorization header — secret is in the URL)",
    baseUrlFrom: "webhook_url",
    notes:
      "Incoming Webhooks have no side-effect-free test endpoint. Testing this connection posts a minimal verification message to the channel.",
    fields: [
      {
        key: "webhook_url",
        label: "Incoming Webhook URL",
        type: "password",
        placeholder: "https://hooks.slack.com/services/T…/B…/…",
        helpText: "Create at api.slack.com/apps → Your App → Incoming Webhooks.",
        required: true,
        secret: true,
        pattern: "^https://hooks\\.slack\\.com/services/[A-Z0-9]+/[A-Z0-9]+/[A-Za-z0-9]+$",
      },
      {
        key: "default_channel",
        label: "Default Channel (informational)",
        type: "text",
        placeholder: "#tprm-alerts",
        helpText:
          "The channel is determined by the webhook itself and cannot be overridden in the payload. This field is for your reference only.",
      },
    ],
    capabilities: [
      {
        action: "post_message",
        label: "Post Message",
        description: "Send a Block Kit message to the webhook's channel.",
        endpoint: {
          method: "POST",
          path: "",
          docsUrl: "https://docs.slack.dev/reference/block-kit/",
          description: "POST with body: { text: string, blocks?: Block[] }",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "",
      docsUrl: "https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/",
      description: "POST { text: 'TPRM connection test' } to the webhook URL. Slack returns 200 'ok' on success.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Microsoft Teams — Workflows (Power Automate) Webhook
   * Docs: https://support.microsoft.com/en-us/office/post-a-workflow-when-a-webhook-request-is-received-in-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498
   * Note: Office 365 Connector webhooks (outlook.office.com/webhook/…)
   * are DEPRECATED (retirement 2025-12-31). This integration targets the
   * replacement: Workflows-created webhooks hosted on Azure Logic Apps.
   * For programmatic channel posting with richer features, see Graph API
   * (not wired here): POST /v1.0/teams/{team-id}/channels/{channel-id}/messages
   * ─────────────────────────────────────────────────────── */
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "messaging",
    description:
      "Post Adaptive Cards to Teams channels via a Workflows webhook (the non-deprecated replacement for Office 365 Connectors).",
    icon: Users,
    color: "text-[#464EB8]",
    docsUrl:
      "https://support.microsoft.com/en-us/office/post-a-workflow-when-a-webhook-request-is-received-in-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498",
    authMode: "webhook_url",
    authPreview: "POST {{webhook_url}}  (URL contains the SAS signature)",
    baseUrlFrom: "webhook_url",
    notes:
      "Create this webhook in Teams: Channel → Workflows → 'Post to channel when a webhook request is received'. The resulting URL is hosted on Azure Logic Apps (prod-*.logic.azure.com).",
    fields: [
      {
        key: "webhook_url",
        label: "Workflows Webhook URL",
        type: "password",
        placeholder: "https://prod-XX.REGION.logic.azure.com:443/workflows/…?…&sig=…",
        helpText: "URL from the 'Post to channel when a webhook request is received' workflow template.",
        required: true,
        secret: true,
        pattern: "^https://.+\\.logic\\.azure\\.com(:443)?/workflows/.+",
      },
    ],
    capabilities: [
      {
        action: "post_adaptive_card",
        label: "Post Adaptive Card",
        description: "Send an Adaptive Card 1.4+ payload to the channel.",
        endpoint: {
          method: "POST",
          path: "",
          docsUrl: "https://adaptivecards.io/explorer/",
          description:
            "POST Adaptive Card payload: { type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: {...} }] }",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "",
      docsUrl:
        "https://support.microsoft.com/en-us/office/post-a-workflow-when-a-webhook-request-is-received-in-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498",
      description:
        "POST a minimal Adaptive Card payload. Azure Logic Apps returns 202 Accepted when the workflow is triggered.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * SendGrid Email — v3 API
   * Docs: https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send
   * ─────────────────────────────────────────────────────── */
  {
    id: "sendgrid",
    name: "SendGrid Email",
    category: "email",
    description: "Send transactional email via SendGrid's v3 Mail Send API.",
    icon: Mail,
    color: "text-[#1A82E2]",
    docsUrl: "https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send",
    authMode: "bearer_token",
    authPreview: "Authorization: Bearer {{api_key}}",
    baseUrl: "https://api.sendgrid.com",
    fields: [
      {
        key: "api_key",
        label: "API Key",
        type: "password",
        placeholder: "SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        required: true,
        secret: true,
        helpText:
          "Create at app.sendgrid.com/settings/api_keys. Must have 'Mail Send' permission.",
      },
      {
        key: "from_email",
        label: "From Email",
        type: "email",
        placeholder: "alerts@yourcompany.com",
        required: true,
        helpText:
          "Must be a verified Sender Identity (app.sendgrid.com/settings/sender_auth).",
      },
      {
        key: "from_name",
        label: "From Name",
        type: "text",
        placeholder: "TPRM Alerts",
        default: "TPRM Alerts",
      },
    ],
    capabilities: [
      {
        action: "send_email",
        label: "Send Email",
        description: "Send an email via /v3/mail/send.",
        endpoint: {
          method: "POST",
          path: "/v3/mail/send",
          docsUrl: "https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send",
          description:
            "POST with body: { personalizations: [{ to: [...] }], from, subject, content: [{ type, value }] }. Returns 202 Accepted.",
        },
      },
    ],
    testEndpoint: {
      method: "GET",
      path: "/v3/scopes",
      docsUrl: "https://www.twilio.com/docs/sendgrid/api-reference/api-key-permissions/retrieve-a-list-of-scopes-for-which-this-user-has-access",
      description: "GET /v3/scopes returns the permissions granted to the API key.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * SMTP Email — RFC 5321 / RFC 3207 (STARTTLS)
   * ─────────────────────────────────────────────────────── */
  {
    id: "smtp",
    name: "SMTP Email",
    category: "email",
    description: "Send email through any SMTP relay. Supports STARTTLS (RFC 3207) and implicit TLS (port 465).",
    icon: Mail,
    color: "text-slate-400",
    docsUrl: "https://datatracker.ietf.org/doc/html/rfc5321",
    authMode: "smtp",
    authPreview: "SMTP AUTH PLAIN / LOGIN with {{username}} + password over TLS",
    fields: [
      { key: "host", label: "SMTP Host", type: "text", placeholder: "smtp.example.com", required: true },
      { key: "port", label: "SMTP Port", type: "text", placeholder: "587", required: true, default: "587" },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true, secret: true },
      {
        key: "encryption",
        label: "Encryption",
        type: "select",
        default: "starttls",
        options: [
          { value: "starttls", label: "STARTTLS (port 587, recommended)" },
          { value: "ssl", label: "Implicit TLS / SSL (port 465)" },
          { value: "none", label: "None (cleartext — not recommended)" },
        ],
      },
      { key: "from_email", label: "From Email", type: "email", required: true },
    ],
    capabilities: [
      {
        action: "send_email",
        label: "Send Email",
        description: "Submit a message via the SMTP MAIL FROM / RCPT TO / DATA sequence.",
        endpoint: {
          method: "POST",
          path: "",
          docsUrl: "https://datatracker.ietf.org/doc/html/rfc5321#section-3.3",
          description: "RFC 5321 mail transaction. Not an HTTP call — TLS-wrapped SMTP session.",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "",
      docsUrl: "https://datatracker.ietf.org/doc/html/rfc5321#section-4.1.1.1",
      description: "EHLO + AUTH handshake, then QUIT without sending a message.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * ServiceNow — Table API (Yokohama)
   * Docs: https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html
   * ─────────────────────────────────────────────────────── */
  {
    id: "servicenow",
    name: "ServiceNow",
    category: "ticketing",
    description: "Create and update incidents / change requests via the ServiceNow Table API.",
    icon: Ticket,
    color: "text-[#81B5A1]",
    docsUrl:
      "https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html",
    authMode: "basic_auth",
    authPreview: "Authorization: Basic base64({{username}}:{{password}})",
    baseUrlFrom: "instance_url",
    fields: [
      {
        key: "instance_url",
        label: "Instance URL",
        type: "url",
        placeholder: "https://myco.service-now.com",
        required: true,
        pattern: "^https://[a-z0-9-]+\\.service-now\\.com/?$",
        helpText: "Your ServiceNow instance base URL, e.g. https://myco.service-now.com.",
      },
      { key: "username", label: "Username", type: "text", required: true },
      { key: "password", label: "Password", type: "password", required: true, secret: true },
      {
        key: "default_assignment_group",
        label: "Default Assignment Group (informational)",
        type: "text",
        placeholder: "TPRM",
        helpText:
          "Populate the incident's assignment_group field when opening tickets. Stored for reference.",
      },
    ],
    capabilities: [
      {
        action: "create_incident",
        label: "Create Incident",
        description: "Open an INC record in the incident table.",
        endpoint: {
          method: "POST",
          path: "/api/now/table/incident",
          docsUrl:
            "https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html",
          description:
            "POST with body: { short_description, description, urgency, impact, assignment_group }.",
        },
      },
      {
        action: "update_incident",
        label: "Update Incident",
        description: "Patch an existing incident (work notes, state, etc.).",
        endpoint: {
          method: "PATCH",
          path: "/api/now/table/incident/{{sys_id}}",
          docsUrl:
            "https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html",
        },
      },
      {
        action: "create_change_request",
        label: "Create Change Request",
        description: "Open a CHG record for a coordinated mitigation.",
        endpoint: {
          method: "POST",
          path: "/api/now/table/change_request",
          docsUrl:
            "https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html",
        },
      },
    ],
    testEndpoint: {
      method: "GET",
      path: "/api/now/table/sys_user?sysparm_limit=1",
      docsUrl:
        "https://www.servicenow.com/docs/bundle/yokohama-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html",
      description: "Read one row from sys_user. Validates auth + instance reachability.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Jira Cloud — REST API v3
   * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/
   * ─────────────────────────────────────────────────────── */
  {
    id: "jira",
    name: "Jira Cloud",
    category: "ticketing",
    description: "Create and comment on Jira issues via REST API v3.",
    icon: Briefcase,
    color: "text-[#0052CC]",
    docsUrl: "https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/",
    authMode: "basic_auth",
    authPreview: "Authorization: Basic base64({{email}}:{{api_token}})",
    baseUrlFrom: "site_url",
    fields: [
      {
        key: "site_url",
        label: "Site URL",
        type: "url",
        placeholder: "https://yourco.atlassian.net",
        required: true,
        pattern: "^https://[a-z0-9-]+\\.atlassian\\.net/?$",
      },
      {
        key: "email",
        label: "Account Email",
        type: "email",
        required: true,
        helpText: "The email of the Atlassian account that owns the API token.",
      },
      {
        key: "api_token",
        label: "API Token",
        type: "password",
        required: true,
        secret: true,
        helpText: "Create at id.atlassian.com/manage-profile/security/api-tokens.",
      },
      {
        key: "default_project_key",
        label: "Default Project Key",
        type: "text",
        placeholder: "TPRM",
        required: true,
      },
      {
        key: "default_issue_type",
        label: "Default Issue Type",
        type: "text",
        placeholder: "Task",
        default: "Task",
      },
    ],
    capabilities: [
      {
        action: "create_issue",
        label: "Create Issue",
        description: "Open a Jira issue.",
        endpoint: {
          method: "POST",
          path: "/rest/api/3/issue",
          docsUrl:
            "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post",
          description:
            "POST with body: { fields: { project: { key }, issuetype: { name }, summary, description (ADF) } }.",
        },
      },
      {
        action: "add_comment",
        label: "Add Comment",
        description: "Append a comment to an existing issue.",
        endpoint: {
          method: "POST",
          path: "/rest/api/3/issue/{{issueIdOrKey}}/comment",
          docsUrl:
            "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-comments/#api-rest-api-3-issue-issueidorkey-comment-post",
        },
      },
      {
        action: "transition_issue",
        label: "Transition Issue",
        description: "Move an issue through its workflow.",
        endpoint: {
          method: "POST",
          path: "/rest/api/3/issue/{{issueIdOrKey}}/transitions",
          docsUrl:
            "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-transitions-post",
        },
      },
    ],
    testEndpoint: {
      method: "GET",
      path: "/rest/api/3/myself",
      docsUrl:
        "https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-myself/#api-rest-api-3-myself-get",
      description: "Returns the current user. Validates auth.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * PagerDuty — Events API v2
   * Docs: https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event
   * Note: For READING/MANAGING incidents, the separate REST API v2 is at
   * api.pagerduty.com and uses "Authorization: Token token=...". This
   * integration targets Events API v2 only; a separate PagerDuty REST entry
   * could be added if managing existing incidents is required.
   * ─────────────────────────────────────────────────────── */
  {
    id: "pagerduty",
    name: "PagerDuty Events",
    category: "incident",
    description: "Trigger, acknowledge, and resolve incidents via the PagerDuty Events API v2.",
    icon: Bell,
    color: "text-[#06AC38]",
    docsUrl: "https://developer.pagerduty.com/docs/ZG9jOjExMDI5NTgw-events-api-v2-overview",
    authMode: "pagerduty_routing_key",
    authPreview: "POST body includes routing_key: {{integration_key}}  (no Authorization header)",
    baseUrl: "https://events.pagerduty.com",
    notes:
      "Events API v2 has no idempotent test endpoint. The 'test' here sends an event with event_action='resolve' and a unique dedup_key that will not create a visible incident.",
    fields: [
      {
        key: "integration_key",
        label: "Integration Key (Routing Key)",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "On the target PagerDuty service, add an 'Events API v2' integration and copy its Integration Key.",
        pattern: "^[A-Za-z0-9]{32}$",
      },
      {
        key: "default_severity",
        label: "Default Severity",
        type: "select",
        default: "warning",
        options: [
          { value: "info", label: "Info" },
          { value: "warning", label: "Warning" },
          { value: "error", label: "Error" },
          { value: "critical", label: "Critical" },
        ],
      },
    ],
    capabilities: [
      {
        action: "trigger_event",
        label: "Trigger Event",
        description: "Create a new alert on the target service.",
        endpoint: {
          method: "POST",
          path: "/v2/enqueue",
          docsUrl: "https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event",
          description:
            "POST with body: { routing_key, event_action: 'trigger', dedup_key?, payload: { summary, severity, source, timestamp? } }. Returns 202 Accepted.",
        },
      },
      {
        action: "resolve_event",
        label: "Resolve Event",
        description: "Resolve an alert previously triggered with the same dedup_key.",
        endpoint: {
          method: "POST",
          path: "/v2/enqueue",
          docsUrl: "https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event",
          description: "POST with body: { routing_key, event_action: 'resolve', dedup_key }.",
        },
      },
      {
        action: "acknowledge_event",
        label: "Acknowledge Event",
        description: "Acknowledge an open alert.",
        endpoint: {
          method: "POST",
          path: "/v2/enqueue",
          docsUrl: "https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event",
          description: "POST with body: { routing_key, event_action: 'acknowledge', dedup_key }.",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "/v2/enqueue",
      docsUrl: "https://developer.pagerduty.com/api-reference/368ae3d938c9e-send-an-event",
      description:
        "POST event_action='resolve' with a unique dedup_key that has no prior 'trigger'. PagerDuty returns 202 Accepted but no visible incident is created.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Salesforce — REST API
   * Docs: https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/
   * Note: This spec uses the OAuth 2.0 Username-Password Grant (legacy).
   * Salesforce recommends Client Credentials Flow or JWT Bearer Flow for
   * server-to-server integrations. The UI below flags this.
   * Client Credentials: https://help.salesforce.com/s/articleView?id=sales.connected_app_client_credentials_flow.htm
   * JWT Bearer: https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_jwt_flow.htm
   * ─────────────────────────────────────────────────────── */
  {
    id: "salesforce",
    name: "Salesforce",
    category: "crm",
    description: "Create Cases and update records via Salesforce REST API (v59.0).",
    icon: MessageCircle,
    color: "text-[#00A1E0]",
    docsUrl: "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/",
    authMode: "oauth_password_grant",
    authPreview:
      "POST {{instance_url}}/services/oauth2/token (grant_type=password) → Authorization: Bearer <access_token>",
    baseUrlFrom: "instance_url",
    notes:
      "This is the Username-Password OAuth flow (legacy). For new Connected Apps, Salesforce recommends the Client Credentials Flow or JWT Bearer Flow. See help.salesforce.com for the modern flows.",
    fields: [
      {
        key: "instance_url",
        label: "Instance URL",
        type: "url",
        placeholder: "https://yourco.my.salesforce.com",
        required: true,
        pattern: "^https://[a-z0-9-]+(\\.[a-z0-9-]+)*\\.(my\\.salesforce\\.com|salesforce\\.com)/?$",
        helpText: "Your Salesforce 'My Domain' URL.",
      },
      {
        key: "client_id",
        label: "Consumer Key",
        type: "text",
        required: true,
        secret: true,
        helpText: "From the Connected App's 'Manage Consumer Details'.",
      },
      {
        key: "client_secret",
        label: "Consumer Secret",
        type: "password",
        required: true,
        secret: true,
      },
      { key: "username", label: "Username", type: "email", required: true },
      {
        key: "password",
        label: "Password + Security Token",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Concatenate the user's password with the security token emailed by Salesforce (no separator).",
      },
    ],
    capabilities: [
      {
        action: "create_case",
        label: "Create Case",
        description: "Create a new Case record.",
        endpoint: {
          method: "POST",
          path: "/services/data/v59.0/sobjects/Case/",
          docsUrl:
            "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_sobject_create.htm",
          description:
            "POST with body: { Subject, Description, Priority, Status, AccountId? }. Returns { id, success, errors }.",
        },
      },
      {
        action: "update_account",
        label: "Update Account",
        description: "Patch an Account record.",
        endpoint: {
          method: "PATCH",
          path: "/services/data/v59.0/sobjects/Account/{{id}}",
          docsUrl:
            "https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/dome_update_fields.htm",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "/services/oauth2/token",
      docsUrl:
        "https://help.salesforce.com/s/articleView?id=sf.remoteaccess_oauth_username_password_flow.htm",
      description:
        "Request an access token. Body: grant_type=password&client_id&client_secret&username&password. Success returns { access_token, instance_url, ... }.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Okta — Core Management API
   * Docs: https://developer.okta.com/docs/api/
   * Auth: Okta's non-OAuth API tokens use the "SSWS" scheme.
   * ─────────────────────────────────────────────────────── */
  {
    id: "okta",
    name: "Okta",
    category: "identity",
    description: "Suspend users, revoke sessions, or change group membership during active threats.",
    icon: Shield,
    color: "text-[#007DC1]",
    docsUrl: "https://developer.okta.com/docs/api/",
    authMode: "okta_sswS",
    authPreview: "Authorization: SSWS {{api_token}}",
    baseUrlFrom: "org_url",
    fields: [
      {
        key: "org_url",
        label: "Org URL",
        type: "url",
        placeholder: "https://yourco.okta.com",
        required: true,
        pattern: "^https://[a-z0-9-]+\\.okta(preview|-emea)?\\.com/?$",
      },
      {
        key: "api_token",
        label: "API Token",
        type: "password",
        required: true,
        secret: true,
        helpText:
          "Create at Okta Admin → Security → API → Tokens. Requires a role with user / group management permissions.",
      },
    ],
    capabilities: [
      {
        action: "suspend_user",
        label: "Suspend User",
        description: "Temporarily disable a user account (reversible).",
        endpoint: {
          method: "POST",
          path: "/api/v1/users/{{userId}}/lifecycle/suspend",
          docsUrl:
            "https://developer.okta.com/docs/api/openapi/okta-management/management/tag/UserLifecycle/#tag/UserLifecycle/operation/suspendUser",
          description: "POST with empty body. User sessions are invalidated; credentials remain intact.",
        },
      },
      {
        action: "revoke_sessions",
        label: "Revoke User Sessions",
        description: "Force a user to re-authenticate everywhere.",
        endpoint: {
          method: "DELETE",
          path: "/api/v1/users/{{userId}}/sessions",
          docsUrl:
            "https://developer.okta.com/docs/api/openapi/okta-management/management/tag/User/#tag/User/operation/revokeUserSessions",
          description:
            "Query string ?oauthTokens=true also revokes OAuth refresh/access tokens.",
        },
      },
      {
        action: "add_to_group",
        label: "Add User to Group",
        description: "Move a user into a group (e.g. 'High-Risk Review').",
        endpoint: {
          method: "PUT",
          path: "/api/v1/groups/{{groupId}}/users/{{userId}}",
          docsUrl:
            "https://developer.okta.com/docs/api/openapi/okta-management/management/tag/Group/#tag/Group/operation/assignUserToGroup",
        },
      },
    ],
    testEndpoint: {
      method: "GET",
      path: "/api/v1/users?limit=1",
      docsUrl:
        "https://developer.okta.com/docs/api/openapi/okta-management/management/tag/User/#tag/User/operation/listUsers",
      description: "List one user. Validates org URL + API token.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * AWS Actions — SNS + STS
   * Docs: https://docs.aws.amazon.com/
   * Auth: AWS Signature Version 4.
   * This integration is for DISPATCHING actions (publish to SNS topics,
   * change Route53 records). Asset discovery/sync uses the separate Cloud
   * Connectors page.
   * ─────────────────────────────────────────────────────── */
  {
    id: "aws",
    name: "AWS (Actions)",
    category: "cloud",
    description:
      "Dispatch actions via AWS SNS, Route53, and related services. Requests are signed with AWS Signature Version 4.",
    icon: Cloud,
    color: "text-[#FF9900]",
    docsUrl: "https://docs.aws.amazon.com/",
    authMode: "aws_sigv4",
    authPreview:
      "Authorization: AWS4-HMAC-SHA256 Credential={{access_key_id}}/…, SignedHeaders=…, Signature=…",
    fields: [
      {
        key: "access_key_id",
        label: "Access Key ID",
        type: "text",
        required: true,
        placeholder: "AKIAXXXXXXXXXXXXXXXX",
        pattern: "^(AKIA|ASIA)[A-Z0-9]{16}$",
        helpText: "Use an IAM user or STS-assumed role with least-privilege permissions.",
      },
      {
        key: "secret_access_key",
        label: "Secret Access Key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "session_token",
        label: "Session Token (optional)",
        type: "password",
        secret: true,
        helpText: "Required only for temporary STS credentials (access key starts with ASIA).",
      },
      {
        key: "region",
        label: "Default Region",
        type: "text",
        required: true,
        default: "us-east-1",
        placeholder: "us-east-1",
        pattern: "^[a-z]{2}-[a-z]+-\\d+$",
      },
    ],
    capabilities: [
      {
        action: "sns_publish",
        label: "SNS — Publish",
        description: "Publish a message to an SNS topic (email/SMS fan-out, Lambda triggers).",
        endpoint: {
          method: "POST",
          path: "/",
          absoluteUrl: "https://sns.{{region}}.amazonaws.com/",
          docsUrl: "https://docs.aws.amazon.com/sns/latest/api/API_Publish.html",
          description:
            "Query action Action=Publish&TopicArn=…&Message=… form-encoded, SigV4-signed.",
        },
      },
      {
        action: "route53_change_rrset",
        label: "Route 53 — Change Record Set",
        description: "Update DNS records (e.g., traffic reroute during a regional disruption).",
        endpoint: {
          method: "POST",
          path: "/2013-04-01/hostedzone/{{hostedZoneId}}/rrset",
          absoluteUrl: "https://route53.amazonaws.com/2013-04-01/hostedzone/{{hostedZoneId}}/rrset",
          docsUrl:
            "https://docs.aws.amazon.com/Route53/latest/APIReference/API_ChangeResourceRecordSets.html",
          description: "POST ChangeResourceRecordSetsRequest XML.",
        },
      },
      {
        action: "lambda_invoke",
        label: "Lambda — Invoke Function",
        description: "Run an arbitrary Lambda function with a JSON payload.",
        endpoint: {
          method: "POST",
          path: "/2015-03-31/functions/{{functionName}}/invocations",
          absoluteUrl:
            "https://lambda.{{region}}.amazonaws.com/2015-03-31/functions/{{functionName}}/invocations",
          docsUrl: "https://docs.aws.amazon.com/lambda/latest/api/API_Invoke.html",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "/",
      absoluteUrl: "https://sts.amazonaws.com/",
      docsUrl: "https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html",
      description:
        "POST Action=GetCallerIdentity&Version=2011-06-15 form-encoded, SigV4-signed. Returns the account ID and ARN of the signing identity.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Azure Actions — AD Client Credentials + Logic Apps
   * Docs: https://learn.microsoft.com/en-us/rest/api/azure/
   * Auth: Azure AD client credentials flow against Microsoft identity platform.
   * ─────────────────────────────────────────────────────── */
  {
    id: "azure",
    name: "Azure (Actions)",
    category: "cloud",
    description:
      "Dispatch actions via Azure services using an Azure AD Service Principal (client credentials flow).",
    icon: CloudCog,
    color: "text-[#0078D4]",
    docsUrl: "https://learn.microsoft.com/en-us/rest/api/azure/",
    authMode: "azure_ad_client_credentials",
    authPreview:
      "POST https://login.microsoftonline.com/{{tenant_id}}/oauth2/v2.0/token  →  Authorization: Bearer <access_token>",
    fields: [
      {
        key: "tenant_id",
        label: "Tenant ID (Directory ID)",
        type: "text",
        required: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
        pattern: "^[0-9a-fA-F-]{36}$",
      },
      {
        key: "client_id",
        label: "Application (Client) ID",
        type: "text",
        required: true,
        placeholder: "00000000-0000-0000-0000-000000000000",
        pattern: "^[0-9a-fA-F-]{36}$",
      },
      {
        key: "client_secret",
        label: "Client Secret",
        type: "password",
        required: true,
        secret: true,
        helpText: "From Azure Portal → App registrations → Certificates & secrets.",
      },
      {
        key: "subscription_id",
        label: "Subscription ID (optional)",
        type: "text",
        placeholder: "00000000-0000-0000-0000-000000000000",
        pattern: "^[0-9a-fA-F-]{36}$",
        helpText: "Required for subscription-scoped actions (Monitor, Resource Manager).",
      },
    ],
    capabilities: [
      {
        action: "logic_app_trigger",
        label: "Logic App — Trigger Workflow",
        description: "Invoke a Logic App HTTP trigger (SAS-signed URL).",
        endpoint: {
          method: "POST",
          path: "",
          absoluteUrl: "{{logic_app_url}}",
          docsUrl:
            "https://learn.microsoft.com/en-us/azure/logic-apps/logic-apps-http-endpoint",
          description: "POST a JSON body to the Logic App's HTTP-trigger URL.",
        },
      },
      {
        action: "monitor_create_alert",
        label: "Monitor — Create Alert",
        description: "Create an Azure Monitor activity log or metric alert rule.",
        endpoint: {
          method: "PUT",
          path: "/subscriptions/{{subscription_id}}/resourceGroups/{{rg}}/providers/Microsoft.Insights/activityLogAlerts/{{ruleName}}?api-version=2020-10-01",
          absoluteUrl:
            "https://management.azure.com/subscriptions/{{subscription_id}}/resourceGroups/{{rg}}/providers/Microsoft.Insights/activityLogAlerts/{{ruleName}}?api-version=2020-10-01",
          docsUrl:
            "https://learn.microsoft.com/en-us/rest/api/monitor/activity-log-alerts/create-or-update",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "/{{tenant_id}}/oauth2/v2.0/token",
      absoluteUrl: "https://login.microsoftonline.com/{{tenant_id}}/oauth2/v2.0/token",
      docsUrl:
        "https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow",
      description:
        "POST grant_type=client_credentials&client_id&client_secret&scope=https://management.azure.com/.default. Success returns { access_token, expires_in, token_type }.",
    },
  },

  /* ─────────────────────────────────────────────────────────
   * Generic Webhook — RFC 7231 HTTP POST
   * ─────────────────────────────────────────────────────── */
  {
    id: "webhook",
    name: "Generic Webhook",
    category: "webhook",
    description: "POST JSON to an arbitrary URL. Useful for Zapier, n8n, Tines, or custom receivers.",
    icon: Webhook,
    color: "text-muted-foreground",
    docsUrl: "https://datatracker.ietf.org/doc/html/rfc7231#section-4.3.3",
    authMode: "bearer_token",
    authPreview:
      "Request headers: {{auth_header}}?  +  any headers from extra_headers.  Body: JSON.",
    baseUrlFrom: "url",
    fields: [
      {
        key: "url",
        label: "Webhook URL",
        type: "url",
        required: true,
        placeholder: "https://example.com/hooks/tprm",
      },
      {
        key: "method",
        label: "HTTP Method",
        type: "select",
        default: "POST",
        options: [
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
        ],
      },
      {
        key: "auth_header",
        label: "Authorization Header (optional)",
        type: "password",
        placeholder: "Bearer eyJhbGciOi…",
        secret: true,
        helpText: "Full header value, e.g. 'Bearer …' or 'Basic …'.",
      },
      {
        key: "extra_headers",
        label: "Extra Headers (JSON object)",
        type: "textarea",
        placeholder: '{"X-Signing-Secret": "…"}',
      },
    ],
    capabilities: [
      {
        action: "send_payload",
        label: "Send Payload",
        description: "POST or PUT a JSON body to the configured URL.",
        endpoint: {
          method: "POST",
          path: "",
          docsUrl: "https://datatracker.ietf.org/doc/html/rfc7231#section-4.3.3",
        },
      },
    ],
    testEndpoint: {
      method: "POST",
      path: "",
      docsUrl: "https://datatracker.ietf.org/doc/html/rfc7231#section-4.3.3",
      description: "POST a minimal { test: true } body. Any 2xx response is treated as success.",
    },
  },
];

export function findIntegration(id: string): IntegrationSpec | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function groupByCategory(): Record<IntegrationCategory, IntegrationSpec[]> {
  const out = {} as Record<IntegrationCategory, IntegrationSpec[]>;
  for (const spec of INTEGRATIONS) {
    (out[spec.category] ||= []).push(spec);
  }
  return out;
}

/** Resolve the baseUrl for a given connection, using either the static baseUrl
 *  or the field named in baseUrlFrom. Returns empty string if neither applies. */
export function resolveBaseUrl(
  spec: IntegrationSpec,
  credentials: Record<string, string>
): string {
  if (spec.baseUrl) return spec.baseUrl.replace(/\/$/, "");
  if (spec.baseUrlFrom) {
    const v = credentials[spec.baseUrlFrom];
    return v ? v.replace(/\/$/, "") : "";
  }
  return "";
}
