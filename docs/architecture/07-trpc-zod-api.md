# tRPC And Zod API Contracts

Use tRPC as the internal API layer between the Next.js app and server code. Use
Zod for all external input validation.

## Procedure Types

Define these base procedures:

```ts
publicProcedure;
protectedProcedure;
workspaceProcedure;
adminProcedure;
platformOwnerProcedure;
```

### publicProcedure

Allowed for:

- Health metadata.
- Public auth-adjacent checks.

Never expose workspace or database metadata.

### protectedProcedure

Requires login.

Used for:

- User profile.
- Workspace list.
- Active workspace selection.

### workspaceProcedure

Requires:

- Login.
- Active workspace.
- Active membership.

Most DataDock procedures use this.

### adminProcedure

Requires workspace admin, owner, or a specific admin permission.

### platformOwnerProcedure

Requires platform owner status. Use rarely and audit cross-workspace actions.

## Router Structure

```text
packages/api/src/
  context.ts
  root.ts
  trpc.ts
  routers/
    auth.ts
    workspaces.ts
    members.ts
    permissions.ts
    workers.ts
    databases.ts
    credentials.ts
    schema.ts
    sql.ts
    jobs.ts
    backups.ts
    files.ts
    agent.ts
    audit.ts
    settings.ts
    health.ts

apps/web/src/app/api/trpc/[trpc]/route.ts
```

`root.ts` exports `AppRouter`.

## Router Rules

Routers may:

- Build context.
- Validate input.
- Check permissions.
- Call services.
- Shape output.

Routers must not:

- Import Drizzle.
- Import repositories.
- Run Docker operations.
- Connect to managed databases directly.
- Trust client-calculated risk or permission values.

## Zod Schema Rules

1. Validate every tRPC input.
2. Validate worker callbacks and manifests.
3. Keep schemas close to the feature when both client and server need them.
4. Keep server-only schemas in services or domain modules.
5. Use string IDs with explicit prefixes or UUID validation.
6. Use `z.coerce.date()` only for controlled inputs.
7. Do not trust client-provided `workspaceId`; resolve it from session/context.
8. Do not trust client-provided SQL risk classification; classify server-side.

Common inputs:

```ts
export const paginationInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});

export const idInput = z.object({
  id: z.string().min(1),
});

export const dateRangeInput = z.object({
  from: z.string().date(),
  to: z.string().date(),
});
```

## Core Routers

### workersRouter

Queries:

```text
list
getById
getHealth
getEvents
```

Mutations:

```text
register
rotateSecret
revoke
testConnection
```

### databasesRouter

Queries:

```text
list
getById
getConnectionProfile
getLifecycleTimeline
```

Mutations:

```text
create
updateDisplayName
delete
rotateCredential
updateConnectionProfile
```

### schemaRouter

Queries:

```text
listSchemas
listTables
getTable
getColumns
getIndexes
getForeignKeys
previewRows
```

### sqlRouter

Queries:

```text
history
savedQueries
classify
```

Mutations:

```text
executeRead
requestWriteExecution
approveAndExecute
saveQuery
deleteSavedQuery
```

### jobsRouter

Queries:

```text
list
getById
getLogs
```

Mutations:

```text
cancel
retry
```

### backupsRouter

Queries:

```text
listConfigs
listArtifacts
getArtifact
getRestoreRun
```

Mutations:

```text
createConfig
updateConfig
runBackup
verifyBackup
restoreBackup
deleteArtifact
```

## Idempotency

Use idempotency keys for:

- Database creation.
- Credential rotation.
- Backup creation.
- Restore requests.
- Destructive SQL approval execution.

The service layer owns idempotency behavior. Routers only pass validated keys.
