import { PrismaClient } from "@prisma/client";
import { createSqliteAdapter } from "./sqlite-adapter";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// DATABASE_URL override lets tests point at an isolated database;
// production/dev fall back to prisma/dev.db (see sqlite-adapter.ts).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createSqliteAdapter(),
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
