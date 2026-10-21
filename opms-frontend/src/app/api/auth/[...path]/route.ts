import type { NextRequest } from "next/server";

import { proxyAuthRequest } from "@session-auth/nextAuthProxy";

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: RouteCtx) {
  try {
    const { path } = await ctx.params;
    return await proxyAuthRequest(request, path);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth proxy error";
    return Response.json({ success: false, message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
