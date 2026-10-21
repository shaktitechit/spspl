import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE =
  process.env.AUTH_SERVICE_URL ||
  process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
  "http://auth-service:7003";

function getForwardHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeader =
    request.headers.get("authorization") ||
    (request.cookies.get("access_token")?.value
      ? `Bearer ${request.cookies.get("access_token")?.value}`
      : null);
  if (authHeader) headers["Authorization"] = authHeader;

  const cookie = request.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  return headers;
}

export async function GET(request: NextRequest) {
  const headers = getForwardHeaders(request);
  const url = new URL(request.url);
  const search = url.search;

  try {
    const res = await fetch(`${AUTH_SERVICE}/api/branches${search}`, { headers });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "auth-service unreachable" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const headers = getForwardHeaders(request);

  try {
    const jsonBody = await request.json();
    const res = await fetch(`${AUTH_SERVICE}/api/branches`, {
      method: "POST",
      headers,
      body: JSON.stringify(jsonBody),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "auth-service unreachable" }, { status: 502 });
  }
}
