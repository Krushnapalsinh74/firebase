import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema/index.js";

// Only use the env DATABASE_URL if it's a libsql-compatible URL.
// Replit injects a PostgreSQL DATABASE_URL into the environment which
// would break the libsql client, so we explicitly ignore postgres:// URLs.
const envDbUrl = process.env.DATABASE_URL || "";
const isLibsqlCompatible = envDbUrl.startsWith("libsql:") ||
  envDbUrl.startsWith("http:") ||
  envDbUrl.startsWith("https:") ||
  envDbUrl.startsWith("file:") ||
  (envDbUrl !== "" && !envDbUrl.startsWith("postgresql:") && !envDbUrl.startsWith("postgres:"));
const dbUrl = isLibsqlCompatible ? envDbUrl : "./yunora.db";
const isRemote = dbUrl.startsWith("libsql:") || dbUrl.startsWith("http:") || dbUrl.startsWith("https:");
const clientUrl = isRemote ? dbUrl : (dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`);

const clientConfig: { url: string; authToken?: string } = { url: clientUrl };
if (process.env.DATABASE_AUTH_TOKEN) {
  clientConfig.authToken = process.env.DATABASE_AUTH_TOKEN;
}

export const sqlite = createClient(clientConfig);
export const db = drizzle(sqlite, { schema });

export * from "./schema";
