# DataDock Self-Hosted Database Platform Architecture

Status: proposed production architecture  
Primary engine: PostgreSQL  
Target runtime: single VPS or local machine, with optional remote worker  
Core stack: pnpm workspaces, Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table, Monaco Editor, tRPC, Zod, Better Auth, PostgreSQL, Express worker, dockerode

## 1. Executive Summary

DataDock is a self-hosted developer database management platform. It provides a dashboard experience similar to modern hosted database consoles while remaining intentionally small-scale and VPS-friendly.

The platform has two major runtime components:

- The control plane: a Next.js application that owns authentication, authorization, metadata, dashboard UX, tRPC APIs, job creation, audit logging, and worker orchestration.
- The worker: an Express service with Docker access. It is the only component allowed to manage Docker containers or connect as an engine administrator.

The system provisions database engines on demand. It does not start every supported engine at installation time. For PostgreSQL, the default model is one PostgreSQL engine container per worker with many logical databases and separate users. A stronger isolation mode can later provision one container per database.

The worker is controlled through a push-based signed request model:

- The API creates a durable job in the platform metadata database.
- The API sends `POST /jobs/run` to the assigned worker over HTTPS.
- The signed request body contains only `jobId`.
- The worker verifies HMAC-SHA256 before parsing the body.
- The worker fetches the full job manifest from the API using its worker API token.
- The worker validates the manifest, confirms the job belongs to it, executes only known job types, and streams logs/status/results back to the API.

Backups support local disk and S3-compatible providers such as AWS S3, Cloudflare R2, MinIO, and Backblaze B2. The platform supports manual backups, scheduled backups, restore, retention policies, backup verification, listing, and download.

The dashboard includes database lifecycle management, schema browsing, table editing, SQL execution, query history, audit logs, backup management, worker health, and an agentic operator. The agent layer is permissioned and tool-based. It can inspect schema, generate SQL, run safe read-only queries, create backups, and request destructive operations, but it cannot execute shell commands or bypass authorization.

## 2. Product Scope

The platform includes:

- Self-hosted database dashboard.
- PostgreSQL database provisioning through Docker.
- Modular engine architecture for MySQL, MariaDB, Redis, MongoDB, ClickHouse, and other developer databases.
- Platform metadata stored in PostgreSQL.
- Better Auth email/password authentication.
- First-user bootstrap owner flow.
- Role-based and database-level authorization.
- Database connection string generation with configurable host/IP/domain and SSL mode.
- Worker-based Docker orchestration through dockerode.
- Durable job queue stored in the platform metadata database.
- Signed API-to-worker requests.
- Worker-to-API status/log/result callbacks.
- Schema browser.
- Table editor.
- SQL editor.
- Query history.
- Audit logs.
- Backup and restore.
- Worker health monitoring.
- Agent layer with typed tools and confirmations.
- Local all-in-one deployment.
- Remote worker deployment.
- Separate Next.js server deployment.

## 3. Explicit Exclusions

The platform intentionally excludes:

- Serverless database compute.
- Database branching.
- Autoscaling.
- Distributed storage.
- Kubernetes.
- Multi-region replication.
- Cloud-native block/object storage for active database files.
- Managed high availability or automated failover.
- Automatic cross-host sharding.
- Transparent horizontal scaling.
- PostgreSQL protocol over HTTPS.
- Arbitrary shell command execution from the dashboard or agent.

Important non-goals:

- This is not Neon, Supabase, RDS, PlanetScale, or Atlas.
- This is not a Kubernetes operator.
- This is not a general remote command runner.
- This is not a replacement for production-grade database operations in regulated enterprise environments without additional hardening.

## 4. System Architecture

### Architecture Principles

- Keep Docker access isolated to the worker.
- Keep control-plane state in the metadata database.
- Treat every engine operation as a durable, auditable job.
- Prefer shared engine containers for small-scale developer workloads.
- Make isolation mode explicit and opt-in.
- Keep all public API inputs validated with Zod.
- Keep all worker job inputs validated twice: once by the API and once by the worker.
- Avoid implicit secrets disclosure.
- Make destructive operations explicit, confirmed, permission-checked, and audited.
- Design every engine through a common interface, but let each engine expose capabilities.

### Logical Components

```mermaid
flowchart LR
  User["Dashboard User"]
  Web["Next.js Control Plane<br/>Frontend, API, tRPC"]
  Meta["Platform Metadata PostgreSQL"]
  WorkerClient["Worker Client<br/>HMAC Signer"]
  Worker["Express Worker<br/>Job Runner"]
  Docker["Docker Engine"]
  PG["PostgreSQL Engine Container"]
  Future["Future Engine Containers<br/>MySQL, Redis, MongoDB, ClickHouse"]
  Backup["Backup Storage<br/>Local, S3, R2, MinIO, B2"]
  Agent["Agent Runtime<br/>Typed Tools"]

  User --> Web
  Web --> Meta
  Web --> Agent
  Agent --> Web
  Web --> WorkerClient
  WorkerClient -- "HTTPS signed POST /jobs/run" --> Worker
  Worker -- "Bearer worker token callbacks" --> Web
  Worker --> Docker
  Docker --> PG
  Docker --> Future
  Worker --> PG
  Worker --> Backup
```

### Trust Boundaries

- Browser to Next.js: authenticated user session, CSRF protection where relevant, permission checks in tRPC.
- Next.js to metadata database: trusted server-side connection.
- Next.js to worker: signed request over HTTPS.
- Worker to API: bearer worker API token over HTTPS.
- Worker to Docker socket: highly privileged local trust boundary, never exposed to Next.js.
- Worker to managed database engines: admin credentials are stored only on the worker side or encrypted in platform metadata, and used only by engine drivers.
- User database clients to managed databases: direct PostgreSQL/MySQL/etc. protocol, not routed through the dashboard by default.

### Runtime Control Flow

```mermaid
sequenceDiagram
  participant U as User
  participant W as Next.js API
  participant M as Metadata DB
  participant C as Worker Client
  participant R as Worker
  participant D as Docker/DB

  U->>W: Create database request
  W->>W: Authenticate, authorize, validate
  W->>M: Insert job and audit intent
  W->>C: Sign worker request
  C->>R: POST /jobs/run { jobId }
  R->>R: Verify HMAC, timestamp, nonce
  R->>W: Fetch job manifest with worker token
  W->>M: Verify worker, job ownership, status
  W-->>R: Return manifest
  R->>R: Validate manifest and acquire local execution lock
  R->>D: Ensure engine and execute operation
  R->>W: Stream logs/status/result
  W->>M: Update job, database metadata, audit logs
  U->>W: Poll/subscribe job status
```

## 5. Deployment Architecture

### Mode 1: All-in-One Local Mode

All components run on one local machine or VPS:

- Next.js app.
- Express worker.
- Platform metadata PostgreSQL.
- Managed database containers.
- Local backup directory, optionally S3-compatible backup storage.

Recommended for:

- Local development.
- Homelab.
- Single-user or small-team internal deployments.
- First installation experience.

Networking:

- Dashboard: `http://localhost:3000` by default.
- Worker: `https://localhost:<worker-port>` when TLS is configured, or loopback HTTP only for development.
- Metadata PostgreSQL: internal Docker network or local host port.
- Managed PostgreSQL: published only if the user wants external database clients to connect.

Security posture:

- Local-only installs can use PostgreSQL `sslmode=disable`.
- Worker endpoint can bind to `127.0.0.1` if Next.js runs on the same host.
- Docker socket is mounted only into the worker.

### Mode 2: Remote Worker Mode

The Next.js app runs separately from the worker. Examples:

- Next.js on Vercel, worker on a VPS.
- Next.js on a small app server, worker on a larger storage VPS.
- Next.js behind a reverse proxy, worker behind a tunnel.

Requirements:

- The worker must expose a reachable HTTPS endpoint or tunnel because Vercel cannot call a private LAN/VPS endpoint directly.
- The worker verifies HMAC signatures for `POST /jobs/run`.
- The worker calls back to the API over HTTPS using a worker API token.
- Database connection strings use a user-configured public host, private host, or domain.

Supported worker exposure patterns:

- Public HTTPS endpoint with firewall and HMAC verification.
- Cloudflare Tunnel.
- Tailscale Funnel where appropriate.
- VPN plus self-hosted Next.js on the same private network.
- Reverse proxy to worker Express server.

Avoid:

- Exposing the Docker socket.
- Letting Next.js reach Docker directly.
- Relying on private LAN worker URLs from Vercel.

### Mode 3: Separate Next.js Server Mode

The Next.js app runs on a VPS or dedicated server. The worker may run:

- On the same VPS.
- On another VPS.
- Behind private networking if the Next.js server can reach it.

The metadata database may be:

- A local Docker PostgreSQL container.
- A managed external PostgreSQL instance.
- A PostgreSQL instance on the same VPS.

This mode is best for production self-hosting because it avoids public worker exposure if both services share a private network.

### Connection Host Selection

Each worker has a default `connection_host` used when generating database connection strings. Users may override it per database or connection profile.

Examples:

- Local development: `localhost`
- Same Docker network: `postgres`
- VPS public IP: `203.0.113.10`
- DNS name: `db.example.com`
- Private VPN DNS: `datadock-worker.tailnet-name.ts.net`

The connection string generator must never guess silently. The UI should show:

- Host.
- Port.
- Database name.
- Username.
- SSL mode.
- Whether the database port is exposed publicly.

## 6. Monorepo Structure

