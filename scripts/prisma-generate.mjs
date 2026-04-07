import { execFileSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPostgresUrl = /^(postgres|postgresql):\/\//i.test(databaseUrl);
const runningOnVercel =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  Boolean(process.env.VERCEL_ENV);

const schema =
  process.env.PRISMA_SCHEMA ??
  (runningOnVercel || isPostgresUrl
    ? "prisma/schema.production.prisma"
    : "prisma/schema.prisma");

execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "generate", "--schema", schema],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PRISMA_SCHEMA: schema,
    },
  },
);
