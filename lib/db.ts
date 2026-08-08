import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// DATABASE_URL override lets tests point at an isolated database;
// production/dev fall back to the schema's default (file:./dev.db).
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
    ...(process.env.DATABASE_URL ? { datasourceUrl: process.env.DATABASE_URL } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
