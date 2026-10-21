/** Same-origin auth routes (Next.js proxy → auth-service). */
export const AUTH_API = {
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  me: "/api/auth/me",
  handoffExchange: "/api/auth/handoff/exchange",
} as const;
