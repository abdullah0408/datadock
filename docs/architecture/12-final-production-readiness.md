# Final Production Readiness

DataDock is ready for real self-hosted use only when these controls are in
place.

## Application Standard

- A fresh user can install, configure, and use the app without developer help.
- Onboarding creates the first workspace and owner safely.
- Platform metadata migrations are repeatable.
- Package boundaries are enforced in CI.
- Worker operations are signed and audited.
- Backups can be restored in a test environment.
- Job failures are visible and retryable where safe.
- Permissions are tested server-side.
- Database credentials are not leaked in logs or audit payloads.
- End users can install, upgrade, troubleshoot, and recover without developer
  intervention for normal failure modes.

## Launch Gate

Before launch:

1. Run formatting.
2. Run lint.
3. Run typecheck.
4. Run package boundary checks.
5. Run unit tests.
6. Run service tests.
7. Run repository tests against PostgreSQL.
8. Run worker signature tests.
9. Run Playwright smoke tests.
10. Create a fresh metadata database.
11. Apply Drizzle migrations.
12. Complete onboarding.
13. Register a worker.
14. Create a PostgreSQL managed database.
15. Generate a connection string.
16. Browse schema.
17. Run read-only SQL.
18. Create a backup.
19. Restore the backup into a new database.
20. Verify audit logs and job logs.
21. Configure alert channel and trigger test notification.
22. Export table/query result data.
23. Generate and inspect a redacted support bundle.
24. Run upgrade preflight checks.
25. Confirm help/about/license screens are present.

## Boundary Checklist

- `apps/web` does not import `@datadock/db`, `@datadock/repositories`, or
  `@datadock/services`.
- `@datadock/api` calls services, not repositories.
- `@datadock/services` orchestrates transactions and jobs.
- `@datadock/repositories` contains Drizzle persistence only.
- `@datadock/domain` is pure TypeScript.
- Worker code does not import React UI.
- Package public APIs are exported through `index.ts`.
- CI blocks deep internal imports.

## Required Admin Screens

- Health dashboard.
- Worker dashboard.
- Job logs.
- Backup status.
- Audit search.
- Member and role management.
- Active sessions.
- Storage usage.
- Environment readiness.
- App and migration version.
- Alert rules and notification channels.
- Platform metadata backup status.
- Support bundle generator.
- Upgrade preflight and release notes.
- Third-party notices and license screen.

## Recovery Requirements

Recovery must be tested, not assumed.

Minimum recovery drills:

- Restore platform metadata backup into staging.
- Restore object storage or confirm backup bucket access.
- Restore a managed database backup into a new database.
- Re-run failed backup job.
- Rotate a database credential.
- Re-register or revoke a worker.
- Restore platform metadata from automatic pre-upgrade backup.
- Recover from failed worker upgrade or version mismatch.

## Data Retention

Define retention for:

- Audit logs.
- Job logs.
- Query history.
- Agent messages and tool calls.
- Temporary uploads.
- Export files.
- Backup artifacts.
- Worker events.
- Alert events and notification deliveries.
- Diagnostic and support bundles.

Normal UI flows should not hard-delete security-sensitive records.

## Final Missing Feature Guard

Do not launch without:

- Empty states.
- Loading states.
- Error states.
- Permission-denied states.
- Dangerous-action confirmations.
- Reason capture for destructive actions.
- Backup restore verification.
- Worker health warnings.
- Query limits.
- Secret redaction.
- Install readiness checks.
- Upgrade preflight checks.
- Monitoring dashboard.
- Alert notifications.
- Platform metadata backups.
- Support bundle generation.
- In-app help and troubleshooting.
- Accessibility and keyboard navigation review.
