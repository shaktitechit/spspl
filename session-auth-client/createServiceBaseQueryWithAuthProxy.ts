/** Same-origin Next.js proxy paths (`/api/auth/*`). */
export function isSameOriginAuthApiUrl(url: string): boolean {
  return url.startsWith("/api/auth");
}

export function sameOriginBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL;
  if (fromEnv) {
    const trimmed = fromEnv.replace(/\/+$/, "");
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }
  return "http://localhost:3000";
}

type BaseQueryLike = (args: unknown, api: unknown, extraOptions: unknown) => Promise<unknown>;

/**
 * RTK `fetchBaseQuery` joins `baseUrl` + `url`. Auth uses `/api/auth/login`, which
 * must hit the Next proxy on the app origin — not `{service}/api/api/auth/login`.
 */
export function createServiceBaseQueryWithAuthProxy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchBaseQuery: (options: any) => BaseQueryLike,
  options: {
    baseUrl: string;
    prepareHeaders?: (
      headers: Headers,
      api: unknown,
    ) => Headers | void | Promise<Headers | void>;
    credentials?: RequestCredentials;
  },
): BaseQueryLike {
  const serviceBase = String(options.baseUrl ?? "").replace(/\/+$/, "");
  const credentials = options.credentials ?? "include";

  const serviceQuery = fetchBaseQuery({
    baseUrl: serviceBase,
    credentials,
    prepareHeaders: options.prepareHeaders,
  });

  const proxyQuery = fetchBaseQuery({
    baseUrl: sameOriginBaseUrl(),
    credentials,
    prepareHeaders: options.prepareHeaders,
  });

  return async (args, api, extraOptions) => {
    const url = typeof args === "string" ? args : (args as { url: string }).url;
    if (isSameOriginAuthApiUrl(url)) {
      return proxyQuery(args, api, extraOptions);
    }
    return serviceQuery(args, api, extraOptions);
  };
}
