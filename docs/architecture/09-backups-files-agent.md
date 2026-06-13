# Backups, Files, And Agent Tools

## Backup Architecture

Backups are job-backed operations executed by the worker.

Backup flow:

1. User requests manual or scheduled backup.
2. Service validates permission and backup policy.
3. Service creates backup artifact metadata and job rows.
4. Worker runs engine-specific backup command.
5. Worker stores artifact in configured storage.
6. Worker verifies artifact when policy requires it.
7. Worker callbacks update status and logs.

## Backup Providers

Supported provider targets:

- Local disk.
- S3-compatible object storage.
- MinIO.
- Cloudflare R2.
- Backblaze B2.
- AWS S3.

The provider interface should hide provider-specific SDK details from services.

## Backup Rules

- Manual backup is available for users with `backups.create`.
- Scheduled backup configuration requires `backups.configure`.
- Restore requires `backups.restore` plus confirmation.
- Restore overwrite must capture a reason.
- Retention cleanup runs as a job.
- Verification result is stored separately from artifact existence.
- Backup artifacts should be encrypted when stored outside the host.

## Restore Rules

Restore modes:

- Restore into a new managed database.
- Restore over an existing database after confirmation.

The first implementation should prefer restore into a new database because it is
safer and easier to verify.

## File Storage

Files module owns:

- Storage provider configuration.
- Upload metadata.
- Signed read URLs.
- Temporary file cleanup.
- Backup artifact references when object storage is used.

Files can include:

- Backup artifacts.
- Export files.
- Import source files.
- Generated reports.
- Agent-generated artifacts.

No public bucket listing is allowed.

## Agent Tool Architecture

The agent is optional and permissioned. It is not a bypass around the product.

Agent tools are typed wrappers around existing services.

Allowed tool categories:

- Inspect database metadata.
- Read schema.
- Explain query history.
- Generate SQL draft.
- Run safe read-only SQL within limits.
- Request backup.
- Request credential rotation.
- Request destructive operation approval.

Forbidden:

- Shell execution.
- Direct Docker access.
- Direct Drizzle access.
- Direct repository access.
- Secret exfiltration.
- Unapproved destructive SQL.

## Agent Confirmation Policy

No confirmation required:

- Read database list.
- Read schema.
- Explain a query.
- Draft SQL without execution.

Confirmation required:

- Run write SQL.
- Run destructive SQL.
- Create backup.
- Restore backup.
- Rotate credential.
- Delete database.

The same server-side permissions apply to agent and UI actions.

## Agent Audit

Record:

- Thread ID.
- Message ID.
- Tool name.
- Tool input summary.
- Tool result summary.
- Actor.
- Workspace.
- Database ID when relevant.
- Confirmation record when relevant.
- Error details without raw secrets.