```text
.
├── apps
│   ├── web
│   │   ├── app
│   │   ├── components
│   │   ├── lib
│   │   ├── server
│   │   │   ├── api
│   │   │   ├── auth
│   │   │   ├── trpc
│   │   │   └── workers
│   │   └── tests
│   └── worker
│       ├── src
│       │   ├── http
│       │   ├── jobs
│       │   ├── engines
│       │   ├── docker
│       │   ├── callbacks
│       │   └── security
│       └── tests
├── packages
│   ├── db
│   │   ├── schema
│   │   ├── migrations
│   │   └── queries
│   ├── auth
│   │   ├── permissions.ts
│   │   ├── policies.ts
│   │   └── session.ts
│   ├── contracts
│   │   ├── api
│   │   ├── jobs
│   │   ├── engines
│   │   └── zod
│   ├── worker-client
│   │   ├── signer.ts
│   │   ├── client.ts
│   │   └── retries.ts
│   ├── engine-core
│   │   ├── engine.ts
│   │   ├── capabilities.ts
│   │   └── types.ts
│   ├── engine-postgres
│   │   ├── postgres-engine.ts
│   │   ├── provisioning.ts
│   │   ├── introspection.ts
│   │   ├── table-data.ts
│   │   ├── backup.ts
│   │   └── ssl.ts
│   ├── backup
│   │   ├── providers
│   │   │   ├── local.ts
│   │   │   └── s3-compatible.ts
│   │   ├── encryption.ts
│   │   └── retention.ts
│   ├── agent-tools
│   │   ├── registry.ts
│   │   ├── tools
│   │   └── renderers
│   ├── ui
│   │   ├── components
│   │   └── datadock
│   ├── config
│   │   ├── web-env.ts
│   │   ├── worker-env.ts
│   │   └── shared-env.ts
│   ├── logger
│   │   ├── index.ts
│   │   └── redaction.ts
│   └── crypto
│       ├── hmac.ts
│       ├── encryption.ts
│       ├── random.ts
│       └── constant-time.ts
├── scripts
│   ├── install-local.sh
│   ├── install-worker.sh
│   └── install-next-server.sh
├── docs
│   └── architecture.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

Package responsibilities:

- `apps/web`: Next.js frontend, server components, route handlers, tRPC routers, Better Auth integration, dashboard UI.
- `apps/worker`: Express service, signed endpoint, dockerode integration, job runner, engine drivers.
- `packages/db`: metadata schema, migrations, reusable queries, transaction helpers.
- `packages/auth`: roles, permission checks, session helpers, first-user bootstrap.
- `packages/contracts`: Zod schemas and shared TypeScript types for API, jobs, callbacks, tools, and engines.
- `packages/worker-client`: HMAC signing and worker HTTP client used by the API.
- `packages/engine-core`: engine abstraction and capability definitions.
- `packages/engine-postgres`: PostgreSQL engine implementation.
- `packages/backup`: backup providers, encryption, compression, retention logic.
- `packages/agent-tools`: permissioned tool registry and structured UI result definitions.
- `packages/ui`: shared UI components built on Tailwind CSS and shadcn/ui.
- `packages/config`: environment validation.
- `packages/logger`: structured logging and redaction.
- `packages/crypto`: HMAC, secret generation, encryption helpers.

## 7. Data Model

### Core Entities

- User: authenticated actor managed by Better Auth.
- Workspace: ownership boundary for users, databases, workers, and settings.
- Worker node: a registered worker capable of executing jobs.
- Worker credential: signing secret and callback token metadata for a worker.
- Database engine: a running or provisionable engine server, such as a PostgreSQL container.
- Managed database: a logical database presented to users.
- Database credential: generated database username/password metadata.
- Database permission: database-level user grants inside the platform.
- Job: durable requested operation assigned to a worker.
- Job log: append-only execution event stream.
- Query history: redacted SQL execution history.
- Audit log: security-sensitive business event record.
- Backup config: backup destination, schedule, retention, encryption settings.
- Backup: actual backup artifact metadata.
- Agent thread/message/tool call: agent conversation and tool execution records.
- Connection profile: generated host/port/SSL connection presentation settings.
- Setting/feature flag: workspace or platform-level feature controls.

### Important States

Worker status:

- `pending`
- `active`
- `degraded`
- `offline`
- `revoked`

Engine status:

- `not_created`
- `creating`
- `running`
- `stopped`
- `unhealthy`
- `deleting`
- `deleted`

Database status:

- `creating`
- `ready`
- `updating`
- `backing_up`
- `restoring`
- `deleting`
- `deleted`
- `error`

Job status:

- `queued`
- `dispatching`
- `accepted`
- `running`
- `retrying`
- `succeeded`
- `failed`
- `cancelled`
- `timed_out`

Backup status:

- `pending`
- `running`
- `verified`
- `available`
- `failed`
- `expired`
- `deleted`

## 8. Worker Security Design

### Security Model

The API pushes signed job notifications to the worker. The worker does not poll for arbitrary commands and does not accept job manifests from the request body.

The only public worker job endpoint is:

```http
POST /jobs/run
```

Request body:

```json
{ "jobId": "job_01H..." }
```

The worker must:

1. Read the raw request body without parsing JSON.
2. Validate required signature headers.
3. Check timestamp freshness.
4. Check nonce uniqueness.
5. Look up the configured worker secret.
6. Compute HMAC-SHA256 over the canonical input.
7. Constant-time compare the provided signature.
8. Parse JSON only after signature verification.
9. Validate `{ jobId }` with Zod.
10. Fetch the job manifest from the API using the worker API token.
11. Verify the job is assigned to this worker.
12. Validate the manifest for the specific job type.
13. Execute only registered job handlers.

### Required Headers

```text
x-datadock-worker-id: wrk_...
x-datadock-signature-version: hmac-sha256-v1
x-datadock-secret-version: 1
x-datadock-timestamp: 2026-06-13T10:30:00.000Z
x-datadock-nonce: random-128-bit-base64url
x-datadock-signature: hex-encoded-hmac
content-type: application/json
```

### Canonical Signature Input

The HMAC input is:

```text
METHOD + "\n" +
URL_PATH + "\n" +
TIMESTAMP + "\n" +
NONCE + "\n" +
RAW_REQUEST_BODY
```

Example:

```text
POST
/jobs/run
2026-06-13T10:30:00.000Z
4BtAiBjx7NylKcCtUmmB0w
{"jobId":"job_01HXYZ"}
```

### Freshness and Replay Protection

- Timestamp window: 5 minutes by default.
- Timestamp parser: strict ISO timestamp.
- Clock skew tolerance: configurable, default 300 seconds.
- Nonce entropy: at least 128 bits.
- Nonce cache key: `workerId:nonce`.
- Nonce TTL: freshness window plus 60 seconds.
- MVP nonce store: in-memory LRU.
- Multi-process nonce store: Redis with `SET key value NX EX`.

In-memory nonce storage is acceptable only for single-process workers. A worker running multiple Node processes or multiple replicas must use Redis or another shared atomic store.

### Revocation and Rotation

Revocation:

- API stops dispatching jobs to revoked workers.
- API rejects callbacks from revoked workers.
- Worker registration is marked `revoked`.
- Worker API tokens are invalidated.
- HMAC signing secret versions are marked revoked.

Rotation:

- Secrets are versioned.
- Worker can accept current and previous secret during a short rotation window.
- API signs new requests with the active version after worker acknowledgement.
- Rotation can be out-of-band through `install-worker.sh` or through a signed `rotate_credentials` job.
- All rotation events are audited.

Future upgrade path:

- Add `ed25519-v1` signature version with public-key verification on the worker.
- Add mTLS between API and worker.
- Keep the signature provider interface stable:

```ts
interface WorkerRequestVerifier {
  version: string;
  verify(input: VerificationInput): Promise<VerificationResult>;
}
```

## 9. Job Lifecycle

### Job Creation

The API creates a job in a metadata transaction:

1. Authenticate user.
2. Check workspace membership.
3. Check role and database-level permissions.
4. Validate request with Zod.
5. Resolve target worker.
6. Create `jobs` row with status `queued`.
7. Store validated input JSON.
8. Store idempotency key if provided.
9. Insert audit log for requested operation.
10. Commit transaction.
11. Dispatch to worker.

### Dispatch

The API worker client:

1. Loads worker endpoint and active signing secret.
2. Builds body `{ "jobId": "..." }`.
3. Signs request with HMAC-SHA256.
4. Sends `POST /jobs/run`.
5. Marks job `accepted` if worker returns `202`.
6. Marks job `dispatching` or `retrying` if network failure occurs.

Dispatch failure does not mean job failure. It means the worker has not accepted the job notification.

### Worker Manifest Fetch

After signature verification, the worker calls:

```http
GET /api/internal/workers/jobs/:jobId/manifest
authorization: Bearer <worker-api-token>
```

The API verifies:

- Worker token.
- Worker is active.
- Job exists.
- Job is assigned to that worker.
- Job status can be executed.
- Job has not expired.
- Job manifest hash matches the persisted job input and policy version.

The API returns:

```json
{
  "jobId": "job_01HXYZ",
  "workspaceId": "wsp_01HABC",
  "workerId": "wrk_01HDEF",
  "type": "create_database",
  "input": {},
  "policy": {
    "timeoutSeconds": 300,
    "maxRetries": 1,
    "requiresExclusiveDatabaseLock": false
  },
  "manifestHash": "sha256:...",
  "expiresAt": "2026-06-13T10:35:00.000Z"
}
```

### Execution

The worker:

- Acquires an in-process job lock for `jobId`.
- Optionally acquires a database or engine-level lock.
- Validates the manifest using job-specific Zod schemas.
- Emits `running` status.
- Executes the registered handler.
- Emits structured logs.
- Emits final result or error.

### Callback Events

The worker calls:

```http
POST /api/internal/workers/jobs/:jobId/events
authorization: Bearer <worker-api-token>
```

Event types:

- `status`
- `log`
- `progress`
- `result`
- `error`
- `heartbeat`

The API verifies:

- Worker token.
- Worker is active.
- Job belongs to worker.
- Event sequence is valid.
- Final states are terminal and cannot be overwritten by stale events.

### Retry and Timeout Policy

Default retry policy:

- Dispatch retries: exponential backoff for network errors.
- Execution retries: disabled by default for mutating jobs unless idempotency is proven.
- Backup/list/inspect jobs: safe to retry.
- Create/delete jobs: retry only with idempotency guards and state reconciliation.

Default timeouts:

- Container create: 5 minutes.
- Database create: 2 minutes.
- SQL execution: 30 seconds default, configurable per role.
- Introspection: 30 seconds.
- Backup: configurable by database size, default 1 hour.
- Restore: configurable, default 2 hours.

## 10. PostgreSQL Provisioning Flow

Default PostgreSQL model: one PostgreSQL engine container per worker, many logical databases inside it.

### Create PostgreSQL Database

When a user creates a PostgreSQL database:

1. API checks permission: `database:create` or workspace admin.
2. API validates requested display name, optional schema SQL, isolation mode, connection host, and SSL preference.
3. API creates `create_database` job assigned to a worker.
4. Worker verifies signed request and fetches manifest.
5. Worker calls `PostgresEngine.ensureEngine()`.
6. If no PostgreSQL container exists, worker creates one.
7. Worker waits for `pg_isready`.
8. Worker generates actual database name.
9. Worker generates username.
10. Worker generates secure password.
11. Worker creates role/user.
12. Worker creates database.
13. Worker grants privileges.
14. Worker applies default schema permissions.
15. Worker optionally runs initial SQL/schema.
16. Worker stores result through API callback.
17. API writes `managed_databases`, `database_credentials`, `database_users`, and audit records.
18. UI displays connection information according to user permissions.

### Engine Container Creation

The worker creates PostgreSQL only on first need:

- Image: pinned `postgres:<major>-<minor>` tag.
- Container name: `datadock-pg-<workerId>-default`.
- Docker network: `datadock`.
- Data volume: `datadock-pg-<workerId>-data`.
- Config volume: optional SSL/config mount.
- Labels:
  - `com.datadock.managed=true`
  - `com.datadock.worker_id=<workerId>`
  - `com.datadock.engine=postgres`
  - `com.datadock.engine_id=<engineId>`
- Health check: `pg_isready`.

Recommended container environment:

```text
POSTGRES_USER=datadock_admin
POSTGRES_PASSWORD=<generated strong password>
POSTGRES_DB=postgres
```

The admin password is generated at engine creation time and stored encrypted. It is never shown in the UI.

### Naming

Display names are user-facing and may contain friendly text. Actual PostgreSQL identifiers are generated and constrained.

Example:

- Display name: `Customer Analytics`
- Actual database: `dd_customer_analytics_9d2f`
- Owner username: `dd_customer_analytics_u_1a7c`

Naming rules:

- Lowercase.
- ASCII letters, digits, underscore.
- Max 63 bytes for PostgreSQL identifiers.
- Collision-resistant suffix.
- Do not reuse deleted names unless explicitly requested.

### PostgreSQL Privileges

Default per-database user:

- Can connect to its database.
- Can use and create objects in the `public` schema, unless the workspace policy disables that.
- Does not have superuser, replication, bypass RLS, or createdb privileges.
- Owns the created database if the platform chooses owner-per-database.

Suggested SQL shape:

```sql
CREATE ROLE "dd_example_u_1234" LOGIN PASSWORD '<escaped generated password>';
CREATE DATABASE "dd_example_db_1234" OWNER "dd_example_u_1234";
\connect "dd_example_db_1234";
GRANT CONNECT ON DATABASE "dd_example_db_1234" TO "dd_example_u_1234";
GRANT USAGE, CREATE ON SCHEMA public TO "dd_example_u_1234";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "dd_example_u_1234";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO "dd_example_u_1234";
```

Implementation requirement:

- Use safe identifier quoting for identifiers.
- Use parameterized SQL for values where supported.
- Use trusted escaping helpers for utility statements where PostgreSQL does not allow bind parameters.
- Never concatenate untrusted identifiers or string literals directly.

### Optional Isolated Container Mode

Advanced mode provisions one PostgreSQL container per managed database.

Use cases:

- Stronger resource isolation.
- Easier per-database upgrades/deletions.
- More predictable noisy-neighbor behavior.
- Separate SSL certificates or port exposure.

Trade-offs:

- Higher memory usage.
- More containers to manage.
- More port allocation complexity.
- Slower create and backup operations.

This mode should use the same engine interface and job types but different `isolation_mode` and engine/container mapping.

## 11. SSL/TLS Design

### Key Rule

HTTPS protects browser/API/worker HTTP traffic. HTTPS does not secure PostgreSQL protocol traffic. PostgreSQL client connections need PostgreSQL TLS/SSL.

### Supported PostgreSQL SSL Modes

- `disable`: no PostgreSQL TLS. Suitable for local-only or private trusted networks.
- `require`: encrypted PostgreSQL connection without full certificate/hostname verification.
- `verify-ca`: encrypted connection and CA verification.
- `verify-full`: encrypted connection, CA verification, and hostname verification.

Recommended defaults:

- Local/private development: `sslmode=disable`.
- Public VPS exposure: `sslmode=require` minimum.
- Production public domain: `sslmode=verify-full` with a CA certificate.

### PostgreSQL Container TLS

The worker can configure PostgreSQL with:

- `server.crt`
- `server.key`
- optional CA certificate
- `postgresql.conf` settings:

```text
ssl = on
ssl_cert_file = '/var/lib/postgresql/certs/server.crt'
ssl_key_file = '/var/lib/postgresql/certs/server.key'
```

Permissions:

- Private key must be owned by the PostgreSQL user inside the container.
- Private key must not be world-readable.
- Certificate files should be mounted read-only where possible.

### Connection String Generation

The generated connection string must include the configured SSL mode:

```text
postgresql://username:password@db.example.com:5432/database?sslmode=require
```

For `verify-full`, the UI should also present:

- CA certificate download or path guidance.
- Hostname used in certificate validation.
- psql example with `sslrootcert`.

Example:

```text
psql "postgresql://username:password@db.example.com:5432/database?sslmode=verify-full&sslrootcert=/path/to/ca.crt"
```

### Reverse Proxy and TCP Proxy Limits

- HTTP reverse proxies do not proxy PostgreSQL protocol.
- TCP proxies such as HAProxy, Nginx stream, Caddy layer4, or cloud TCP load balancers may proxy PostgreSQL.
- TLS pass-through preserves PostgreSQL TLS from client to database.
- TLS termination at a proxy changes the trust boundary and requires secure proxy-to-PostgreSQL transport.
- The UI must not imply that dashboard HTTPS secures direct database client connections.

## 12. Backup and Restore Design

### Backup Providers

Supported providers:

- Local disk.
- S3-compatible object storage:
  - AWS S3.
  - Cloudflare R2.
  - MinIO.
  - Backblaze B2.

Provider interface:

```ts
interface BackupProvider {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(input: GetObjectInput): Promise<NodeJS.ReadableStream>;
  listObjects(input: ListObjectsInput): Promise<ListObjectsResult>;
  deleteObject(input: DeleteObjectInput): Promise<void>;
  createDownloadUrl?(input: CreateDownloadUrlInput): Promise<string>;
}
```

### PostgreSQL Backup Strategy

Default logical backups:

- `pg_dump --format=custom` for one database.
- `pg_restore --list` for verification.
- `pg_restore` for restore.

Optional global backup:

- `pg_dumpall --globals-only` for roles and grants.

Recommended artifact structure:

```text
backups/
  <workspaceId>/
    <databaseId>/
      2026/
        06/
          13/
            backup_<backupId>.dump.zst.enc
            backup_<backupId>.manifest.json
