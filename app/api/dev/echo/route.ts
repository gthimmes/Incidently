import { NextRequest, NextResponse } from "next/server";

// Local webhook receiver for demos and tests: accepts any signed delivery
// and echoes what it saw. Point a subscription at /api/dev/echo to watch
// the outbound pipeline succeed without any external service.
export async function POST(req: NextRequest) {
  const body = await req.text();
  return NextResponse.json({
    ok: true,
    event: req.headers.get("x-incidently-event"),
    delivery: req.headers.get("x-incidently-delivery"),
    signature_present: Boolean(req.headers.get("x-incidently-signature")),
    bytes: body.length,
  });
}
