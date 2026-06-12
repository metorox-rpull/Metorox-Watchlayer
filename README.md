# WatchLayer

> Real-time website monitoring, incident management, and uptime tracking for development teams.

WatchLayer helps you monitor your websites and services, get alerted when things go wrong, manage incidents collaboratively, track SLA goals, and share professional reports with clients — all from one platform.

---

## Features

### Monitoring
- **Page Monitors** — HTTP/HTTPS checks with configurable intervals (1–60 min), keyword assertions, and expected status codes
- **Journey Monitors** — Multi-step browser workflows to test critical user flows end-to-end
- **Multi-Region Checks** — Run monitors from multiple geographic regions simultaneously *(Growth+ plans)*
- **Baseline Comparison** — Detect regressions by comparing response times against rolling baselines

### Incidents
- **Automatic Incident Creation** — Incidents open when monitors fail and auto-resolve when they recover
- **Timeline & Activity Log** — Full audit trail of status changes, comments, and updates
- **Postmortems** — AI-generated incident analysis with root cause, impact summary, and action items
- **Resolution Tagging** — Categorize incidents by root cause for trend analysis

### Alerts & Notifications
- **Email Alerts** — Immediate and digest-mode email notifications
- **SMS Alerts** — Text message alerts via Twilio
- **Slack Integration** — Post incident updates to Slack channels
- **PagerDuty Integration** — Escalate critical incidents to on-call rotations
- **Webhooks** — Push events to any HTTP endpoint
- **Zapier & Make** — Connect to 5,000+ apps via no-code automation platforms

### Reporting
- **Analytics Dashboard** — Uptime percentages, MTTR, and response-time trends
- **SLA Tracking** — Set uptime targets and track compliance over time
- **Client Reports** — Shareable, password-protected reports with custom branding
- **Weekly Digests** — Automated email summaries of monitor health

### Team & Workspace
- **Multi-tenant Workspaces** — Invite teammates and collaborate on incidents
- **Role-Based Access** — Owner and member roles with appropriate permissions
- **Public Status Pages** — Embeddable status page at a custom slug
- **Billing & Quotas** — Starter, Growth, and Agency plans with transparent limits

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4 |
| Routing | React Router v7 |
| UI Components | shadcn/ui (Radix UI primitives) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |
| Animations | Motion (Framer Motion) |
| Backend | Convex (serverless functions + database) |
| Auth | Hercules Auth (OIDC) |
| Commerce / Billing | Hercules Commerce |
| AI | OpenAI via Hercules AI Gateway |
| SMS | Twilio |
| Notifications | PagerDuty, Slack webhooks |
| Automation | Zapier, Make (Integromat) |

---

## Project Structure

```
watchlayer/
├── convex/                  # Backend functions and database schema
│   ├── schema.ts            # Database schema
│   ├── monitors.ts          # Monitor CRUD and check logic
│   ├── incidents.ts         # Incident management
│   ├── alerts.ts            # Alerting system
│   ├── integrations.ts      # Third-party integrations (Slack, PagerDuty, webhooks)
│   ├── postmortems/         # AI postmortem generation
│   ├── runner/              # Monitor execution engine
│   ├── reports.ts           # Analytics and reporting
│   ├── billing.ts           # Subscription management
│   ├── statusPages.ts       # Public status page
│   └── publicApi.ts         # External API & webhook endpoints
│
└── src/
    ├── pages/
    │   ├── app/
    │   │   ├── dashboard/   # Main workspace overview
    │   │   ├── monitors/    # Monitor list and detail views
    │   │   ├── incidents/   # Incident list and detail views
    │   │   ├── reports/     # Analytics and client reports
    │   │   ├── settings/    # Workspace, alerts, integrations, billing
    │   │   └── onboarding/  # New workspace setup
    │   ├── status/          # Public status page
    │   └── report/          # Shareable client report view
    ├── components/          # Shared UI components
    ├── hooks/               # Shared React hooks
    └── lib/                 # Utility functions
```

---

## Plans

| Feature | Starter | Growth | Agency |
|---|---|---|---|
| Monitors | 5 | 25 | 100 |
| Check interval | 5 min | 1 min | 1 min |
| Multi-region | — | ✓ | ✓ |
| Team members | 1 | 5 | Unlimited |
| Client reports | — | ✓ | ✓ |
| SLA tracking | — | ✓ | ✓ |
| Postmortems (AI) | — | ✓ | ✓ |
| SMS alerts | — | ✓ | ✓ |

---

## Getting Started (Development)

1. Clone the repository
2. Install dependencies with `pnpm install`
3. Set up Convex: `pnpm convex dev`
4. Start the dev server: `pnpm dev`
5. Open `http://localhost:5173`

### Required Secrets

Set these in the Hercules Secrets tab (or as environment variables for local development):

| Key | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for AI postmortems |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS alerts |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Twilio sender phone number |
| `HERCULES_API_KEY` | Hercules AI Gateway key (auto-provisioned) |

---

## License

Proprietary — All rights reserved.