```

Manifest fields:

- backup ID.
- database ID.
- engine type.
- engine version.
- created at.
- dump format.
- compression.
- encryption.
- checksum.
- size.
- storage provider.
- object key/path.
- verification result.

### Compression and Encryption

Compression:

- MVP: gzip.
- Preferred hardening: zstd.

Encryption:

- Optional MVP.
- Recommended production: AES-256-GCM or age public-key encryption.
- Store encryption metadata separately from encryption keys.
- Never store object storage credentials inside backup artifacts.

Checksum:

- SHA-256 for every artifact.
- Store checksum in metadata and backup manifest.

### Scheduled Backups

Scheduled backup flow:

1. Scheduler selects due `backup_configs`.
2. API creates `backup_database` job.
3. Worker performs backup.
4. Worker uploads artifact to provider.
5. Worker verifies artifact.
6. API stores backup metadata.
7. Retention cleanup job deletes expired backups.

Cron source:

- MVP: Next.js server cron or a lightweight scheduler process in all-in-one mode.
- Vercel mode: Vercel cron can call API endpoint to enqueue due backup jobs.
- VPS mode: systemd timer or app scheduler.

Retention policies:

- Keep last N backups.
- Keep daily backups for N days.
- Keep weekly backups for N weeks.
- Keep monthly backups for N months.
- Delete failed/incomplete artifacts after grace period.

### Restore

Supported restore targets:

- Same database after confirmation.
- New database.

Restore to same database:

- Requires `backup_restore` permission.
- Requires destructive confirmation.
- Recommended flow creates a pre-restore backup first.
- Locks database operations during restore.

Restore to new database:

- Safer default.
- Creates a new managed database.
- Restores dump into new database.
- Generates new credentials or maps source credentials depending on policy.

Verification:

- `pg_restore --list` before restore.
- Optional restore to temporary database and run smoke queries.
- Record verification logs.

### Backup Download

For S3-compatible providers:

- Prefer short-lived presigned download URLs when provider supports them.
- Audit every generated URL.
- Expire quickly, for example 5 minutes.

For local worker disk:

- API creates a `prepare_backup_download` or `list_backups` job.
- Worker streams through an authenticated API endpoint or publishes a short-lived worker download URL.
- Avoid permanent public file paths.

## 13. Dashboard UX Architecture

The dashboard is a work-focused operational interface, not a marketing site.

Primary areas:

- Overview.
- Databases.
- Workers.
- Backups.
- Audit logs.
- Settings.
- Agent.

### Overview

Metrics:

- Total databases.
- Active connections.
- Database sizes.
- Recent activity.
- Recent queries.
- Backup status.
- Worker health.
- Storage usage.
- Engine/container status.

Implementation:

- Server components fetch stable aggregate data.
- Client components poll or subscribe to job/worker status.
- Cards are used for individual metrics only, not nested page sections.

### Database List

Columns:

- Database name.
- Engine type.
- Owner.
- Size.
- Created date.
- Status.
- Connection host.
- Last backup status.
- Actions.

Actions:

- Open.
- Credentials.
- Reset password.
- Backup.
- Restore.
- Delete.

Implementation:

- TanStack Table with server-side pagination, sorting, filtering.
- Row actions permission-aware.
- Destructive actions use confirmation dialogs and audit preflight.

### Database Detail

Tabs:

- Overview.
- Tables.
- Views.
- Functions.
- Extensions.
- Users/Roles.
- SQL editor.
- Query history.
- Backups.
- Settings.
- Connection information.

Each tab should use scoped database permissions and avoid loading credentials unless explicitly requested.

## 14. Table Editor Architecture

The table editor is a spreadsheet-style interface backed by safe server-side operations.

### Capabilities

- Pagination.
- Sorting.
- Filtering.
- Search.
- Inline editing.
- Insert row.
- Modal insert form.
- Delete row.
- Multi-select.
- Bulk delete.
- Copy cell.
- Copy row.
- Nullable/default display.
- Primary-key awareness.
- JSON/JSONB editor.
- Clear loading and error states.
- Optimistic UI for safe mutations.

### Server-Side Data Access

The API never accepts raw table SQL from the table editor. It accepts structured operations:

- `schemaName`
- `tableName`
- `columns`
- `filters`
- `sort`
- `pagination`
- `rowIdentity`
- `values`

The engine driver compiles structured operations into SQL using:

- Safe identifier quoting.
- Parameterized values.
- Allowlisted operators.
- Maximum row limits.
- Statement timeout.

### Row Identity

Preferred update/delete identity:

- Primary key columns.

Fallback:

- PostgreSQL `ctid`, only with warning and only for immediate operations.

Rules:

- If no primary key exists, inline editing should show a warning.
- Bulk delete without a primary key requires stronger confirmation.
- `ctid` cannot be stored as a stable identifier across vacuum/rewrite operations.

### JSON/JSONB Editing

- Use Monaco or a focused JSON editor in modal form.
- Validate JSON client-side and server-side.
- Preserve null vs empty object/array.
- Show database errors without exposing internals.

### Optimistic UI

Safe optimistic cases:

- Single-cell update with primary key.
- Insert where server returns canonical row.
- Delete by primary key.

Unsafe optimistic cases:

- No primary key.
- Generated columns.
- Triggers that mutate data.
- Complex defaults.

For unsafe cases, wait for server confirmation and refetch the page.

## 15. SQL Editor Architecture

The SQL editor uses Monaco Editor with PostgreSQL syntax highlighting and schema-aware assistance where possible.

### Features

- Query execution.
- Result grid.
- Query duration.
- Affected rows.
- Error messages.
- Copy results.
- Export results.
- Query history.
- Query favorites.
- Safe confirmation for destructive statements.
- Read-only execution mode.
- Cancellation support where feasible.

### Read-Only SQL

Read-only execution should:

- Require `query` permission.
- Run with per-database user credentials where possible.
- Use `BEGIN READ ONLY`.
- Set `statement_timeout`.
- Set `idle_in_transaction_session_timeout`.
- Limit rows returned by default.
- Reject obvious non-read-only statements before execution.

PostgreSQL examples:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30000ms';
SET LOCAL idle_in_transaction_session_timeout = '30000ms';
-- user query
COMMIT;
```

