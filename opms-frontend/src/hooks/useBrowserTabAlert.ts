import { useEffect, useRef } from "react";
import { useGetCompanyInfoQuery } from "@/store/api";

export type BrowserTabAlertOptions = {
  /** Number of pending items; tab badge shows when > 0. */
  count: number;
  /** Title restored when count is 0 or the hook unmounts. */
  baseTitle?: string;
  /** Shown in the alert title, e.g. "pending account approval". */
  alertLabel?: string;
  /** When false, always restores base title. */
  enabled?: boolean;
  /** When true, badge only appears while the tab is in the background. */
  onlyWhenHidden?: boolean;
};

const DEFAULT_BASE_TITLE =
  typeof process !== "undefined" && process.env.NEXT_PUBLIC_COMPANY_NAME?.trim()
    ? `OPMS - ${process.env.NEXT_PUBLIC_COMPANY_NAME.trim()}`
    : "OPMS";

function formatAlertTitle(
  count: number,
  baseTitle: string,
  _alertLabel?: string,
): string {
  return `(${count}) ${baseTitle}`;
}

/**
 * Updates `document.title` to surface a pending-work count in the browser tab.
 */
export function useBrowserTabAlert({
  count,
  baseTitle,
  alertLabel,
  enabled = true,
  onlyWhenHidden = false,
}: BrowserTabAlertOptions) {
  const { data: companyInfo } = useGetCompanyInfoQuery();
  const companyName =
    companyInfo?.trade_name?.trim() ||
    companyInfo?.legal_name?.trim() ||
    (typeof process !== "undefined" &&
      process.env.NEXT_PUBLIC_COMPANY_NAME?.trim()) ||
    "";
  const resolvedBaseTitle =
    baseTitle ?? (companyName ? `OPMS - ${companyName}` : DEFAULT_BASE_TITLE);
  const savedTitleRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    savedTitleRef.current = resolvedBaseTitle;

    const restoreTitle = () => {
      document.title = savedTitleRef.current ?? resolvedBaseTitle;
    };

    const applyTitle = () => {
      const shouldAlert =
        enabled && count > 0 && (!onlyWhenHidden || document.hidden);

      if (shouldAlert) {
        document.title = formatAlertTitle(count, resolvedBaseTitle, alertLabel);
      } else {
        document.title = resolvedBaseTitle;
      }
    };

    applyTitle();

    if (!onlyWhenHidden) {
      return restoreTitle;
    }

    document.addEventListener("visibilitychange", applyTitle);
    return () => {
      document.removeEventListener("visibilitychange", applyTitle);
      restoreTitle();
    };
  }, [count, resolvedBaseTitle, alertLabel, enabled, onlyWhenHidden]);
}
