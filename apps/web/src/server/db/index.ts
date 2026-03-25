import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return drizzle(neon(url), { schema });
}

// Lazy singleton — created on first access at runtime, not at import/build time
let _db: ReturnType<typeof createDb>;
export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
