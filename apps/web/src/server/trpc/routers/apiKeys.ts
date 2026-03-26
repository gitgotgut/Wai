import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { apiKeys } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt, mask } from "@/lib/encryption";

export const apiKeysRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await ctx.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.session.user.id));
    return keys.map((k) => ({
      id: k.id,
      provider: k.provider,
      label: k.label,
      maskedKey: mask(decrypt(k.encryptedKey, k.iv)),
      createdAt: k.createdAt,
    }));
  }),

  add: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["openai", "anthropic", "google"]),
        key: z.string().min(10).max(200),
        label: z.string().max(50).default("Default"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { ciphertext, iv } = encrypt(input.key);
      const [row] = await ctx.db
        .insert(apiKeys)
        .values({
          userId: ctx.session.user.id,
          provider: input.provider,
          encryptedKey: ciphertext,
          iv,
          label: input.label,
        })
        .returning();
      return { id: row.id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(apiKeys)
        .where(
          and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.session.user.id)),
        );
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [keyRow] = await ctx.db
        .select()
        .from(apiKeys)
        .where(
          and(eq(apiKeys.id, input.id), eq(apiKeys.userId, ctx.session.user.id)),
        );
      if (!keyRow) throw new Error("Key not found");

      const decrypted = decrypt(keyRow.encryptedKey, keyRow.iv);

      if (keyRow.provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${decrypted}` },
        });
        if (!res.ok) throw new Error("OpenAI key is invalid");
      } else if (keyRow.provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": decrypted,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (!res.ok && res.status === 401) throw new Error("Anthropic key is invalid");
      }

      return { valid: true };
    }),
});
