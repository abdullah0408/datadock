# Data Model And Drizzle ORM

## Database Rules

1. Use PostgreSQL for platform metadata.
2. Use Drizzle ORM for application data access.
3. Use Drizzle Kit for migrations.
4. Keep schema definitions in `packages/db/src/schema`.
5. Keep repository queries in `packages/repositories/src`.
6. Use UUID v7, ULID, or CUID2 consistently for application IDs.
7. Every workspace-owned table has `workspaceId`.
8. Every mutable table has `createdAt` and `updatedAt`.
9. Sensitive tables also track `createdById` or an audit event.
10. Use `status` fields instead of hard deletes for user-facing records.
11. Store secrets encrypted or store only metadata about secrets.
12. Use JSONB only for flexible metadata, not for primary domain state.
13. Use `numeric` or integer minor units for quotas and sizes. Never use
    floating point for billable or storage values.

## Drizzle Ownership

`@datadock/db` owns:

- Drizzle schema.
- Drizzle client factory.
- Migration config.
- Transaction helper.
- Shared database column helpers.

`@datadock/repositories` owns:

- SQL queries through Drizzle.
- Persistence mapping.
- Read models.
- Transaction-scoped repositories.

`@datadock/services` owns:

- When transactions start and commit.
- Which repositories participate in a use case.
- Permission-sensitive decisions.
- Worker dispatch after durable metadata is committed.

`apps/web`, `packages/api`, and `packages/domain` must not import Drizzle.

## Platform Metadata Entities

### Identity

Better Auth owns its required auth tables.

Application extension tables:

- `userProfiles`
- `securityEvents`
- `userPreferences`

### Workspace

Tables:

- `workspaces`
- `workspaceMembers`
- `workspaceInvitations`
- `workspaceSettings`
- `roles`
- `rolePermissions`
- `memberRoles`

Rules:

- The first registered user becomes platform owner.
- The first workspace is created during onboarding.
- Permission checks use server-side membership data, never client claims.

### Workers

Tables:

- `workers`
- `workerCredentials`
- `workerHeartbeats`
- `workerEvents`

Important fields:

- `workspaceId`
- `name`
- `endpointUrl`
- `status`
- `lastSeenAt`
- `activeSecretVersion`
- `revokedAt`

### Managed Databases

Tables:

- `databaseEngines`
- `managedDatabases`
- `databaseCredentials`
- `databasePermissions`
- `connectionProfiles`

Rules:

- Store generated credential metadata, not plain passwords.
- The worker may reveal a newly generated password once through the result
  channel if the operation policy allows it.
- Rotation creates a new credential version and revokes the old one after a
  grace period.

### Jobs

Tables:

- `jobs`
- `jobLogs`
- `jobLocks`
- `jobAttempts`
- `jobIdempotencyKeys`

Rules:

- Job input is validated before insert.
- Job result is validated before state update.
- Job logs are append-only.
- Job status changes are state-machine checked.

### Querying

Tables:

- `queryHistory`
- `savedQueries`
- `queryFavorites`
- `queryFolders`
- `queryTags`
- `queryExports`

Rules:

- Redact secrets before storing SQL text.
- Store row count, duration, actor, database ID, and risk classification.
- Store result previews only when explicitly allowed.

### Monitoring And Alerts

Tables:

- `healthChecks`
- `metricSnapshots`
- `alertRules`
- `alertEvents`
- `notificationChannels`
- `notificationDeliveries`

Rules:

- Store sampled metrics with retention limits.
- Alert rules are workspace-scoped.
- Alert delivery failures are logged and retryable.
- Raw secrets from notification providers are encrypted or omitted.

### Backups

Tables:

- `backupConfigs`
- `backupSchedules`
- `backupArtifacts`
- `backupVerificationRuns`
- `restoreRuns`
- `platformBackupRuns`

Rules:

- Restore is always job-backed.
- Restore overwrite requires explicit confirmation.
- Retention runs through the job system.
- Platform metadata backup is separate from managed database backup.

### Install, Upgrade, And Support

Tables:

- `installationState`
- `schemaMigrationHistory`
- `appReleaseChecks`
- `supportBundles`
- `diagnosticRuns`
- `thirdPartyNotices`

Rules:

- Store the installed app version and migration version.
- Store upgrade preflight results.
- Support bundles are redacted by default.
- Diagnostics never include raw secrets or database passwords.

### Agent

Tables:

- `agentThreads`
- `agentMessages`
- `agentToolCalls`
- `agentApprovals`

Rules:

- Agent tool calls run through the same services and permissions as UI actions.
- Risky tools require a confirmation record.
- Agent cannot execute arbitrary shell commands.

### Audit

Tables:

- `auditEvents`
- `auditEventDetails`

Rules:

- Audit records are append-only.
- Raw secrets are never stored in audit payloads.
- Security-sensitive events include actor, workspace, request ID, IP hash, and
  user agent when available.

## Recommended Status Enums

Worker status:

```text
pending
active
degraded
offline
revoked
```

Database status:

```text
creating
ready
updating
backing_up
restoring
deleting
deleted
error
```

Job status:

```text
queued
dispatching
accepted
running
retrying
succeeded
failed
cancelled
timed_out
```

Backup status:

```text
pending
running
verified
available
failed
expired
deleted
```

SQL risk:

```text
read_only
write
schema_change
destructive
blocked
unknown
```

## Transaction Rules

Use a service-level transaction when a workflow changes more than one owned
table or creates a job plus audit event.

Pattern:

```text
Service starts transaction
  Repository inserts or updates metadata
  Repository inserts audit intent
  Repository inserts job
Transaction commits
Service dispatches worker notification
```

Do not dispatch worker requests inside an uncommitted transaction.

## Managed Database Data

Drizzle is for the DataDock platform metadata database.

User-managed databases are accessed through engine drivers, not through the
platform Drizzle client. For example, PostgreSQL table browsing and SQL
execution go through the PostgreSQL engine implementation inside the worker or a
server-side engine access layer with explicit limits and permissions.
