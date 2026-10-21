import { publicAuthOrigin } from "@/lib/env";

export async function buildSsoLaunchUrl(
  baseUrl: string,
  token: string,
): Promise<string> {
  if (!baseUrl) return baseUrl;
  if (!token) return baseUrl;

  const authBase = publicAuthOrigin().replace(/\/+$/, "");
  try {
    const res = await fetch(`${authBase}/api/auth/handoff`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`handoff ${res.status}`);
    const data = (await res.json()) as {
      code?: string;
      data?: { code?: string };
    };
    const code = data.code || data.data?.code;
    if (!code) throw new Error("missing handoff code");
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}handoff=${encodeURIComponent(code)}`;
  } catch {
    return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
  }
}