### Mutating SQL

Mutating SQL should:

- Require `mutate_data` or `manage_schema` depending on statement type.
- Require explicit confirmation.
- Be audited.
- Store redacted query history.
- Use statement timeout.
- Prefer a transaction wrapper where appropriate.

### Query Classification

MVP:

- Conservative SQL classification.
- Read-only allowlist for `SELECT`, `WITH` that resolves to read-only, `SHOW`, `EXPLAIN`.
- Treat unknown statements as mutating.

Hardening:

- PostgreSQL parser integration.
- Dedicated read-only database role.
- Database-level safeguards such as default transaction read-only for read-only operations.

### Query History

Record:

- User.
- Database.
- Query hash.
- Redacted SQL.
- Duration.
- Rows returned or affected.
- Error code.
- Risk classification.
- Timestamp.

Do not store raw secrets that appear in SQL. Redaction is best-effort and should be clearly documented.

## 16. Agentic System Architecture

The agent is a permissioned tool-calling operator inside the dashboard. It is not a shell, not a database superuser, and not an unrestricted SQL executor.

### Agent Goals

- Create a database from a prompt.
- Delete a database from a prompt after confirmation.
- Find data from a specific database.
- Generate charts, summaries, and UI views from query results.
- Explain schema.
- Suggest indexes.
- Generate SQL.
- Help create tables.
- Help debug errors.
- Help configure backups.

### Safety Principles

- Agent tools are typed functions.
- Tool inputs are validated with Zod.
- Tool outputs are validated with Zod.
- Every tool has a required permission.
- Every tool has a risk level.
- Destructive tools require explicit user confirmation.
- Mutating SQL requires confirmation and permission.
- Agent defaults to read-only SQL.
- Agent scope is limited to selected workspace and database.
- Agent logs every tool call.
- Agent shows planned actions before execution.
- Agent supports dry-run mode.
- Agent never reveals secrets unless the user explicitly requests credentials and has permission.
- Agent returns structured UI output, not just raw rows.

### Agent Runtime Flow

```mermaid
sequenceDiagram
  participant U as User
  participant A as Agent Runtime
  participant T as Tool Registry
  participant API as tRPC/API
  participant DB as Metadata/Managed DB

  U->>A: Prompt in database scope
  A->>T: Load tools allowed by scope and permissions
  A-->>U: Planned actions
  U->>A: Confirm if needed
  A->>API: Execute typed tool
  API->>API: Auth, Zod, permission, audit
  API->>DB: Query or create job
  API-->>A: Structured result
  A-->>U: Table/chart/cards/summary
```

### Internal MCP-Like Tool Definition

```ts
type RiskLevel = "low" | "medium" | "high" | "critical";

interface AgentToolDefinition<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  outputSchema: z.ZodType<O>;
  requiredPermission: Permission;
  riskLevel: RiskLevel;
  confirmation: "never" | "destructive" | "always";
  auditEvent: string;
  execute(ctx: AgentToolContext, input: I): Promise<O>;
}
```

### Tool Catalog

| Tool | Required permission | Risk | Confirmation | Audit event |
| --- | --- | --- | --- | --- |
| `listDatabases` | `view` | low | never | `agent.tool.list_databases` |
| `createDatabase` | workspace admin or database create | high | always | `agent.tool.create_database` |
| `deleteDatabase` | `delete_database` | critical | always | `agent.tool.delete_database` |
| `getDatabaseSchema` | `view` | low | never | `agent.tool.get_database_schema` |
| `getTableRows` | `query` | medium | never | `agent.tool.get_table_rows` |
| `runReadonlyQuery` | `query` | medium | never | `agent.tool.run_readonly_query` |
| `runMutationQuery` | `mutate_data` or `manage_schema` | high | always | `agent.tool.run_mutation_query` |
| `createBackup` | `backup_restore` | high | destructive | `agent.tool.create_backup` |
| `restoreBackup` | `backup_restore` | critical | always | `agent.tool.restore_backup` |
| `explainQuery` | `query` | low | never | `agent.tool.explain_query` |
| `inspectContainer` | admin | medium | never | `agent.tool.inspect_container` |
| `getWorkerHealth` | admin | low | never | `agent.tool.get_worker_health` |

### Structured UI Outputs

Agent responses can render:

- Tables.
- Charts.
- Metric cards.
- Timelines.
- JSON inspectors.
- SQL blocks.
- Schema diagrams.
- Summaries.
- Action plans.
- Confirmation forms.

Output schema example:

```ts
const AgentUiBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("summary"), markdown: z.string() }),
  z.object({ type: z.literal("table"), columns: z.array(z.string()), rows: z.array(z.record(z.unknown())) }),
  z.object({ type: z.literal("chart"), chartType: z.enum(["bar", "line", "pie"]), data: z.array(z.record(z.unknown())) }),
  z.object({ type: z.literal("json"), value: z.unknown() }),
  z.object({ type: z.literal("sql"), dialect: z.literal("postgres"), sql: z.string() }),
  z.object({ type: z.literal("confirmation"), actionId: z.string(), label: z.string(), risk: z.string() })
]);
```

## 17. API and tRPC Router Design

tRPC is used for authenticated browser/API interactions. Internal worker callbacks use REST-style route handlers because workers are service clients, not browser sessions.

### Routers

`auth`:

- Current session.
- First-user bootstrap status.
- User profile.
- 2FA settings.

`users`:

- List workspace users.
- Invite user.
- Change role.
- Disable user.

`workers`:

- Register worker.
- Rotate worker secret.
- Revoke worker.
- Get worker health.
- List worker events.

`databases`:

- List databases.
- Create database.
- Delete database.
- Reset password.
- Get connection info.
- Update connection profile.

`engines`:

- List engines.
- Create engine container.
- Stop/restart engine.
- Inspect engine.
- Configure SSL.

`schema`:

- Introspect database schema.
- List schemas/tables/views/functions/extensions.
- Get table structure.
- Create table preview.
- Create table execution.

`tableData`:

- Fetch rows.
- Insert row.
- Update row.
- Delete rows.
- Export rows.

`sql`:

- Run read-only query.
- Run mutation query.
- Cancel query.
- Query history.
- Favorites.

`backups`:

- List backup configs.
- Create/update backup config.
- Run manual backup.
- Restore backup.
- List backups.
- Download backup.
- Retention cleanup status.

`agent`:

