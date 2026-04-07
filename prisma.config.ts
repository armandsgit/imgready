import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPostgresUrl = /^(postgres|postgresql):\/\//i.test(databaseUrl);
const isVercelBuild =
  process.env.VERCEL === "1" ||
  process.env.VERCEL === "true" ||
  Boolean(process.env.VERCEL_ENV);
const schema =
  process.env.PRISMA_SCHEMA ??
  (isVercelBuild || isPostgresUrl ? "prisma/schema.production.prisma" : "prisma/schema.prisma");

export default defineConfig({
  schema,
  migrations: {
    path: "prisma/migrations",
  },
});
