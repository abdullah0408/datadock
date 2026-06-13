export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-950">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-20">
        <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
          DataDock
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Self-hosted database management for small teams and personal labs.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          The project shell is ready. Build the control plane, worker, and
          shared packages from this monorepo foundation.
        </p>
      </main>
    </div>
  );
}
