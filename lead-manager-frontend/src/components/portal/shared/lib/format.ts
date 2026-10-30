export function inr(val: unknown): string {
  const num = Number(val ?? 0);
  const safe = Number.isFinite(num) ? num : 0;
  return `₹${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(val: unknown): string {
  if (!val) return "—";
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

