"use client";

import React from "react";

/**
 * Shimmering table rows placeholder for high-density data tables.
 */
export function TableSkeletonRows({
  rows = 8,
  cols = 12,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="px-3.5 py-3.5">
              <div
                className="h-3.5 rounded-md bg-surface-muted"
                style={{
                  width:
                    cIdx === 0
                      ? "18px"
                      : cIdx === 1
                      ? "80px"
                      : cIdx === 2
                      ? "140px"
                      : `${Math.max(50, ((rIdx * 17 + cIdx * 29) % 70) + 40)}px`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Shimmering card feed placeholder for mobile and tablet views.
 */
export function CardSkeletonFeed({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-surface-muted" />
              <div className="h-4 w-28 rounded bg-surface-muted" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-16 rounded-full bg-surface-muted" />
              <div className="h-5 w-12 rounded-md bg-surface-muted" />
            </div>
          </div>

          <div className="space-y-2 py-1">
            <div className="h-4 w-44 rounded bg-surface-muted" />
            <div className="h-3.5 w-60 rounded bg-surface-muted" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-24 rounded-lg bg-surface-muted" />
              <div className="h-6 w-32 rounded-lg bg-surface-muted" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted/50 p-2.5">
            <div className="space-y-1">
              <div className="h-2.5 w-14 rounded bg-surface-muted" />
              <div className="h-3.5 w-24 rounded bg-surface-muted" />
            </div>
            <div className="space-y-1">
              <div className="h-2.5 w-14 rounded bg-surface-muted" />
              <div className="h-3.5 w-20 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 3-Column Split-Pane Detail Workspace Skeleton.
 */
export function DetailWorkspaceSkeleton() {
  return (
    <div className="space-y-5 animate-pulse pb-16 font-sans">
      {/* Header Bar Skeleton */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-surface-muted shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 rounded-lg bg-surface-muted" />
                <div className="h-6 w-48 rounded-lg bg-surface-muted" />
              </div>
              <div className="h-3.5 w-36 rounded bg-surface-muted" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 rounded-xl bg-surface-muted" />
            <div className="h-8 w-24 rounded-xl bg-surface-muted" />
            <div className="h-8 w-24 rounded-xl bg-surface-muted" />
          </div>
        </div>
      </div>

      {/* Lifecycle Stepper Skeleton */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="h-4 w-40 rounded bg-surface-muted mb-3.5" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/30 p-2.5"
            >
              <div className="h-7 w-7 rounded-lg bg-surface-muted shrink-0" />
              <div className="space-y-1 min-w-0 flex-1">
                <div className="h-3 w-16 rounded bg-surface-muted" />
                <div className="h-2.5 w-20 rounded bg-surface-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Columns */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* Left Column (3 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
            <div className="h-4 w-28 rounded bg-surface-muted" />
            <div className="h-5 w-36 rounded bg-surface-muted" />
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="h-8 rounded-xl bg-surface-muted" />
              <div className="h-8 rounded-xl bg-surface-muted" />
            </div>
            <div className="space-y-3 pt-3 border-t border-border/60">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-2.5 w-20 rounded bg-surface-muted" />
                  <div className="h-3.5 w-32 rounded bg-surface-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Column (6 cols) */}
        <div className="lg:col-span-8 xl:col-span-6 space-y-4">
          <div className="flex gap-2 border-b border-border/80 pb-1">
            <div className="h-8 w-28 rounded-xl bg-surface-muted" />
            <div className="h-8 w-28 rounded-xl bg-surface-muted" />
            <div className="h-8 w-28 rounded-xl bg-surface-muted" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
            <div className="h-4 w-40 rounded bg-surface-muted" />
            <div className="h-16 w-full rounded-xl bg-surface-muted/50" />
            <div className="h-4 w-32 rounded bg-surface-muted mt-4" />
            <div className="h-28 w-full rounded-xl bg-surface-muted/50" />
          </div>
        </div>

        {/* Right Column (3 cols) */}
        <div className="lg:col-span-12 xl:col-span-3 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="h-4 w-28 rounded bg-surface-muted" />
            <div className="h-10 w-full rounded-xl bg-surface-muted/50" />
            <div className="h-10 w-full rounded-xl bg-surface-muted/50" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-xs">
            <div className="h-4 w-32 rounded bg-surface-muted" />
            <div className="space-y-2">
              <div className="h-3.5 w-24 rounded bg-surface-muted" />
              <div className="h-4 w-36 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
