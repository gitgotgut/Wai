import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const getKey = () => Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return { ciphertext: encrypted + ":" + tag, iv: iv.toString("hex") };
}

export function decrypt(ciphertext: string, ivHex: string): string {
  const [encrypted, tagHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(Buffer.from(tagHex!, "hex"));
  let decrypted = decipher.update(encrypted!, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function mask(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "..." + key.slice(-4);
}