- Create thread.
- Send message.
- Confirm action.
- Cancel action.
- List tool calls.

`settings`:

- Workspace settings.
- Feature flags.
- Connection defaults.
- SSL defaults.

`auditLogs`:

- List audit logs.
- Filter audit logs.
- Export audit logs.

### API Design Requirements

- Every route validates input with Zod.
- Every route checks authentication.
- Every route checks authorization.
- Every mutating route writes audit logs.
- Every job-creating route returns job ID.
- Long-running operations never block the request thread.
- Secrets are redacted by default.

## 18. Worker Endpoint Design

### Public Worker Endpoints

`GET /healthz`

- Returns process health.
- Does not require HMAC.
- Does not expose secrets.
- Safe for load balancers.

`GET /readyz`

- Checks Docker socket availability and local configuration.
- May be restricted by IP allowlist.
- Does not expose secrets.

`POST /jobs/run`

- Requires HMAC verification.
- Body contains only `jobId`.
- Returns `202 Accepted` after accepting notification.
- Does not execute inline before response unless the job is trivial.

### Internal Worker Modules

```text
apps/worker/src
├── http
│   ├── server.ts
│   ├── raw-body.ts
│   └── routes.ts
├── security
│   ├── verify-signed-request.ts
│   ├── nonce-store.ts
│   └── worker-token.ts
├── jobs
│   ├── registry.ts
│   ├── runner.ts
│   ├── locks.ts
│   └── handlers
├── engines
│   ├── registry.ts
│   └── postgres.ts
├── docker
│   ├── client.ts
│   ├── containers.ts
│   ├── networks.ts
│   └── volumes.ts
└── callbacks
    ├── api-client.ts
    └── events.ts
```

### Worker Job Types

Supported job types:

- `create_database`
- `delete_database`
- `reset_database_password`
- `create_database_user`
- `delete_database_user`
- `grant_permissions`
- `revoke_permissions`
- `create_engine_container`
- `stop_engine_container`
- `restart_engine_container`
- `inspect_engine_container`
- `run_sql`
- `run_readonly_sql`
- `introspect_schema`
- `fetch_table_rows`
- `insert_table_row`
- `update_table_row`
- `delete_table_rows`
- `create_table`
- `backup_database`
- `restore_database`
- `list_backups`
- `test_connection`
- `rotate_credentials`
- `configure_ssl`

The worker must reject unknown job types.

## 19. Engine Plugin Architecture

### Engine Interface

```ts
export interface DatabaseEngine {
  engineType: EngineType;
  capabilities: EngineCapabilities;

  ensureEngine(ctx: EngineContext, input: EnsureEngineInput): Promise<EngineInstance>;
  createDatabase(ctx: EngineContext, input: CreateDatabaseInput): Promise<CreateDatabaseResult>;
  deleteDatabase(ctx: EngineContext, input: DeleteDatabaseInput): Promise<void>;
  createUser(ctx: EngineContext, input: CreateUserInput): Promise<CreateUserResult>;
  deleteUser(ctx: EngineContext, input: DeleteUserInput): Promise<void>;
  resetPassword(ctx: EngineContext, input: ResetPasswordInput): Promise<ResetPasswordResult>;
  getConnectionInfo(ctx: EngineContext, input: ConnectionInfoInput): Promise<ConnectionInfo>;
  introspectSchema(ctx: EngineContext, input: IntrospectSchemaInput): Promise<DatabaseSchema>;
  listTables(ctx: EngineContext, input: ListTablesInput): Promise<TableSummary[]>;
  getTableRows(ctx: EngineContext, input: GetTableRowsInput): Promise<TableRowsResult>;
  insertRow(ctx: EngineContext, input: InsertRowInput): Promise<RowMutationResult>;
  updateRow(ctx: EngineContext, input: UpdateRowInput): Promise<RowMutationResult>;
  deleteRows(ctx: EngineContext, input: DeleteRowsInput): Promise<RowMutationResult>;
  executeSql(ctx: EngineContext, input: ExecuteSqlInput): Promise<ExecuteSqlResult>;
  backup(ctx: EngineContext, input: BackupInput): Promise<BackupResult>;
  restore(ctx: EngineContext, input: RestoreInput): Promise<RestoreResult>;
  getStats(ctx: EngineContext, input: StatsInput): Promise<EngineStats>;
  configureSsl(ctx: EngineContext, input: ConfigureSslInput): Promise<ConfigureSslResult>;
}
```

### Capability Matrix

Each engine declares capabilities:

```ts
export interface EngineCapabilities {
  supportsMultipleDatabasesPerServer: boolean;
  supportsSchemas: boolean;
  supportsUsers: boolean;
  supportsRoles: boolean;
  supportsSqlEditor: boolean;
  supportsTableEditor: boolean;
  supportsLogicalBackup: boolean;
  supportsPointInTimeRecovery: boolean;
  supportsSsl: boolean;
  supportsExtensions: boolean;
}
```

### PostgreSQL Driver Requirements

- Use admin connection only for provisioning and engine management.
- Use per-database credentials for user operations where possible.
- Use parameterized SQL for values.
- Quote identifiers safely.
- Separate identifiers from values.
- Never concatenate untrusted values directly into SQL.
- Restrict query timeouts.
- Limit returned rows.
- Add `statement_timeout`.
- Add cancellation support where feasible.
- Avoid superuser operations unless required for engine setup.

### Future Engines

MySQL/MariaDB:

- One container can support many databases.
- Users and grants map naturally.
- Backup through `mysqldump`.

Redis:

- No true logical databases with separate users in the same way.
- Likely default to one container per managed Redis instance.
- ACL support can provide user isolation in newer Redis.

MongoDB:

- One server can support many databases.
- Users scoped to databases.
- Backup through `mongodump` and `mongorestore`.

ClickHouse:

- One server can support many databases.
- Users and roles supported.
- Backup depends on storage and engine configuration.

Engine drivers must expose only capabilities that are implemented and tested.

## 20. Permissions Model

### Roles

Workspace roles:

- Owner.
- Admin.
- Member.
- Read-only.

Rules:

- First user becomes Owner.
- Owner can manage workspace, users, workers, settings, and all databases.
- Admin can manage databases and workers but cannot transfer ownership.
- Member needs database-level grants for sensitive actions.
- Read-only can view permitted databases and run read-only queries if granted.

### Database-Level Permissions

- `view`
- `query`
- `mutate_data`
- `manage_schema`
- `manage_credentials`
- `backup_restore`
- `delete_database`

### Permission Matrix

| Action | Owner | Admin | Member | Read-only | Database permission |
| --- | --- | --- | --- | --- | --- |
| View database | yes | yes | if granted | if granted | `view` |
| Run read-only query | yes | yes | if granted | if granted | `query` |
| Mutate data | yes | yes | if granted | no | `mutate_data` |
| Manage schema | yes | yes | if granted | no | `manage_schema` |
| Reveal credentials | yes | yes | if granted | no | `manage_credentials` |
| Reset password | yes | yes | if granted | no | `manage_credentials` |
| Backup/restore | yes | yes | if granted | no | `backup_restore` |
| Delete database | yes | yes | if granted | no | `delete_database` |
| Manage worker | yes | yes | no | no | admin role |

### Authorization Flow

```ts
async function requireDatabasePermission(ctx: AuthContext, databaseId: string, permission: DatabasePermission) {
  const session = await requireSession(ctx);
  const membership = await getWorkspaceMembership(session.userId, ctx.workspaceId);

  if (membership.role === "owner" || membership.role === "admin") {
    return { allowed: true, source: "workspace_role" };
  }

  const grant = await getDatabasePermission(session.userId, databaseId, permission);
  if (!grant) {
    throw new ForbiddenError(`Missing database permission: ${permission}`);
  }

  return { allowed: true, source: "database_grant" };
}
```

## 21. Audit Logging

Audit logs are append-only records of sensitive or important actions.

### Events to Audit

- Login/logout/security events from Better Auth where available.
- User invite, role change, disable.
- Worker registration, revocation, secret rotation.
- Database create/delete.
- Credential reveal.
- Password reset.
- User/role creation in database engine.
- Permission grant/revoke.
- SQL mutation execution.
- Destructive SQL confirmation.
- Backup create/delete/download.
- Restore.
- SSL configuration change.
- Agent tool call.
- Agent confirmation.
- Failed authorization attempt for sensitive action.

### Audit Record Fields

- `id`
- `workspace_id`
- `actor_user_id`
- `actor_type`
- `action`
- `target_type`
- `target_id`
- `risk_level`
- `ip_address`
- `user_agent`
- `correlation_id`
- `request_id`
- `metadata_redacted`
- `created_at`

### Redaction

Never store:

- Raw database passwords.
- Worker signing secrets.
- Auth secrets.
- S3 secret keys.
- Full connection strings with passwords.

Store:

- Secret reference IDs.
- Last 4 characters where useful.
- Hashes for correlation.
- Explicit `redacted: true` markers.

## 22. Secrets Management

### Secret Categories

- Better Auth secret.
- Session/cookie signing secret.
- Metadata database URL.
- Worker HMAC signing secrets.
- Worker API callback tokens.
- Docker engine admin credentials.
- Managed database user passwords.
- Backup provider credentials.
- Backup encryption keys.
- Agent provider API keys, if used.

### Storage Rules

- Platform-level runtime secrets live in environment variables.
- User/database/worker secrets stored in metadata DB must be encrypted at rest.
- Use envelope encryption:
  - Root key from environment or external secret manager.
  - Data encryption keys per secret or group.
  - AES-256-GCM with authenticated metadata.
- Store secret metadata:
  - secret ID.
  - version.
  - created at.
  - rotated at.
  - last used at.
  - revoked at.

### Credential Reveal

Credential reveal flow:

1. User clicks reveal.
2. API checks `manage_credentials`.
3. API requires recent session or 2FA challenge if enabled.
4. API decrypts secret.
5. API writes audit log.
6. API returns secret once.
7. UI avoids persisting it in client state longer than necessary.

