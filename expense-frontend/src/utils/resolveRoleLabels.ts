/** Prefer human-readable role names; never surface bare Mongo ObjectIds. */

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function formatLabel(code: string): string {
  return String(code || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function resolveRoleLabels(user: {
  role_names?: unknown;
  role_codes?: unknown;
  roles?: unknown;
} | null | undefined): string[] {
  if (!user) return [];

  const names = Array.isArray(user.role_names)
    ? user.role_names.map((n) => String(n || "").trim()).filter(Boolean)
    : [];
  if (names.length) return [...new Set(names)];

  const codes = Array.isArray(user.role_codes)
    ? user.role_codes.map((c) => String(c || "").trim()).filter(Boolean)
    : [];
  if (codes.length) {
    return [...new Set(codes.map((c) => formatLabel(c) || c))];
  }

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const fromRoles = roles
    .map((r) => {
      if (r && typeof r === "object") {
        const obj = r as { name?: string; code?: string };
        if (obj.name) return String(obj.name).trim();
        if (obj.code) return formatLabel(String(obj.code)) || String(obj.code);
        return "";
      }
      const s = String(r || "").trim();
      if (!s || OBJECT_ID_RE.test(s)) return "";
      return formatLabel(s) || s;
    })
    .filter(Boolean);

  return [...new Set(fromRoles)];
}
