import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema/index.js";

const dbUrl = process.env.DATABASE_URL || "./yunora.db";
const isRemote = dbUrl.startsWith("libsql:") || dbUrl.startsWith("http:") || dbUrl.startsWith("https:");
const clientUrl = isRemote ? dbUrl : (dbUrl.startsWith("file:") ? dbUrl : `file:${dbUrl}`);

const clientConfig: { url: string; authToken?: string } = { url: clientUrl };
if (process.env.DATABASE_AUTH_TOKEN) {
  clientConfig.authToken = process.env.DATABASE_AUTH_TOKEN;
}

export const sqlite = createClient(clientConfig);
export const db = drizzle(sqlite, { schema });

export * from "./schema";
