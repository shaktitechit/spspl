"use client";

import { FileDown, Loader2 } from "lucide-react";

interface ReportDownloadButtonProps {
  onDownload: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  size?: "sm" | "md";
  label?: string;
  title?: string;
}

export default function ReportDownloadButton({
  onDownload,
  disabled = false,
  loading = false,
  size = "sm",
  label = "Download PDF",
  title = "Download PDF on company letterhead",
}: ReportDownloadButtonProps) {
  const isDisabled = disabled || loading;

  const btnClass =
    size === "sm"
      ? "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-2xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer"
      : "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer";

  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={isDisabled}
      className={btnClass}
      title={title}
      aria-label={label}
    >
      {loading ? (
        <Loader2 className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} animate-spin text-blue-600`} />
      ) : (
        <FileDown className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} text-rose-600 dark:text-rose-400`} />
      )}
      <span>{loading ? "Generating..." : label}</span>
    </button>
  );
}
