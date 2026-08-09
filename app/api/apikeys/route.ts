import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createApiKey } from "@/lib/apikeys";

export async function GET() {
  const keys = await prisma.apiKey.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      revoked: k.revoked,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });
  const key = await createApiKey(body.name.trim());
  // the only time the full token ever leaves the server
  return NextResponse.json(key, { status: 201 });
}