### Rotation

Rotation targets:

- Managed database passwords.
- Worker HMAC secret.
- Worker API token.
- Backup provider credentials.
- Encryption root key.

Database password rotation:

- Generate new password.
- Update database role.
- Store encrypted new password.
- Invalidate old display where possible.
- Audit rotation.

Worker secret rotation:

- Create new credential version.
- Update worker config.
- Confirm worker accepts new version.
- Switch API signing version.
- Revoke old version after grace period.

## 23. Failure Handling

### Idempotency

Every job should have an idempotency strategy.

Examples:

- `create_engine_container`: check Docker labels and engine metadata before creating.
- `create_database`: check whether actual database and role already exist.
- `delete_database`: tolerate already-deleted database if metadata is consistent.
- `backup_database`: use unique backup ID and avoid overwriting artifacts.
- `restore_database`: use restore lock and explicit target state.

### Locks

Lock scopes:

- Worker job lock by `jobId`.
- Engine-level lock for container lifecycle.
- Database-level lock for restore/delete/schema operations.
- Backup lock for one backup per database at a time.

Metadata locks can use PostgreSQL advisory locks. Worker-local locks prevent duplicate execution inside one worker process.

### Partial Failure Recovery

Create database partial failure:

- If role created but database failed, cleanup role if safe.
- If database created but metadata failed, reconciliation job detects unmanaged database by labels/comment metadata or naming convention.
- If credentials stored but grants failed, mark database `error` and expose repair action.

Delete database partial failure:

- Mark `deleting`.
- Revoke connections.
- Drop database.
- Drop generated users.
- Mark `deleted`.
- Retain audit logs and backup metadata.

Backup partial failure:

- Mark backup `failed`.
- Delete incomplete artifact when possible.
- Keep logs.
- Do not update last-successful backup timestamp.

Restore partial failure:

- Prefer restore into new database.
- For same-database restore, create pre-restore backup.
- Keep restore logs.
- Mark database `error` if final state is uncertain.

### Reconciliation

Periodic reconciliation checks:

- Worker heartbeat status.
- Docker containers with DataDock labels.
- Engine container health.
- Metadata engine status vs Docker status.
- Backup artifact existence vs metadata.
- Jobs stuck in non-terminal states.
- Database existence for managed records.

## 24. Observability

### Structured Logging

Use structured logs in API and worker:

- JSON format in production.
- Pretty format in development.
- Correlation ID.
- Request ID.
- Job ID.
- Worker ID.
- Workspace ID.
- Database ID.
- User ID where applicable.

Use redaction for:

- Passwords.
- Tokens.
- Secrets.
- Connection strings.
- Authorization headers.

### Metrics

Collect:

- Job counts by type/status.
- Job duration.
- Worker heartbeat lag.
- Engine health.
- Database count.
- Backup success/failure.
- Backup duration and size.
- Query duration.
- Query error rate.
- API request latency.
- Worker callback latency.

### Health Checks

API:

- `GET /api/healthz`: process alive.
- `GET /api/readyz`: metadata DB reachable.

Worker:

- `GET /healthz`: process alive.
- `GET /readyz`: Docker reachable, API callback configured, local dependencies available.

### Error Reporting

Recommended integrations:

- OpenTelemetry for traces and metrics.
- Sentry or similar for application errors.
- Pino for logs.

The platform should run without third-party observability services, but provide hooks.

## 25. Testing Plan

### Unit Tests

- HMAC signing and verification.
- Timestamp freshness.
- Nonce replay protection.
- Worker secret rotation.
- Permission checks.
- Zod contract validation.
- SQL identifier quoting.
- SQL literal escaping helpers.
- Query classification.
- Backup retention calculation.
- Agent tool risk and confirmation rules.

### Integration Tests

- PostgreSQL container lifecycle.
- PostgreSQL database creation.
- Role/user creation.
- Password reset.
- Table introspection.
- Table row fetch/insert/update/delete.
- Read-only SQL enforcement.
- Mutating SQL confirmation path.
- Backup and restore with local provider.
- Backup and restore with MinIO for S3-compatible provider.
- Worker job execution and callbacks.
- Job retry/reconciliation.

### API Tests

- tRPC routers with authenticated contexts.
- Authorization matrix.
- Worker callback endpoints.
- Manifest fetch endpoint.
- Audit logs for sensitive actions.
- Secret redaction.

### Browser Tests

Use Playwright for:

- First-user bootstrap.
- Login/logout.
- Worker registration.
- Create PostgreSQL database.
- Reveal credentials with audit.
- Schema browser.
- Table editor CRUD.
- SQL editor read-only query.
- Manual backup.
- Restore into new database.
- Agent read-only schema explanation.
- Agent destructive confirmation flow.

### Migration Tests

- Apply migrations from empty database.
- Apply migrations across sample historical states.
- Roll forward with seed data.
- Verify Better Auth tables coexist with platform tables.

## 26. MVP Roadmap

### Phase 0: Foundation

- pnpm monorepo.
- Shared TypeScript config.
- Next.js app shell.
- Tailwind CSS and shadcn/ui.
- Better Auth email/password.
- First-user owner bootstrap.
- Platform metadata schema and migrations.
- Express worker skeleton.
- Worker signed request verification.
- Worker callback token verification.

### Phase 1: PostgreSQL Lifecycle

- Worker registration.
- PostgreSQL shared engine container.
- Create database.
- Delete database.
- Reset password.
- Connection info generation.
- Worker health.
- Job logs and status UI.
- Audit logs.

### Phase 2: Dashboard Core

- Overview.
- Database list.
- Database detail.
- Schema browser.
- Connection info panel.
- Query history.
- Basic SQL editor.

### Phase 3: Table Editor

- Table rows.
- Pagination.
- Sorting/filtering.
- Insert/update/delete by primary key.
- JSON editing.
- Error states.

### Phase 4: Backups

- Manual local backup.
- Manual restore into new database.
- Scheduled backups.
- S3-compatible provider.
- Retention policy.
- Backup verification.

### Phase 5: Agent MVP

- Tool registry.
- Read-only scoped tools.
- Schema explanation.
- SQL generation.
- Read-only query execution.
- Backup configuration helper.
- Confirmation framework.

## 27. Production Hardening Roadmap

- Enforce HTTPS for remote worker URLs.
- Add Redis nonce store for multi-process worker deployment.
- Add mTLS option.
- Add Ed25519 signature option.
- Add external secret manager integration.
- Add backup encryption by default.
- Add restore rehearsal.
- Add detailed reconciliation dashboard.
- Add database resource limits.
- Add per-database isolated container mode.
- Add Postgres TLS certificate automation.
- Add 2FA enforcement policies.
- Add IP allowlists for worker and dashboard.
- Add audit log export and retention policies.
- Add OpenTelemetry traces.
- Add rate limiting with Redis.
- Add query cancellation.
- Add parser-backed SQL classification.
- Add MySQL/MariaDB engine.
- Add Redis engine.
- Add MongoDB engine.
- Add ClickHouse engine.

## 28. Open Questions and Tradeoffs

1. Metadata database placement:
   - Local metadata Postgres simplifies install.
   - External metadata Postgres improves durability.

2. Default PostgreSQL port exposure:
   - Exposing ports improves usability.
   - Private-only ports reduce attack surface.

3. Backup encryption default:
   - Optional encryption is easier for MVP.
   - Default encryption is safer for production.

4. Agent model provider:
   - User-provided API key keeps platform self-hosted.
   - Bundled provider integration improves UX but adds secrets and policy concerns.

5. SQL parser:
   - Conservative regex/statement allowlist is fast to build.
   - Parser-backed classification is safer.

6. Isolated database containers:
   - Shared PostgreSQL server is efficient and should be default.
   - Per-database containers improve isolation but increase complexity.

7. Backup download path:
   - Presigned URLs are best for object storage.
   - Local disk backups require worker/API streaming design.

8. Worker accessibility:
   - Public worker endpoint with HMAC is simple for Vercel.
   - Private worker behind VPN is safer but requires self-hosted Next.js or a tunnel.

## 29. Example Environment Variables

### Shared

```env
NODE_ENV=production
DATADOCK_ENV=production
DATADOCK_PUBLIC_URL=https://app.example.com
LOG_LEVEL=info
```

### Next.js App

```env
DATABASE_URL=postgresql://datadock_meta:secret@127.0.0.1:5432/datadock_metadata
BETTER_AUTH_SECRET=replace-with-strong-secret
BETTER_AUTH_URL=https://app.example.com
DATADOCK_ENCRYPTION_KEY=base64-32-byte-root-key
DATADOCK_WORKER_CALLBACK_TOKEN_PEPPER=replace-with-strong-secret
DATADOCK_DEFAULT_WORKER_ID=wrk_01H...
DATADOCK_REQUIRE_HTTPS_WORKERS=true
DATADOCK_COOKIE_SECURE=true
DATADOCK_RATE_LIMIT_REDIS_URL=
SENTRY_DSN=
OTEL_EXPORTER_OTLP_ENDPOINT=
```

### Worker

```env
WORKER_ID=wrk_01H...
WORKER_NAME=primary-vps
WORKER_PUBLIC_URL=https://worker.example.com
WORKER_BIND_HOST=0.0.0.0
WORKER_PORT=8787
WORKER_HMAC_SECRET_VERSION=1
WORKER_HMAC_SECRET=base64-worker-secret
WORKER_API_URL=https://app.example.com
WORKER_API_TOKEN=worker-callback-token
WORKER_NONCE_STORE=memory
WORKER_REDIS_URL=
DOCKER_HOST=unix:///var/run/docker.sock
DATADOCK_DOCKER_NETWORK=datadock
DATADOCK_CONNECTION_HOST=db.example.com
DATADOCK_DEFAULT_POSTGRES_IMAGE=postgres:16.4
DATADOCK_BACKUP_LOCAL_ROOT=/var/lib/datadock/backups
DATADOCK_REQUIRE_HTTPS_API=true
```

