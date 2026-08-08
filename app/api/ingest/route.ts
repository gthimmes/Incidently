import { NextRequest, NextResponse } from "next/server";
import { ingestAlert, getIngestToken, type IngestPayload } from "@/lib/alerts";

// Webhook for monitoring tools. Authenticate with the ingest token via
// `Authorization: Bearer <token>`, `X-Incidently-Token: <token>`, or a
// `?token=` query param (for tools that can't set headers).
export async function POST(req: NextRequest) {
  const token = await getIngestToken();
  const supplied =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-incidently-token") ??
    req.nextUrl.searchParams.get("token") ??
    "";
  if (supplied !== token) {
    return NextResponse.json({ error: "invalid ingest token" }, { status: 401 });
  }

  let body: IngestPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const result = await ingestAlert(body);
  return NextResponse.json(result, { status: 202 });
}
