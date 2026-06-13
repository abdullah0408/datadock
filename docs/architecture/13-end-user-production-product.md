# End-User Production Product Standard

This document defines what DataDock needs before it is handed to real end users
as a final working production application. It is stricter than the MVP bar.

## Final Product Principle

The final app must help users succeed when things go wrong. A production
database tool is not complete unless users can install it, operate it, upgrade
it, recover it, and diagnose failures without reading source code.

## Missing Features To Add Before Final Release

### Installation And Onboarding

Required:

- Guided first-run onboarding.
- Environment readiness checks.
- Docker access check.
- Metadata database connection check.
- Worker connectivity check.
- Storage provider check.
- Email/webhook notification test.
- Timezone and base URL validation.
- Clear setup-blocking errors with remediation steps.

Nice to have:

- One-command local install script.
- Docker Compose production template.
- Environment variable generator.
- Sample workspace for demo mode.

### Upgrade, Rollback, And Versioning

Required:

- App version screen.
- Worker version screen.
- Metadata schema version screen.
- Upgrade preflight checks.
- Automatic metadata backup before migration.
- Worker/app version compatibility check.
- Release notes inside the app.
- Rollback documentation.

Nice to have:

- Update availability check.
- Downloadable upgrade report.
- Maintenance mode banner.

### Monitoring And Alerts

Required:

- Worker online/offline/degraded status.
- Managed database health status.
- Disk usage and free space warnings.
- Backup freshness warnings.
- Failed job alerts.
- Failed backup and restore alerts.
- Long-running query visibility.
- Connection count visibility.
- Alert center.
- In-app notifications.
- Email notification channel.
- Webhook notification channel.

Nice to have:

- Slow query trend.
- Lock wait visibility.
- Table size and index size charts.
- Vacuum/analyze recommendation hints.

### PostgreSQL Administration

Required:

- Database create/delete lifecycle.
- Credential reveal-once and rotation.
- Database users, roles, and grants.
- Connection string and client snippets.
- Schema/table/index/foreign key inspection.
- PostgreSQL extension allowlist and enable/disable workflow.
- Read-only SQL execution.
- Write/destructive SQL approval flow.
- Query timeout and row limits.

Nice to have:

- Explain plan viewer.
- ERD/relationship graph.
- Query formatter.
- Saved query folders and tags.
- CSV/JSON import and export.
- Table data editor with validation.

### Backup And Recovery

Required:

- Manual managed database backup.
- Scheduled managed database backup.
- Backup verification.
- Restore into a new database.
- Restore overwrite with confirmation and reason.
- Backup retention policy.
- Platform metadata backup.
- Restore drill documentation.

Nice to have:

- Point-in-time recovery for PostgreSQL through WAL archiving.
- Backup encryption key rotation.
- Backup download audit.

### Security And Compliance

Required:

- Server-side permission checks.
- Database-level permission checks.
- Step-up authentication for sensitive operations.
- Audit logs for privileged operations.
- Secret redaction.
- Session management.
- Rate limiting.
- Third-party notices screen.
- License/about screen.
- Data retention settings.

Nice to have:

- 2FA.
- IP allowlist for admin screens.
- Webhook signing for outgoing notifications.
- Security event export.

### Supportability

Required:

- Support bundle generator.
- Redacted logs.
- App, worker, database, and migration version summary.
- Failed job diagnostics.
- Worker diagnostics.
- Storage diagnostics.
- Backup diagnostics.
- Copyable error IDs and request IDs.

Nice to have:

- Guided troubleshooting flows.
- Health check share/export.
- Admin notes on incidents.

### User Experience Polish

Required:

- Empty states.
- Loading states.
- Error states.
- Permission-denied states.
- Offline/degraded states.
- Keyboard navigation.
- Accessible forms and tables.
- Responsive layouts.
- Confirmation dialogs for dangerous actions.
- Reason capture for destructive actions.
- Contextual help.

Nice to have:

- Command palette.
- Global search.
- Keyboard shortcuts for SQL editor.
- Customizable dashboard widgets.

## Final Feature Checklist

The product is end-user complete only when:

- A new user can install and complete onboarding.
- The app shows what is misconfigured and how to fix it.
- A user can create, inspect, query, back up, and restore PostgreSQL databases.
- A user can recover from a failed job.
- A user can rotate credentials safely.
- A user can see worker and database health.
- A user receives alerts for important failures.
- A user can export diagnostics without leaking secrets.
- An admin can review audit logs.
- An admin can upgrade with preflight checks and rollback instructions.
- All dangerous actions require confirmation and leave an audit trail.

## Do Not Ship Final Without These

- Platform metadata backup and restore story.
- Worker version and health checks.
- Backup verification.
- Alert notifications.
- Support bundle.
- Upgrade preflight.
- Permission test coverage.
- Secret redaction tests.
- Accessibility pass.
- End-user install and recovery documentation.
