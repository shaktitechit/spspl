"use client";

import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  baseApi,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import type { RootState } from "@/store/store";

function pickNotifications(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: unknown[] }).items;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data: unknown }).data)
  ) {
    return (raw as { data: unknown[] }).data;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "notifications" in raw &&
    Array.isArray((raw as { notifications: unknown }).notifications)
  ) {
    return (raw as { notifications: unknown[] }).notifications;
  }
  return [];
}

function isUnread(row: unknown) {
  if (!row || typeof row !== "object") return true;
  const o = row as Record<string, unknown>;
  if (typeof o.is_read === "boolean") return !o.is_read;
  if (typeof o.read === "boolean") return !o.read;
  if (typeof o.unread === "boolean") return o.unread;
  return true;
}

function notificationId(row: unknown): string | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = o._id ?? o.id;
  if (id && (typeof id === "string" || typeof id === "number")) return String(id);
  return null;
}

function formatRelative(v: unknown): string {
  if (v == null) return "";
  const d = new Date(v as string | number);
  const t = d.getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < -30) return d.toLocaleString();
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function moduleLabel(m: string | undefined) {
  if (!m || typeof m !== "string") return "System";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function typeVisual(t: unknown) {
  const ty = typeof t === "string" ? t.toLowerCase() : "info";
  switch (ty) {
    case "success":
      return {
        Icon: CheckCircle2,
        row: "border-l-[3px] border-l-emerald-500",
        fg: "text-emerald-600 dark:text-emerald-400",
      };
    case "warning":
      return {
        Icon: TriangleAlert,
        row: "border-l-[3px] border-l-amber-500",
        fg: "text-amber-600 dark:text-amber-400",
      };
    case "error":
      return {
        Icon: AlertCircle,
        row: "border-l-[3px] border-l-rose-500",
        fg: "text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        Icon: Info,
        row: "border-l-[3px] border-l-primary",
        fg: "text-primary",
      };
  }
}

export function NotificationBell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [hasNewPulse, setHasNewPulse] = useState(false);
  const prevUnreadRef = useRef<number | null>(null);

  const token = useSelector((s: RootState) => s.auth?.token);
  const dispatch = useDispatch();

  const { data, isFetching, isError, refetch } = useListNotificationsQuery(
    {},
    {
      pollingInterval: 30_000,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );
  const [markRead, { isLoading: marking }] = useMarkNotificationReadMutation();

  useNotificationStream(token, () => {
    void refetch();
    dispatch(baseApi.util.invalidateTags([{ type: "Notifications", id: "LIST" }]));
  });

  const rows = useMemo(() => pickNotifications(data), [data]);
  const unread = useMemo(() => rows.filter((r) => isUnread(r)).length, [rows]);

  useEffect(() => {
    if (prevUnreadRef.current === null) {
      prevUnreadRef.current = unread;
      return;
    }
    if (unread > prevUnreadRef.current && !open) {
      setHasNewPulse(true);
    }
    prevUnreadRef.current = unread;
  }, [unread, open]);

  useEffect(() => {
    if (open) setHasNewPulse(false);
  }, [open]);

  const onNotificationActivate = useCallback(
    async (row: unknown) => {
      const nid = notificationId(row);
      if (!nid) return;

      const unreadRow = isUnread(row);
      if (!unreadRow) return;

      try {
        await markRead(nid).unwrap();
      } catch {
        toast.error("Could not mark notification as read.");
      }
    },
    [markRead]
  );

  const errorToastShown = useRef(false);
  useEffect(() => {
    if (!isError) {
      errorToastShown.current = false;
      return;
    }
    if (errorToastShown.current) return;
    errorToastShown.current = true;
    toast.error("Could not load notifications.");
  }, [isError]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (
        e.target instanceof Node &&
        !rootRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-surface-muted"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Notifications${unread ? `, ${String(unread)} unread` : ""}`}
      >
        {unread > 0 ? (
          <BellRing className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        ) : (
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
        )}
        {!isFetching && unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}

        {hasNewPulse && !open ? (
          <span
            className="absolute -right-0.5 -top-0.5 h-[18px] w-[18px] animate-ping rounded-full bg-rose-500 opacity-75"
            aria-hidden
          />
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-[55] mt-2 w-[min(100vw-2rem,380px)] rounded-2xl border border-border bg-card py-2 shadow-2xl"
          role="menu"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 pb-2">
            <p className="text-xs font-semibold text-foreground">
              Notifications
            </p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Live
              </span>
              {!isFetching && !isError && rows.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Refresh
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-[min(360px,50vh)] overflow-y-auto px-1.5 pb-1 pt-1">
            {isFetching ? (
              <p className="px-2 py-3 text-xs text-muted">Loading…</p>
            ) : null}
            {isError ? (
              <p className="px-2 py-3 text-xs text-rose-500">
                Could not load notifications.
              </p>
            ) : null}
            {!isFetching && !isError && rows.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted">
                No notifications yet.
              </p>
            ) : null}

            {!isFetching && rows.length > 0 ? (
              <ul className="space-y-1" role="list">
                {rows.slice(0, 25).map((row, idx) => {
                  const o =
                    typeof row === "object" && row !== null
                      ? (row as Record<string, unknown>)
                      : {};
                  const realId = notificationId(row);
                  const nid = realId ?? `idx-${String(idx)}`;
                  const unreadRow = isUnread(row);
                  const title =
                    typeof o.title === "string" && o.title.trim()
                      ? o.title.trim()
                      : "Notification";
                  const body =
                    typeof o.message === "string" && o.message.trim()
                      ? o.message.trim()
                      : "";
                  const mod =
                    typeof o.module === "string" ? o.module : undefined;
                  const at = formatRelative(o.createdAt ?? o.created_at);
                  const tv = typeVisual(o.type);
                  const TypeIcon = tv.Icon;

                  const shellClassName = [
                    "flex w-full gap-2 rounded-lg px-2 py-2 text-left transition",
                    tv.row,
                    unreadRow
                      ? "bg-surface-muted"
                      : "opacity-[0.97]",
                  ].join(" ");

                  const bodyBlock = (
                    <>
                      <TypeIcon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${tv.fg}`}
                        strokeWidth={2}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span
                            className={
                              unreadRow
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground/80"
                            }
                          >
                            {title}
                          </span>
                          {mod ? (
                            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                              {moduleLabel(mod)}
                            </span>
                          ) : null}
                        </span>
                        {body ? (
                          <span className="mt-1 line-clamp-3 block text-xs leading-snug text-muted">
                            {body}
                          </span>
                        ) : null}
                        <span className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                          {at ? <span>{at}</span> : null}
                          {unreadRow ? (
                            <span className="rounded bg-primary px-1 py-px font-semibold uppercase tracking-wide text-[9px] text-white">
                              Unread
                            </span>
                          ) : (
                            <span className="italic">Read</span>
                          )}
                        </span>
                      </span>
                    </>
                  );

                  return (
                    <li key={nid} role="listitem">
                      {unreadRow ? (
                        <button
                          type="button"
                          disabled={Boolean(marking || !realId)}
                          onClick={() => void onNotificationActivate(row)}
                          className={[
                            shellClassName,
                            "w-full cursor-pointer hover:bg-surface-muted",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          ].join(" ")}
                          aria-label={`${title}. Unread — press to mark as read.`}
                        >
                          {bodyBlock}
                        </button>
                      ) : (
                        <div
                          className={[
                            shellClassName,
                            "cursor-default hover:bg-surface-muted/60",
                          ].join(" ")}
                          role="group"
                          aria-label={`${title}. Read`}
                        >
                          {bodyBlock}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
