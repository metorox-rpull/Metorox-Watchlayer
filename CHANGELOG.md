# Changelog

All notable changes to WatchLayer are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [v23] — 2026-06-12

### Added
- **Zapier & Make Integration** — New Integrations tab in Settings with a complete guide for connecting WatchLayer to Zapier and Make (Integromat). Includes six pre-built automation templates covering incident alerts, Slack messages, Google Sheets logging, PagerDuty escalation, weekly digests, and daily status reports. Full trigger reference with sample payloads for `monitor.down`, `monitor.up`, and `incident.created` events.

---

## [v22] — 2026-06

### Added
- **GitHub Dev Branch Push** — Codebase synced to GitHub development branch for version control and collaborative development.

---

## [v21] — 2026-06

### Added
- **Public API** — External REST API via Convex HTTP Actions, enabling programmatic access to monitors and incidents from external systems and scripts.
- **API Key Management** — Generate, view, and revoke API keys from the Settings → Integrations tab.

---

## [v20] — 2026-06

### Added
- **Client Reports** — Shareable, password-protected performance reports for clients. Reports include uptime percentages, incident counts, response time trends, and SLA compliance over a configurable date range.
- **Report Token Authentication** — Secure access to client reports via unique signed tokens.

---

## [v19] — 2026-06

### Added
- **AI Postmortems** — Automatically generate structured incident postmortems using OpenAI. Postmortems include a root cause analysis, impact summary, contributing factors, and follow-up action items.
- **Postmortem Editing** — Edit generated postmortems before sharing with the team.

---

## [v18] — 2026-06

### Added
- **SLA Tracking** — Define uptime SLA targets per monitor and track compliance over time. Dashboard widget shows current SLA health with a pass/fail indicator.
- **SLA History** — Historical SLA compliance data with trend visualization.

---

## [v17] — 2026-06

### Added
- **Weekly Digest Emails** — Automated weekly email summaries of workspace health sent to all team members.
- **Digest Cron Job** — Backend scheduled task for generating and dispatching weekly digest emails.

---

## [v16] — 2026-06

### Added
- **Public Status Pages** — Each workspace can publish a public status page at a custom slug (`/status/:slug`). Status pages display real-time monitor health and recent incident history.
- **Status Page Configuration** — Customize the status page title, description, and which monitors to display.

---

## [v15] — 2026-06

### Added
- **PagerDuty Integration** — Route critical incidents to PagerDuty on-call schedules. Configure routing keys per workspace in Settings → Integrations.
- **Slack Integration** — Post incident and recovery notifications to Slack channels via incoming webhooks.
- **Webhook Integration** — Send any incident event to a custom HTTP endpoint with a configurable JSON payload.

---

## [v14] — 2026-06

### Added
- **SMS Alerts** — Receive text message notifications for monitor failures and recoveries via Twilio.
- **Notification Preferences** — Per-user control over which alert channels receive which event types.

---

## [v13] — 2026-06

### Added
- **Multi-Region Monitoring** — Run monitors from multiple geographic regions simultaneously for more accurate global availability checks *(Growth+ plans)*.
- **Region Selector** — Choose monitoring regions when creating or editing monitors.

---

## [v12] — 2026-06

### Added
- **Journey Monitors** — Create multi-step synthetic browser monitors that test full user workflows (login flows, checkout funnels, form submissions, etc.).
- **Step Builder** — Visual step editor for defining journey monitor sequences.

---

## [v11] — 2026-06

### Added
- **Baseline Comparison** — Track response-time baselines per monitor and surface regressions in the monitor detail view. Alerts when response time exceeds a configurable threshold above the rolling baseline.

---

## [v10] — 2026-06

### Added
- **Incident Postmortem Templates** — Structured templates to guide postmortem writing with predefined sections.
- **Incident Timeline** — Chronological event log on incident detail pages showing status changes, comments, and notifications sent.

---

## [v9] — 2026-06

### Added
- **Monitor Detail Page** — Expanded monitor view with response-time charts, uptime history calendar, recent incident list, and alert log.
- **Uptime History** — 90-day uptime heatmap on monitor detail pages.

---

## [v8] — 2026-06

### Added
- **Incident Management** — Full incident lifecycle: automatic creation on monitor failure, manual status updates (open → investigating → resolved), commenting, and auto-resolution on monitor recovery.
- **Incident Detail Page** — Dedicated page with timeline, comments, and resolution tagging.

---

## [v7] — 2026-06

### Added
- **Alerting System** — Email alert delivery for monitor down/up events with configurable notification channels per workspace.
- **Alert Log** — History of all alerts sent, accessible per monitor and per incident.

---

## [v6] — 2026-06

### Added
- **Billing & Plans** — Starter, Growth, and Agency Lite plans powered by Hercules Commerce. Plan enforcement for monitor quotas, check intervals, team member limits, and premium features.
- **7-Day Free Trial** — New workspaces start with a full-featured trial period.
- **Trial Banner** — Persistent banner showing days remaining in the trial with an upgrade CTA.

---

## [v5] — 2026-06

### Added
- **Team & Workspace Management** — Invite teammates via email, manage roles (owner / member), and remove members from Settings → Team.
- **Accept Invite Flow** — Token-based invite acceptance page (`/invite/:token`).

---

## [v4] — 2026-06

### Added
- **Page Monitors** — Create HTTP/HTTPS monitors with configurable check intervals (1–60 min), expected status codes, and optional keyword assertions.
- **Monitor Runner** — Backend scheduled execution engine that runs checks and records results.

---

## [v3] — 2026-06

### Added
- **Dashboard** — Workspace overview with at-a-glance stats: total monitors, monitors down, open incidents, and average uptime.
- **Reports Page** — Analytics views with uptime trends and response-time charts powered by Recharts.

---

## [v2] — 2026-06

### Added
- **Onboarding Flow** — Guided workspace creation wizard for new users.
- **Multi-Tenant Workspaces** — Each user can create and belong to multiple workspaces, each with isolated monitors, incidents, and settings.

---

## [v1] — 2026-06

### Added
- Initial project scaffolding with Vite, React 19, Tailwind CSS 4, Convex backend, and Hercules Auth.
- App shell with sidebar navigation, theme (light/dark), and routing.
