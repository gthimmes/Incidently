import { NextRequest, NextResponse } from "next/server";
import { getJiraConfig, saveJiraConfig, testJiraConnection } from "@/lib/jira";

export async function GET() {
  const cfg = await getJiraConfig();
  // never leak the token back to the client
  return NextResponse.json({ ...cfg, apiToken: cfg.apiToken ? "•••" : "" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  for (const k of ["baseUrl", "email", "projectKey", "mockMode"] as const) {
    if (k in body) patch[k] = body[k];
  }
  if (body.apiToken && body.apiToken !== "•••") patch.apiToken = body.apiToken;
  await saveJiraConfig(patch);
  if (body.test) {
    const result = await testJiraConnection();
    return NextResponse.json(result);
  }
  return NextResponse.json({ ok: true, message: "Saved" });
}
