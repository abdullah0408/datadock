module.exports = {
  forbidden: [
    {
      name: "app-must-not-import-db-repositories-or-services",
      severity: "error",
      from: { path: "^apps/web" },
      to: { path: "^packages/(db|repositories|services)" },
    },
    {
      name: "domain-must-stay-pure",
      severity: "error",
      from: { path: "^packages/domain" },
      to: {
        path: "^(apps/|packages/(api|auth|db|email|files|jobs|repositories|services|ui))",
      },
    },
    {
      name: "db-must-stay-infrastructure-only",
      severity: "error",
      from: { path: "^packages/db" },
      to: {
        path: "^(apps/|packages/(api|auth|domain|email|files|jobs|repositories|services|ui))",
      },
    },
    {
      name: "config-must-not-import-product-packages",
      severity: "error",
      from: { path: "^packages/config" },
      to: {
        path: "^(apps/|packages/(api|auth|db|domain|email|files|jobs|repositories|services|ui))",
      },
    },
    {
      name: "ui-must-not-import-server-packages",
      severity: "error",
      from: { path: "^packages/ui" },
      to: {
        path: "^packages/(api|auth|db|email|files|jobs|repositories|services)",
      },
    },
    {
      name: "api-must-not-write-through-db-or-repositories",
      severity: "error",
      from: { path: "^packages/api" },
      to: { path: "^packages/(db|repositories)" },
    },
    {
      name: "repositories-must-not-import-services",
      severity: "error",
      from: { path: "^packages/repositories" },
      to: { path: "^packages/(api|auth|email|files|jobs|services|ui)" },
    },
    {
      name: "services-must-not-import-jobs",
      severity: "error",
      from: { path: "^packages/services" },
      to: { path: "^packages/jobs" },
    },
    {
      name: "worker-must-not-import-ui",
      severity: "error",
      from: { path: "^apps/worker" },
      to: { path: "^(apps/web|packages/ui)" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules|\\.next|dist|coverage",
    },
    exclude: {
      path: "node_modules|\\.next|dist|coverage",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
