// API keys for the public /api/v1 surface.
// Tokens look like ink_live_<40 hex>; only the SHA-256 hash is stored and
// the full token is returned exactly once, at creation.

import crypto from "crypto";
import { prisma } from "./db";

function hash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createApiKey(name: string) {
  const token = `ink_live_${crypto.randomBytes(20).toString("hex")}`;
  const key = await prisma.apiKey.create({
    data: { name, prefix: token.slice(0, 12), keyHash: hash(token) },
  });
  return { id: key.id, name: key.name, prefix: key.prefix, token };
}

/** Validates a bearer token; returns the key row or null. Stamps lastUsedAt. */
export async function verifyApiKey(token: string | null | undefined) {
  if (!token || !token.startsWith("ink_live_")) return null;
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash(token) } });
  if (!key || key.revoked) return null;
  return prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
}

/** Auth guard for /api/v1 route handlers. */
export async function requireApiKey(req: Request): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const key = await verifyApiKey(token);
  if (!key) return { ok: false, status: 401, error: "invalid or revoked API key" };
  return { ok: true };
}
