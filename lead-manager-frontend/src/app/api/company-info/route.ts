import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE =
  process.env.AUTH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
  "http://auth-service:7003";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(`${AUTH_SERVICE}/api/company-info`, { headers });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "auth-service unreachable" }, { status: 502 });
  }
}
