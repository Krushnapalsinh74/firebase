import { defineConfig } from "drizzle-kit";

// When Replit provides a PostgreSQL DATABASE_URL, the app falls back to a
// local SQLite file (see src/index.ts). Point drizzle-kit at the same file.
const envDbUrl = process.env.DATABASE_URL || "";
const isLibsqlCompatible =
  envDbUrl.startsWith("libsql:") ||
  envDbUrl.startsWith("http:") ||
  envDbUrl.startsWith("https:") ||
  envDbUrl.startsWith("file:") ||
  (envDbUrl !== "" &&
    !envDbUrl.startsWith("postgresql:") &&
    !envDbUrl.startsWith("postgres:"));

const dbUrl = isLibsqlCompatible ? envDbUrl : "file:./yunora.db";

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: dbUrl,
  },
});
