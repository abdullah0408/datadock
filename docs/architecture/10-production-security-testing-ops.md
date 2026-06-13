# Production, Security, Testing, And Ops

## Production Requirements

DataDock should be production-minded even when used personally:

- Strong authentication.
- Server-side authorization.
- Audit logs.
- Worker signature verification.
- Backups and restore testing.
- Typed environment validation.
- Secure file storage.
- Job retries and logs.
- Package boundary enforcement.
- CI checks.
- Upgrade and rollback plan.
- Monitoring and alerting.
- Support bundle generation.
- End-user documentation.

## Environment Variables

Recommended groups:

```text
APP_URL
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
ENCRYPTION_KEY
WORKER_CALLBACK_TOKEN_SECRET
STORAGE_PROVIDER
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
EMAIL_PROVIDER
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
LOG_LEVEL
SENTRY_DSN
UPDATE_CHECK_URL
SUPPORT_BUNDLE_RETENTION_DAYS
ALERT_EMAIL_FROM
WEBHOOK_SIGNING_SECRET
```

Validate environment variables with Zod on startup.

## Secret Handling

Rules:

- Never log secrets.
- Encrypt stored provider credentials.
- Store hashes or metadata where possible.
- Rotate worker secrets.
- Rotate database credentials through jobs.
- Audit secret changes without storing raw values.
- Use separate development and production secrets.

## Security Controls

Authentication:

- Email verification.
- Password reset.
- Session expiry.
- Optional 2FA.
- Brute-force protection.
- Step-up auth for sensitive actions.

Authorization:

- Server-side permission checks on every mutation.
- Permission checks on sensitive queries.
- Database-level permissions for database operations.
- UI gates only as convenience.

Worker security:

- Signed job notifications.
- Timestamp freshness.
- Nonce replay protection.
- Worker bearer token for callbacks.
- Worker revocation support.
- Secret versioning.

SQL safety:

- Classify SQL server-side.
- Require confirmation for risky SQL.
- Apply row limits and timeouts.
- Redact secrets before query history storage.
- Block unsupported or unsafe commands in the dashboard execution path.

## Rate Limiting

Rate-limit:

- Login.
- Password reset.
- Email verification resend.
- Worker job endpoint.
- Worker callbacks.
- File uploads.
- SQL execution.
- Agent tool execution.
- Backup and restore requests.
- Import and export jobs.
- Support bundle generation.
- Webhook notification delivery retries.

Production deployments should use a shared store such as Redis if multiple app
instances exist.

## Package Boundary Enforcement

CI must fail if:

- `apps/web` imports `@datadock/db`, `@datadock/repositories`, or
  `@datadock/services`.
- `@datadock/api` imports `@datadock/db` or `@datadock/repositories`.
- `@datadock/domain` imports database, UI, email, files, jobs, React, or
  Next.js.
- `@datadock/repositories` imports services.
- Any package deep-imports another package's internal file without an explicit
  export.

Use:

- `dependency-cruiser`.
- ESLint restricted imports.
- Package `exports`.
- TypeScript project boundaries.

## Testing Strategy

Unit tests:

- Domain state transitions.
- SQL classification.
- Backup retention policy.
- Permission helpers.

Repository tests:

- Drizzle queries.
- Migrations.
- Workspace scoping.

Service tests:

- Database creation transaction.
- Job creation and idempotency.
- Worker callback state transitions.
- Backup and restore workflows.

Integration tests:

- tRPC routers.
- Better Auth session flows.
- Worker signed request verification.
- PostgreSQL engine driver against a test container.

Playwright tests:

- Onboarding.
- Create database.
- View schema.
- Run read-only SQL.
- Create backup.
- View job logs.
- Configure alert channel.
- Export query result.
- Generate support bundle.
- Run upgrade preflight screen.

## Operations

Required operational screens:

- Health dashboard.
- Worker status.
- Job queue and logs.
- Backup status.
- Alert center.
- Notification delivery logs.
- Platform metadata backup status.
- Audit search.
- Active sessions.
- Storage usage.
- App version and migration version.
- Support bundle generator.
- Upgrade preflight report.

Every failed operation should have a support path:

- Failed job: inspect logs and retry when safe.
- Failed backup: view provider error and rerun.
- Failed restore: preserve logs and require manual review.
- Failed worker callback: mark worker degraded and surface alert.
- Failed alert delivery: inspect delivery logs and resend.
- Failed import: download validation errors and retry corrected file.
- Failed upgrade preflight: show blocking check and remediation.

## Upgrade And Rollback

Final releases must document and support:

- Version compatibility between web app, worker, metadata schema, and managed
  engine images.
- Preflight checks before applying migrations.
- Automatic platform metadata backup before upgrade.
- Clear migration failure handling.
- Worker version mismatch warning.
- Rollback instructions for app version and metadata backup.
- Release notes visible in the app.
