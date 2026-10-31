import type { NextRequest } from "next/server";

import { proxyAuthRequest } from "@session-auth/nextAuthProxy";

type RouteCtx = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyAuthRequest(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