### Backup S3-Compatible

```env
BACKUP_S3_ENDPOINT=https://s3.amazonaws.com
BACKUP_S3_REGION=us-east-1
BACKUP_S3_BUCKET=datadock-backups
BACKUP_S3_ACCESS_KEY_ID=replace
BACKUP_S3_SECRET_ACCESS_KEY=replace
BACKUP_S3_FORCE_PATH_STYLE=false
```

## 30. Example Install Script Behavior

The scripts are operational installers, not hidden magic. They should print what they will do, ask before changing system-level configuration, and write a `.env` file or systemd unit only after confirmation.

### `scripts/install-local.sh`

Behavior:

1. Check OS and shell.
2. Check Docker installation.
3. Offer Docker install guidance if missing.
4. Check Node.js and pnpm.
5. Generate local secrets.
6. Ask whether to create metadata PostgreSQL container.
7. Start metadata PostgreSQL if requested.
8. Run migrations.
9. Configure local worker with Docker socket access.
10. Start worker.
11. Start Next.js app.
12. Print dashboard URL.
13. Print generated environment variables and where they were saved.

Example output:

```text
DataDock local installer

Docker: found
pnpm: found
Metadata PostgreSQL: created container datadock-metadata
Worker: listening on http://127.0.0.1:8787
Dashboard: http://localhost:3000

Environment written to:
  .env.local
  apps/worker/.env
```

### `scripts/install-worker.sh`

Behavior:

1. Check Docker.
2. Ask for worker ID.
3. Ask for worker secret or generate one.
4. Ask for API URL.
5. Ask for worker public URL.
6. Ask for connection host/domain used in database connection strings.
7. Ask whether backup storage is local, S3-compatible, or both.
8. Collect S3/R2/MinIO/B2 credentials if selected.
9. Test API callback token.
10. Test Docker access.
11. Optionally list available backups.
12. Optionally restore platform or managed database state from backup.
13. Start worker service.
14. Optionally install systemd unit.

Example prompts:

```text
API URL [https://app.example.com]:
Worker public URL [https://worker.example.com]:
Connection host for generated database URLs [db.example.com]:
Enable S3-compatible backups? [y/N]:
Install systemd service? [Y/n]:
```

### `scripts/install-next-server.sh`

Behavior:

1. Check Node.js and pnpm.
2. Ask for platform metadata database URL.
3. Generate auth secret if missing.
4. Generate encryption root key if missing.
5. Configure public app URL.
6. Configure worker registration.
7. Configure backup retrieval API path.
8. Run migrations.
9. Build Next.js app.
10. Start app using systemd or process manager.
11. Print first-user bootstrap URL.

Example output:

```text
DataDock Next.js server installer

Metadata DB: reachable
Migrations: applied
Worker registration: pending
App URL: https://app.example.com
Bootstrap: https://app.example.com/setup
```

## 31. Example Database Schemas

The exact schema can be implemented with Drizzle, Prisma, Kysely, or SQL migrations. The important design is the entity boundary and constraints.

### Auth and Workspace Tables

Better Auth should own password hashing, session token handling, account linking, verification tokens, and optional 2FA internals. The platform should not hand-roll password storage. The table names below show the logical contract used by the platform. If the Better Auth adapter uses different physical names, either configure table names to match or create stable application-level references/views.

```sql
CREATE TABLE users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  image text,
  email_verified boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Better Auth-owned session table shape. Exact columns should follow the adapter.
CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Better Auth-owned account table shape. Password hashes and provider details belong here.
CREATE TABLE accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  account_id text NOT NULL,
  password_hash text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, account_id)
);

-- Better Auth-owned verification table shape.
CREATE TABLE verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner_user_id text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'read_only')),
  invited_by_user_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
```

### Worker Tables

```sql
CREATE TYPE worker_status AS ENUM ('pending', 'active', 'degraded', 'offline', 'revoked');

CREATE TABLE worker_nodes (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  name text NOT NULL,
  status worker_status NOT NULL DEFAULT 'pending',
  public_url text,
  default_connection_host text,
  version text,
  docker_info jsonb NOT NULL DEFAULT '{}',
  last_heartbeat_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE worker_credentials (
  id text PRIMARY KEY,
  worker_id text NOT NULL REFERENCES worker_nodes(id),
  secret_version integer NOT NULL,
  encrypted_hmac_secret text NOT NULL,
  callback_token_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'previous', 'pending', 'revoked')),
  not_before timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worker_id, secret_version)
);
```

### Engine and Database Tables

```sql
CREATE TYPE engine_type AS ENUM ('postgres', 'mysql', 'mariadb', 'redis', 'mongodb', 'clickhouse');
CREATE TYPE engine_status AS ENUM ('not_created', 'creating', 'running', 'stopped', 'unhealthy', 'deleting', 'deleted');
CREATE TYPE database_status AS ENUM ('creating', 'ready', 'updating', 'backing_up', 'restoring', 'deleting', 'deleted', 'error');
CREATE TYPE isolation_mode AS ENUM ('shared_server', 'isolated_container');

CREATE TABLE database_engines (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  worker_id text NOT NULL REFERENCES worker_nodes(id),
  engine_type engine_type NOT NULL,
  isolation_mode isolation_mode NOT NULL DEFAULT 'shared_server',
  docker_container_id text,
  docker_container_name text,
  docker_image text NOT NULL,
  docker_network text,
  data_volume text,
  host_port integer,
  internal_port integer NOT NULL,
  status engine_status NOT NULL DEFAULT 'not_created',
  ssl_enabled boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE managed_databases (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  worker_id text NOT NULL REFERENCES worker_nodes(id),
  engine_id text NOT NULL REFERENCES database_engines(id),
  engine_type engine_type NOT NULL,
  display_name text NOT NULL,
  actual_database_name text NOT NULL,
  status database_status NOT NULL DEFAULT 'creating',
  owner_user_id text REFERENCES users(id),
  connection_host text,
  connection_port integer,
  ssl_mode text NOT NULL DEFAULT 'disable',
  metadata jsonb NOT NULL DEFAULT '{}',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engine_id, actual_database_name)
);

CREATE TABLE database_credentials (
  id text PRIMARY KEY,
  database_id text NOT NULL REFERENCES managed_databases(id),
  label text NOT NULL,
  username text NOT NULL,
  encrypted_password text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  last_revealed_at timestamptz,
  last_rotated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE database_users (
  id text PRIMARY KEY,
  database_id text NOT NULL REFERENCES managed_databases(id),
  username text NOT NULL,
  engine_role text NOT NULL DEFAULT 'application',
  credential_id text REFERENCES database_credentials(id),
  created_by_user_id text REFERENCES users(id),
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database_id, username)
);
```

### Permission and Job Tables

