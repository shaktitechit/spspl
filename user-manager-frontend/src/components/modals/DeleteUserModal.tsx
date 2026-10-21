"use client";

import { useState } from "react";
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { DeptBadge } from "@/components/DeptBadge";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";

export function DeleteUserModal({
  user,
  token,
  onClose,
  onDeleted,
}: {
  user: any;
  token: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uid = String(user._id || user.id || "");

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/users/${uid}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error?.message || errData?.message || "Failed to delete user.");
      }
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete user.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2 text-rose-600">
            <Trash2 className="h-5 w-5" />
            <h2 className="font-bold text-foreground">Delete User</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/20 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <p className="text-sm text-muted">
            Are you sure you want to delete this user? This action will permanently remove their login access.
          </p>

          <div className="rounded-xl border border-border bg-surface-muted p-3.5">
            <div className="font-semibold text-foreground">{user.name || "Unnamed"}</div>
            <div className="text-xs text-muted">{user.email}</div>
            <div className="mt-2">
              <DeptBadge dept={user.department || "unknown"} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isLoading}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60 transition shadow-sm"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Confirm Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
