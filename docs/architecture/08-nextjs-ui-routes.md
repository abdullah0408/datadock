# Next.js UI Architecture

## App Structure

The web app lives in:

```text
apps/web
```

Recommended route structure:

```text
apps/web/src/app/
  (auth)/
    login/
    register/
    reset-password/
  (setup)/
    onboarding/
  (dashboard)/
    layout.tsx
    page.tsx
    databases/
      page.tsx
      [databaseId]/
        page.tsx
        schema/
        sql/
        backups/
        credentials/
        settings/
    workers/
    jobs/
    backups/
    audit/
    monitoring/
    alerts/
    support/
    updates/
    help/
    settings/
  api/
    trpc/[trpc]/route.ts
    auth/[...all]/route.ts
    internal/workers/
```

## Feature Folder Pattern

Use feature folders for complex UI:

```text
apps/web/src/features/databases/
  components/
  hooks/
  schemas/
  types.ts
```

Feature folders may import public UI primitives and tRPC client hooks. They must
not import services, repositories, Drizzle, or worker internals.

## Dashboard Layout

The dashboard should prioritize repeated operational use:

- Dense but readable tables.
- Clear job and worker status.
- Persistent workspace switcher.
- Searchable database list.
- Quick access to SQL, schema, backups, credentials, and settings.
- Visible warning states for unhealthy workers or failed backups.

Avoid landing-page composition inside the app. The first authenticated screen is
the actual operational dashboard.

## Required Pages

MVP pages:

- Onboarding.
- Dashboard overview.
- Databases list.
- Database detail.
- Schema browser.
- Table data preview/editor.
- SQL editor.
- Query history.
- Credentials and connection string.
- Backups.
- Jobs.
- Workers.
- Audit log.
- Workspace settings.
- Member settings.

Final end-user pages:

- Install readiness and first-run checks.
- Upgrade status, preflight checks, and rollback instructions.
- Platform metadata backup and restore.
- Monitoring overview.
- Database health detail.
- Alerts and notification channels.
- PostgreSQL extensions.
- Database users, roles, and grants.
- Import and export jobs.
- ERD/relationship graph.
- Explain plan viewer.
- Saved query library with folders and tags.
- Support bundle generator.
- In-app help and troubleshooting.
- About, license, version, and third-party notices.

## Data Loading

Use tRPC for app data.

Rules:

- Server components may prefetch through server-safe tRPC helpers.
- Client components use tRPC query and mutation hooks.
- No client component calls route handlers directly for app metadata unless the
  endpoint is intentionally not part of tRPC, such as file upload.
- Long-running operations return a job ID and the UI follows job state.

## Forms

Use:

- Zod schemas shared with server where appropriate.
- React Hook Form or an equivalent form library.
- Server recalculation for risk, permissions, and derived state.

Do not let the client decide:

- SQL risk level.
- Final permission outcome.
- Worker assignment.
- Backup retention enforcement.
- Credential exposure policy.

## SQL Editor

The SQL editor should show:

- Active database.
- Connection role.
- Read-only/write/destructive classification.
- Row limit.
- Query timeout.
- Confirmation state for risky queries.
- Execution history.
- Query formatter.
- Explain plan action.
- Result export action.
- Saved query folder/tag controls.

Use Monaco Editor when the feature is implemented.

## Required UI States

Every operational screen needs:

- Loading state.
- Empty state.
- Error state.
- Permission-denied state.
- Job-running state where applicable.
- Retry affordance for failed jobs where safe.
- Offline/degraded worker state.
- Backup overdue state.
- Version mismatch state.
- Setup incomplete state.
- Accessible keyboard and screen-reader behavior.

## Dangerous Actions

Use explicit confirmation for:

- Delete database.
- Restore backup over an existing database.
- Rotate credential.
- Revoke worker.
- Expose database port publicly.
- Execute destructive SQL.

Confirmation should capture a reason for audit when the action is destructive or
security-sensitive.