```sql
CREATE TABLE database_permissions (
  id text PRIMARY KEY,
  database_id text NOT NULL REFERENCES managed_databases(id),
  user_id text NOT NULL REFERENCES users(id),
  permission text NOT NULL,
  granted_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (database_id, user_id, permission)
);

CREATE TYPE job_status AS ENUM (
  'queued',
  'dispatching',
  'accepted',
  'running',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
  'timed_out'
);

CREATE TABLE jobs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  worker_id text NOT NULL REFERENCES worker_nodes(id),
  created_by_user_id text REFERENCES users(id),
  type text NOT NULL,
  status job_status NOT NULL DEFAULT 'queued',
  input jsonb NOT NULL,
  result jsonb,
  manifest_hash text NOT NULL,
  idempotency_key text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 1,
  timeout_seconds integer NOT NULL DEFAULT 300,
  error_code text,
  error_message text,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE job_logs (
  id bigserial PRIMARY KEY,
  job_id text NOT NULL REFERENCES jobs(id),
  level text NOT NULL,
  message text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Query, Audit, Backup, and Agent Tables

```sql
CREATE TABLE query_history (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  database_id text NOT NULL REFERENCES managed_databases(id),
  user_id text REFERENCES users(id),
  query_hash text NOT NULL,
  query_redacted text NOT NULL,
  query_type text NOT NULL,
  duration_ms integer,
  rows_returned integer,
  rows_affected integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  actor_user_id text REFERENCES users(id),
  actor_type text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  target_type text,
  target_id text,
  risk_level text NOT NULL,
  ip_address inet,
  user_agent text,
  correlation_id text,
  metadata_redacted jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backup_configs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  database_id text REFERENCES managed_databases(id),
  provider text NOT NULL,
  schedule_cron text,
  retention_policy jsonb NOT NULL DEFAULT '{}',
  encryption_enabled boolean NOT NULL DEFAULT false,
  compression text NOT NULL DEFAULT 'gzip',
  destination jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backups (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  database_id text NOT NULL REFERENCES managed_databases(id),
  backup_config_id text REFERENCES backup_configs(id),
  status text NOT NULL,
  provider text NOT NULL,
  object_key text NOT NULL,
  size_bytes bigint,
  checksum_sha256 text,
  manifest jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_threads (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  database_id text REFERENCES managed_databases(id),
  user_id text NOT NULL REFERENCES users(id),
  title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES agent_threads(id),
  role text NOT NULL,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_tool_calls (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES agent_threads(id),
  message_id text REFERENCES agent_messages(id),
  tool_name text NOT NULL,
  input_redacted jsonb NOT NULL,
  output_redacted jsonb,
  risk_level text NOT NULL,
  status text NOT NULL,
  audit_log_id text REFERENCES audit_logs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE connection_profiles (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id),
  database_id text REFERENCES managed_databases(id),
  name text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL,
  ssl_mode text NOT NULL DEFAULT 'disable',
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE workspace_settings (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) UNIQUE,
  connection_defaults jsonb NOT NULL DEFAULT '{}',
  backup_defaults jsonb NOT NULL DEFAULT '{}',
  security_settings jsonb NOT NULL DEFAULT '{}',
  agent_settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feature_flags (
  id text PRIMARY KEY,
  workspace_id text REFERENCES workspaces(id),
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);
```

## 32. Example Zod Contracts

### Worker Job Notification

```ts
import { z } from "zod";

export const WorkerRunJobRequestSchema = z.object({
  jobId: z.string().min(1).max(128)
});

export type WorkerRunJobRequest = z.infer<typeof WorkerRunJobRequestSchema>;
```

### Create Database Job

```ts
export const EngineTypeSchema = z.enum([
  "postgres",
  "mysql",
  "mariadb",
  "redis",
  "mongodb",
  "clickhouse"
]);

export const IsolationModeSchema = z.enum(["shared_server", "isolated_container"]);

export const PostgresSslModeSchema = z.enum(["disable", "require", "verify-ca", "verify-full"]);

export const CreateDatabaseInputSchema = z.object({
  workspaceId: z.string(),
  engineType: EngineTypeSchema,
  displayName: z.string().min(1).max(80),
  isolationMode: IsolationModeSchema.default("shared_server"),
  ownerUserId: z.string(),
  connectionHost: z.string().min(1).max(255).optional(),
  connectionPort: z.number().int().min(1).max(65535).optional(),
  sslMode: PostgresSslModeSchema.default("disable"),
  initialSql: z.string().max(200_000).optional()
});

export const CreateDatabaseResultSchema = z.object({
  databaseId: z.string(),
  engineId: z.string(),
  actualDatabaseName: z.string(),
  username: z.string(),
  credentialId: z.string(),
  connection: z.object({
    host: z.string(),
    port: z.number().int(),
    database: z.string(),
    username: z.string(),
    sslMode: PostgresSslModeSchema,
    connectionStringRedacted: z.string(),
    psqlCommandRedacted: z.string()
  })
});
```

### Table Data Fetch

```ts
export const FilterOperatorSchema = z.enum([
  "eq",
  "neq",
  "lt",
  "lte",
  "gt",
  "gte",
  "contains",
  "startsWith",
  "isNull",
  "isNotNull"
]);

export const FetchTableRowsInputSchema = z.object({
  databaseId: z.string(),
  schemaName: z.string().min(1).max(63),
  tableName: z.string().min(1).max(63),
  columns: z.array(z.string().min(1).max(63)).max(100).optional(),
  filters: z.array(z.object({
    column: z.string().min(1).max(63),
    operator: FilterOperatorSchema,
    value: z.unknown().optional()
  })).max(20).default([]),
  sort: z.array(z.object({
    column: z.string().min(1).max(63),
    direction: z.enum(["asc", "desc"])
  })).max(5).default([]),
  limit: z.number().int().min(1).max(500).default(100),
  offset: z.number().int().min(0).default(0)
});
```

### Agent Tool Definition

```ts
export const AgentToolMetadataSchema = z.object({
  name: z.string(),
  description: z.string(),
  requiredPermission: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  confirmation: z.enum(["never", "destructive", "always"]),
  auditEvent: z.string()
});
```

## 33. Example Worker Job Manifests

### Create Database

```json
{
  "jobId": "job_01J00000000000000000000001",
  "workspaceId": "wsp_01J00000000000000000000001",
  "workerId": "wrk_01J00000000000000000000001",
  "type": "create_database",
  "input": {
    "engineType": "postgres",
    "displayName": "Customer Analytics",
    "isolationMode": "shared_server",
    "ownerUserId": "usr_01J00000000000000000000001",
    "connectionHost": "db.example.com",
    "connectionPort": 5432,
    "sslMode": "require",
    "initialSql": "create table events (id bigserial primary key, payload jsonb not null);"
  },
  "policy": {
    "timeoutSeconds": 300,
    "maxRetries": 1,
    "requiresExclusiveEngineLock": true,
    "requiresExclusiveDatabaseLock": false
  },
  "manifestHash": "sha256:example",
  "expiresAt": "2026-06-13T10:35:00.000Z"
}
```

### Fetch Table Rows

```json
{
  "jobId": "job_01J00000000000000000000002",
  "workspaceId": "wsp_01J00000000000000000000001",
  "workerId": "wrk_01J00000000000000000000001",
  "type": "fetch_table_rows",
  "input": {
    "databaseId": "db_01J00000000000000000000001",
    "schemaName": "public",
    "tableName": "events",
    "columns": ["id", "payload"],
    "filters": [],
    "sort": [{ "column": "id", "direction": "desc" }],
    "limit": 100,
    "offset": 0
  },
  "policy": {
    "timeoutSeconds": 30,
    "maxRetries": 1,
    "requiresExclusiveEngineLock": false,
    "requiresExclusiveDatabaseLock": false
  },
  "manifestHash": "sha256:example",
  "expiresAt": "2026-06-13T10:35:00.000Z"
}
```

### Backup Database

```json
{
  "jobId": "job_01J00000000000000000000003",
  "workspaceId": "wsp_01J00000000000000000000001",
  "workerId": "wrk_01J00000000000000000000001",
  "type": "backup_database",
  "input": {
    "databaseId": "db_01J00000000000000000000001",
    "backupConfigId": "bckcfg_01J00000000000000000000001",
    "provider": "s3",
    "compression": "gzip",
    "encryptionEnabled": true,
    "verify": true
  },
  "policy": {
    "timeoutSeconds": 3600,
    "maxRetries": 1,
    "requiresExclusiveEngineLock": false,
    "requiresExclusiveDatabaseLock": false
  },
  "manifestHash": "sha256:example",
  "expiresAt": "2026-06-13T11:30:00.000Z"
}
```

## 34. Example HMAC Signing and Verification Pseudocode

### API Signing

```ts
import crypto from "node:crypto";

function signWorkerRequest(input: {
  method: string;
  path: string;
  rawBody: string;
  workerId: string;
  secretVersion: number;
  secret: string;
  now: Date;
  nonce: string;
}) {
  const timestamp = input.now.toISOString();
  const canonical = [
    input.method.toUpperCase(),
    input.path,
    timestamp,
    input.nonce,
    input.rawBody
  ].join("\n");

  const signature = crypto
    .createHmac("sha256", Buffer.from(input.secret, "base64"))
    .update(canonical, "utf8")
    .digest("hex");

  return {
    "x-datadock-worker-id": input.workerId,
    "x-datadock-signature-version": "hmac-sha256-v1",
    "x-datadock-secret-version": String(input.secretVersion),
    "x-datadock-timestamp": timestamp,
    "x-datadock-nonce": input.nonce,
    "x-datadock-signature": signature,
    "content-type": "application/json"
  };
}
```

### Worker Verification

```ts
import crypto from "node:crypto";

async function verifyWorkerRequest(req: RawExpressRequest) {
  const workerId = requireHeader(req, "x-datadock-worker-id");
  const version = requireHeader(req, "x-datadock-signature-version");
  const secretVersion = requireHeader(req, "x-datadock-secret-version");
  const timestamp = requireHeader(req, "x-datadock-timestamp");
  const nonce = requireHeader(req, "x-datadock-nonce");
  const providedSignature = requireHeader(req, "x-datadock-signature");

  if (version !== "hmac-sha256-v1") {
    throw new UnauthorizedError("Unsupported signature version");
  }

  assertFreshTimestamp(timestamp, { maxSkewSeconds: 300 });

  const nonceKey = `${workerId}:${nonce}`;
  const nonceStored = await nonceStore.setIfAbsent(nonceKey, "1", { ttlSeconds: 360 });
  if (!nonceStored) {
    throw new UnauthorizedError("Replay detected");
  }

  const secret = await loadWorkerSecret(workerId, Number(secretVersion));
  if (!secret || secret.revokedAt) {
    throw new UnauthorizedError("Unknown or revoked worker secret");
  }

  const canonical = [
    req.method.toUpperCase(),
    req.path,
    timestamp,
    nonce,
    req.rawBody
  ].join("\n");

  const expectedSignature = crypto
    .createHmac("sha256", Buffer.from(secret.value, "base64"))
    .update(canonical, "utf8")
    .digest("hex");

  const a = Buffer.from(expectedSignature, "hex");
  const b = Buffer.from(providedSignature, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new UnauthorizedError("Invalid signature");
  }

  return { workerId, secretVersion: Number(secretVersion) };
}
```

### Worker Route

```ts
app.post("/jobs/run", rawJsonBodyMiddleware, async (req, res) => {
  const verified = await verifyWorkerRequest(req);
  const parsed = WorkerRunJobRequestSchema.parse(JSON.parse(req.rawBody));

  await jobRunner.accept({
    workerId: verified.workerId,
    jobId: parsed.jobId
  });

  res.status(202).json({ accepted: true });
});
```

### Manifest Fetch

```ts
async function fetchJobManifest(jobId: string) {
  const response = await fetch(`${env.WORKER_API_URL}/api/internal/workers/jobs/${jobId}/manifest`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${env.WORKER_API_TOKEN}`,
      "x-datadock-worker-id": env.WORKER_ID
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status}`);
  }

  const json = await response.json();
  return JobManifestSchema.parse(json);
}
```

### Callback Event

```ts
async function emitJobEvent(jobId: string, event: WorkerJobEvent) {
  const body = JSON.stringify(WorkerJobEventSchema.parse(event));

  const response = await fetch(`${env.WORKER_API_URL}/api/internal/workers/jobs/${jobId}/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.WORKER_API_TOKEN}`,
      "content-type": "application/json",
      "x-datadock-worker-id": env.WORKER_ID
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Failed to emit job event: ${response.status}`);
  }
}
```

## Implementation Notes

The architecture should be implemented in thin vertical slices:

1. Auth, metadata DB, and worker registration.
2. Signed worker request and callback loop.
3. PostgreSQL engine ensure/create/delete.
4. Dashboard visibility for job logs and database state.
5. Connection string and credential handling.
6. Schema/table/SQL features.
7. Backups.
8. Agent.
9. Additional engines.

The most important early invariant is simple: the worker is the only process with Docker access, and the worker only executes typed, validated, assigned jobs.
