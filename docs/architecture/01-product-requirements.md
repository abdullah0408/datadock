# Product Requirements

## Product Goal

DataDock lets a user self-host a database console and provisioning layer without
turning the system into a cloud database platform. The default deployment should
fit on a local machine or a single VPS.

## Primary Users

- A developer running personal projects and experiments.
- A small team that wants an internal database dashboard.
- A homelab user who wants managed PostgreSQL-style convenience on their own
  server.
- A maintainer who wants database provisioning, backups, and query tooling
  without adopting Kubernetes.

## Core Scope

DataDock includes:

- First-user bootstrap owner flow.
- Workspace management.
- User, role, and database-level permissions.
- Worker registration and health monitoring.
- PostgreSQL database provisioning through Docker.
- Managed database lifecycle operations.
- Connection string generation.
- Schema browsing.
- Table browsing and editing.
- SQL editor with history and redaction.
- Manual and scheduled backups.
- Restore workflows.
- Audit logs.
- Durable jobs with worker execution logs.
- Optional permissioned agent tools for database operations.

## Final End-User Scope

A fully final production app delivered to end users must also include:

- Guided install and first-run environment checks.
- Upgrade and rollback workflow.
- Platform metadata backup and restore.
- Worker diagnostics and re-registration flow.
- PostgreSQL health dashboard with storage, connections, locks, long-running
  queries, slow queries, and backup freshness.
- Alerts for failed backups, offline workers, low disk, unhealthy databases,
  failed jobs, and expiring credentials.
- Notification channels for in-app, email, and webhook alerts.
- PostgreSQL extension management with allowlist policy.
- Database user and role management through DataDock permissions.
- Connection snippets for common clients such as `psql`, Drizzle, node-postgres,
  Python, and GUI tools.
- Import and export for CSV/JSON table data with validation and job logs.
- Saved queries, query folders/tags, query formatter, and query result export.
- ERD or relationship graph for inspected schemas.
- Explain plan view for query tuning.
- Read-only share/export links where explicitly enabled.
- In-app product documentation and contextual help.
- Support bundle generation with logs, versions, config summary, and redacted
  diagnostics.
- Accessibility, keyboard navigation, responsive layouts, and clear empty/error
  states.
- Legal/license/about screen showing version, license, third-party notices, and
  update status.
- Data retention controls for audit logs, query history, job logs, and backups.

## MVP Engines

The first production engine is PostgreSQL.

The architecture should allow later engines:

- MySQL.
- MariaDB.
- Redis.
- MongoDB.
- ClickHouse.

Do not build the first version as if every engine is already complete. Build the
engine interface and implement PostgreSQL well.

## Deployment Modes

### All-In-One Local Mode

Runs on one machine:

- Next.js control plane.
- Worker.
- Platform metadata PostgreSQL.
- Managed database containers.
- Local backup directory.

This is the best first install experience.

### Separate App And Worker Mode

The Next.js app and worker run as separate processes or hosts.

Examples:

- Next.js on a VPS, worker on the same VPS.
- Next.js on an app platform, worker on a storage VPS.
- Next.js behind a reverse proxy, worker behind a tunnel.

The worker must be reachable by the control plane or exposed through a secure
tunnel. The worker still verifies signatures on every job notification.

### Remote Worker Mode

Multiple workers may be registered later, but the first implementation can
support one active worker per workspace.

## Explicit Non-Goals

DataDock intentionally excludes:

- Serverless database compute.
- Database branching.
- Autoscaling.
- Multi-region replication.
- Distributed storage.
- Kubernetes orchestration.
- Transparent horizontal scaling.
- Managed high availability.
- A general shell command dashboard.
- Arbitrary agent shell execution.
- Public SaaS tenant isolation in the initial product.

## Product Safety Rules

- Show the user where a database is hosted before generating connection strings.
- Do not silently expose database ports publicly.
- Never show raw database passwords after the initial reveal unless the user
  rotates the credential.
- Require explicit confirmation for delete, restore overwrite, credential
  rotation, public exposure, and destructive SQL.
- Create an audit event for all privileged operations.
- Keep job logs explainable enough that a failed operation can be retried or
  diagnosed.
- Warn before upgrades when migrations, worker versions, or database engine
  versions are incompatible.
- Surface setup problems inside the UI instead of requiring users to inspect
  terminal logs.
