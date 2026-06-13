# Domain Boundaries

This document defines ownership rules for DataDock modules. The goal is to keep
worker operations, metadata persistence, permissions, and UI behavior from
silently leaking into each other.

## Boundary Principles

1. A module owns its tables, commands, events, and invariants.
2. Another module may consume public DTOs, but cannot write owned tables
   directly.
3. Cross-module writes happen inside application services.
4. Drizzle queries live in repositories or database package helpers.
5. Shared utilities must be generic. If a helper knows about workers, engines,
   backups, or grants, it belongs to a module.
6. Privileged operations must produce an audit event.
7. Worker-side job handlers are idempotent where practical.

## Module List

### Identity Module

Owns:

- Better Auth configuration.
- Users, sessions, accounts, verification flows.
- User profile extension.
- First-user platform owner bootstrap.

Public capabilities:

- Get current user.
- Require authenticated user.
- Require verified email where policy demands it.
- Revoke sessions after sensitive credential changes.

### Workspace Module

Owns:

- Workspaces.
- Workspace settings.
- Membership.
- Workspace invitation flow.
- Active workspace selection.

Public capabilities:

- Resolve current workspace.
- Verify membership.
- Manage workspace profile.
- List members and invitations.

### Authorization Module

Owns:

- Permission catalog.
- Role templates.
- Custom role policy.
- Database-level grants.
- Worker administration permissions.

Public capabilities:

- `can(actor, workspaceId, permission)`.
- `requirePermission(ctx, permission)`.
- `requireDatabasePermission(ctx, databaseId, permission)`.

### Worker Module

Owns:

- Worker registration.
- Worker endpoint metadata.
- Worker credentials and secret versions.
- Worker heartbeat state.
- Worker revocation and rotation policy.

Does not own:

- Managed database provisioning details.
- Backup provider implementation.

Public capabilities:

- Register worker.
- Rotate worker secret.
- Resolve active worker for a job.
- Validate worker callback identity.

### Job Module

Owns:

- Job records.
- Job state machine.
- Job logs.
- Retry policy.
- Idempotency keys.
- Job locks.

Public capabilities:

- Create durable job.
- Dispatch job.
- Append job log.
- Mark job accepted, running, succeeded, failed, or cancelled.
- Query job timeline.

### Engine Module

Owns:

- Engine capability interface.
- Engine status model.
- Provisioning state rules.
- Engine-specific validation contracts.

PostgreSQL implementation owns:

- Database creation.
- User and credential creation.
- Grants.
- Introspection.
- SQL execution policy.
- Backup and restore commands for PostgreSQL.

Public capabilities:

- Create managed database.
- Rotate database credential.
- Introspect schema.
- Execute approved SQL.
- Create backup artifact.
- Restore from backup.

### Managed Database Module

Owns:

- Managed database metadata.
- Connection profile metadata.
- Database credentials metadata.
- Database lifecycle state.
- User-facing database permissions.

Does not own:

- Docker operations.
- Raw engine administration.
- Platform auth sessions.

Public capabilities:

- List databases.
- Get database details.
- Generate connection string.
- Mark lifecycle state from job result.
- Revoke or rotate credential metadata.

### Query Module

Owns:

- Query history.
- SQL redaction.
- Saved queries.
- Query result limits.
- Read-only/destructive classification.

Public capabilities:

- Save query history.
- Redact sensitive SQL.
- Enforce row and time limits.
- Request confirmation for destructive SQL.

### Backup Module

Owns:

- Backup configuration.
- Backup schedules.
- Backup artifact metadata.
- Retention policy.
- Verification status.

Public capabilities:

- Create manual backup job.
- Schedule backup.
- Verify backup.
- Expire old backups.
- Restore from backup after confirmation.

### Files Module

Owns:

- Object storage provider abstraction.
- Storage keys.
- Signed URLs.
- File metadata.
- Temporary upload cleanup.

Public capabilities:

- Upload file.
- Generate signed read URL.
- Delete temporary files.
- Mark file retained or archived.

### Agent Module

Owns:

- Agent threads.
- Tool registry.
- Tool call audit trail.
- Confirmation policy for risky tools.

Does not own:

- Permissions.
- Direct database writes.
- Shell execution.

Public capabilities:

- List available tools for actor.
- Execute typed tool through services.
- Record tool result.
- Require confirmation for risky actions.

### Audit Module

Owns:

- Audit events.
- Actor metadata.
- Request metadata.
- Security event records.
- Audit export.

Public capabilities:

- Record audit event.
- Query audit log.
- Export audit log.

## Dependency Direction

Allowed:

```text
apps/web -> @datadock/api
@datadock/api -> @datadock/services
@datadock/services -> @datadock/domain
@datadock/services -> @datadock/repositories
@datadock/repositories -> @datadock/db
@datadock/jobs -> @datadock/services
@datadock/jobs -> @datadock/email / @datadock/files
apps/worker -> @datadock/services / @datadock/domain / @datadock/config
```

Forbidden:

```text
apps/web -> @datadock/db
apps/web -> @datadock/repositories
apps/web -> @datadock/services
apps/web -> Docker APIs
@datadock/api -> @datadock/db
@datadock/api -> @datadock/repositories
@datadock/domain -> @datadock/db
@datadock/domain -> React / Next.js
@datadock/domain -> @datadock/email / @datadock/files / @datadock/jobs
@datadock/repositories -> @datadock/services
@datadock/repositories -> worker dispatch
feature component -> another feature internal component through deep import
```

## Cross-Module Write Example

Correct database creation flow:

1. `databases.create` tRPC mutation validates input.
2. Database service checks workspace and permission.
3. Database service opens a Drizzle transaction.
4. Repository inserts managed database, job, and audit intent rows.
5. Service commits metadata transaction.
6. Service dispatches signed worker notification.
7. Worker provisions the database.
8. Worker callback service updates job and database state.
9. Audit service records final outcome.

Incorrect flow:

- tRPC router inserts database row directly.
- Router calls Docker or engine admin connection.
- Worker trusts full job details from request body.
- Repository sends worker HTTP request as a side effect.

This is forbidden because it hides security-sensitive behavior in the wrong
layer.

## Public Contracts

Each package exposes public APIs through `src/index.ts`.

Do not import another package through deep internal paths unless that path is
explicitly exported by the package and documented as public.

## Change Safety Rules

Before changing a module:

1. Identify owned tables.
2. Identify public APIs used by other modules.
3. Add a Drizzle migration for storage changes.
4. Add domain tests for rule changes.
5. Add service tests for transaction or workflow changes.
6. Add repository tests for query behavior.
7. Add audit coverage for sensitive actions.
8. Run package boundary checks.
