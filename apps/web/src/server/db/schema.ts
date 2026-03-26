import {
  pgTable, text, timestamp, integer, uuid, varchar,
  uniqueIndex, primaryKey, index, boolean, jsonb,
} from "drizzle-orm/pg-core";

// ─── NextAuth tables ───────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refreshToken: text("refresh_token"),
  accessToken: text("access_token"),
  expiresAt: integer("expires_at"),
  tokenType: text("token_type"),
  scope: text("scope"),
  idToken: text("id_token"),
  sessionState: text("session_state"),
}, (t) => [
  uniqueIndex("accounts_provider_account_idx").on(t.provider, t.providerAccountId),
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionToken: text("session_token").notNull().unique(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.identifier, t.token] }),
]);

// ─── Workspaces ────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "admin", "member", "viewer"] }).notNull().default("member"),
  joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
]);

// ─── Agents ────────────────────────────────────────────

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull().default("You are a helpful assistant."),
  model: text("model").notNull().default("gpt-4o"),
  provider: text("provider", { enum: ["openai", "anthropic", "google"] }).notNull().default("openai"),
  tools: jsonb("tools").$type<string[]>().default([]),
  knowledgeBase: jsonb("knowledge_base").$type<{ type: string; ref: string }[]>().default([]),
  isPublic: boolean("is_public").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("agents_workspace_idx").on(t.workspaceId),
]);

// ─── API Keys (encrypted at rest) ─────────────────────

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["openai", "anthropic", "google"] }).notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(),
  label: text("label").notNull().default("Default"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [
  index("api_keys_user_idx").on(t.userId),
]);
