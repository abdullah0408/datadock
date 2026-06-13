# DataDock

DataDock is a self-hosted database management platform scaffolded as a pnpm
monorepo.

## Workspace

- `apps/web` - Next.js web application.
- `apps/worker` - reserved for the worker service.
- `packages/api` - API boundary and application-facing contracts.
- `packages/auth` - authentication helpers.
- `packages/config` - shared configuration.
- `packages/db` - Drizzle ORM metadata schema, migrations, and client setup.
- `packages/domain` - domain types and rules.
- `packages/email` - email delivery helpers.
- `packages/files` - file and object storage helpers.
- `packages/jobs` - durable job orchestration.
- `packages/repositories` - persistence repositories.
- `packages/services` - application services.
- `packages/ui` - shared UI primitives.

## Commands

Install dependencies from the repository root:

```bash
pnpm install
```

Run the web app:

```bash
pnpm dev
```

Check the workspace:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Documentation

- [Architecture](docs/architecture/README.md)

## License

Personal and non-commercial use is allowed under the repository license. See
[LICENSE](LICENSE).
