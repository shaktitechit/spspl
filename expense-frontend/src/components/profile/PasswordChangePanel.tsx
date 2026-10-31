"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ChangePasswordFn = (args: {
  currentPassword: string;
  newPassword: string;
}) => Promise<unknown>;

export function PasswordChangePanel({
  onChangePassword,
}: {
  onChangePassword: ChangePasswordFn;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Enter current and new password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSubmitting(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string }; message?: string })?.data
          ?.message ||
        (err as { message?: string })?.message ||
        "Failed to update password";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm max-w-lg space-y-4">
      <div className="flex items-center gap-2.5 border-b border-border pb-3">
        <KeyRound className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-bold text-foreground">Reset Password</h3>
          <p className="text-[11px] text-muted mt-0.5">
            Enter your current password, then choose a new one.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Current Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-foreground mb-1.5">
            Confirm New Password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            required
            minLength={6}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition"
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Updating…
            </>
          ) : (
            "Update Password"
          )}
        </button>
      </form>
    </div>
  );
}
