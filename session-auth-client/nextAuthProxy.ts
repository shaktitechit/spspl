const FORWARD_HEADERS = ["content-type", "authorization", "cookie"];

export function resolveAuthServiceUrl(): string {
  return (
    process.env.AUTH_SERVICE_URL ||
    process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
    process.env.NEXT_PUBLIC_AUTH_ORIGIN ||
    "http://localhost:7003"
  ).replace(/\/+$/, "");
}

export async function proxyAuthRequest(
  request: Request,
  pathSegments: string[],
  authServiceBase?: string,
): Promise<Response> {
  const base = (authServiceBase || resolveAuthServiceUrl()).replace(/\/+$/, "");
  const tail = pathSegments.filter(Boolean).join("/");
  const search = new URL(request.url).search;
  const target = `${base}/api/auth/${tail}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const body =
    request.method !== "GET" && request.method !== "HEAD"
      ? await request.arrayBuffer()
      : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Auth service unreachable";
    return Response.json(
      {
        success: false,
        message: `Auth proxy failed: ${message}`,
        details: { target },
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("content-type", contentType);

  const setCookies =
    typeof upstream.headers.getSetCookie === "function"
      ? upstream.headers.getSetCookie()
      : [];
  if (setCookies.length === 0) {
    const single = upstream.headers.get("set-cookie");
    if (single) setCookies.push(single);
  }
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: responseHeaders });
}
