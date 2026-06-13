# Implementation Playbook

## Build Principle

Build the foundation first, then product workflows:

```text
Workspace setup -> Drizzle metadata -> Auth -> Permissions -> Jobs -> Worker ->
PostgreSQL engine -> Databases -> Schema/SQL -> Backups -> Monitoring ->
Alerts -> Agent -> End-user polish -> Ops
```

Do not build UI screens that need privileged operations before the job, worker,
and permission contracts are defined.

## Step 1: Workspace Foundation

Confirm:

- pnpm workspace is configured.
- Package names use `@datadock/*`.
- Package `exports` are present.
- Root scripts run filtered app commands.
- Boundary checker exists.
- Format, lint, typecheck, and build scripts pass.

## Step 2: Drizzle Database Foundation

Implement in `packages/db`:

- Drizzle schema folder.
- Drizzle config.
- PostgreSQL client factory.
- Migration commands.
- Transaction helper.
- Common columns.
- Zod env validation for `DATABASE_URL`.

Implement in `packages/repositories`:

- Repository factory.
- Workspace-scoped query helpers.
- Transaction-scoped repository access.

## Step 3: API Foundation

Implement in `packages/api`:

- tRPC context.
- Procedure helpers.
- Error mapper.
- Router root.
- Health router.

API context should include:

- User/session.
- Active workspace.
- Request ID.
- Services.

## Step 4: Auth And Workspace

Implement:

- Better Auth config.
- Auth route handler.
- User profile extension.
- First-user bootstrap.
- Workspace creation.
- Workspace switcher.
- Member invitations.
- Role and permission checks.

All later workspace APIs should use `workspaceProcedure`.

## Step 5: Job System

Implement:

- Job table.
- Job logs.
- Job state machine.
- Idempotency keys.
- Job creation service.
- Job query API.
- Retry and cancel rules.

## Step 6: Worker Security

Implement:

- Worker registration.
- Worker credential storage.
- HMAC signer in service layer.
- HMAC verifier in worker.
- Timestamp and nonce checks.
- Manifest fetch endpoint.
- Worker callback endpoints.
- Worker heartbeat.

## Step 7: PostgreSQL Engine MVP

Implement:

- Engine interface.
- PostgreSQL engine implementation.
- Docker container lifecycle.
- Database creation.
- User and credential creation.
- Grant management.
- Health check.
- Schema introspection.

## Step 8: Database Dashboard

Implement:

- Database list.
- Database create flow.
- Database detail.
- Connection profile.
- Credential reveal-once and rotation.
- Lifecycle timeline.
- Permission gates.

## Step 9: Schema Browser And SQL

Implement:

- Schema list.
- Table list.
- Column/index/foreign key detail.
- Row preview with limits.
- SQL editor.
- SQL classification.
- Read-only execution.
- Approval flow for write/destructive SQL.
- Query history with redaction.

## Step 10: Backups And Restore

Implement:

- Backup config.
- Manual backup job.
- Local provider.
- S3-compatible provider.
- Backup verification.
- Restore into new database.
- Retention cleanup.
- Platform metadata backup.
- Upgrade-time automatic backup.

## Step 11: Monitoring And Alerts

Implement:

- Worker health checks.
- Managed database health checks.
- Disk/storage usage metrics.
- Connection and long-running query metrics.
- Backup freshness checks.
- Alert rules.
- In-app notifications.
- Email/webhook notification channels.
- Alert delivery logs.

## Step 12: Final PostgreSQL Admin Features

Implement:

- Extension allowlist and management.
- Database users, roles, and grants.
- Import/export jobs for CSV and JSON.
- ERD/relationship graph.
- Explain plan viewer.
- Query formatter.
- Saved query folders and tags.
- Connection snippets for common clients.

## Step 13: Agent Tools

Implement only after the normal UI path works:

- Tool registry.
- Permission-aware tool listing.
- Read-only schema tools.
- SQL draft tool.
- Read-only SQL execution tool.
- Confirmation flow for risky tools.
- Tool call audit.

## Step 14: End-User Product Polish

Implement:

- Guided install checks.
- In-app help and troubleshooting.
- Empty/loading/error/permission-denied states on every screen.
- Accessibility and keyboard navigation pass.
- Responsive tablet/mobile fallback.
- About, license, version, and third-party notices.
- Support bundle generation with redaction.
- Upgrade preflight and rollback documentation.

## Step 15: Production Hardening

Implement:

- Rate limits.
- Structured logs.
- Request IDs.
- Error tracking hook.
- Backup restore drill.
- CI checks.
- Playwright smoke tests.
- Deployment docs.
