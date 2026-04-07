import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config({ path: ".env" });

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPostgresUrl = /^(postgres|postgresql):\/\//i.test(databaseUrl);
const schema =
  process.env.PRISMA_SCHEMA ??
  (isPostgresUrl ? "prisma/schema.production.prisma" : "prisma/schema.prisma");

export default defineConfig({
  schema,
  migrations: {
    path: "prisma/migrations",
  },
});
