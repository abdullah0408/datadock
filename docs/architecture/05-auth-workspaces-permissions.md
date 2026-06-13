# Auth, Workspaces, And Permissions

## Authentication

Use Better Auth for:

- Email/password authentication.
- Sessions.
- Password reset.
- Email verification.
- OAuth providers if added later.
- Optional two-factor authentication.

The app owns `UserProfile` style extension data outside Better Auth core tables.

## First-User Bootstrap

When no platform owner exists:

1. The first registered user becomes platform owner.
2. A default workspace is created.
3. The user becomes workspace owner.
4. Required onboarding starts before the main dashboard is shown.

Bootstrap must be transactional and idempotent.

## Workspace Model

DataDock is self-hosted and can support multiple workspaces inside one
installation. A workspace is the ownership boundary for:

- Managed databases.
- Workers.
- Backup configs.
- Query history.
- Agent threads.
- Audit events.
- Members and roles.

Every workspace-owned query must scope by server-resolved `workspaceId`.

## Role Model

Recommended built-in roles:

- `owner`
- `admin`
- `developer`
- `analyst`
- `viewer`

Built-in roles are templates. Later versions may allow custom roles.

## Permission Categories

Workspace permissions:

- `workspace.view`
- `workspace.update`
- `members.manage`
- `roles.manage`
- `audit.view`

Worker permissions:

- `workers.view`
- `workers.register`
- `workers.rotate_secret`
- `workers.revoke`

Database permissions:

- `databases.view`
- `databases.create`
- `databases.update`
- `databases.delete`
- `databases.credentials.view_once`
- `databases.credentials.rotate`
- `databases.schema.view`
- `databases.table.read`
- `databases.table.write`
- `databases.sql.read`
- `databases.sql.write`
- `databases.sql.destructive`

Backup permissions:

- `backups.view`
- `backups.create`
- `backups.restore`
- `backups.delete`
- `backups.configure`

Agent permissions:

- `agent.use`
- `agent.run_read_tools`
- `agent.request_write_tools`
- `agent.approve_risky_tools`

## Authorization Rules

- UI permission gates are convenience only.
- Every tRPC query and mutation checks permissions server-side.
- Every worker callback verifies worker identity and assignment.
- Database-level permissions are checked in addition to workspace membership.
- Platform owner cross-workspace access is audited.
- Step-up authentication is required for secret reveal, worker secret rotation,
  backup restore, and database deletion.

## Database-Level Grants

DataDock has two layers of database permission:

1. Platform permission: can the user request an action in DataDock?
2. Engine grant: what database role/user is created inside the managed engine?

The platform must not assume engine grants are synchronized. Credential rotation
and grant updates are job-backed operations that report final state.

## Audit Requirements

Audit these actions:

- Login and failed login.
- Password reset.
- User invite and removal.
- Role changes.
- Worker registration, rotation, and revocation.
- Database create, delete, restore, and credential rotation.
- Backup create, verify, restore, and delete.
- Destructive SQL approval and execution.
- Agent tool approval and execution.

Audit payloads must not contain raw secrets.
