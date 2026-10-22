"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { LargeModalPortal } from "./LargeModalPortal";

export interface SlideOverDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
};

export function SlideOverDrawer({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = "lg",
}: SlideOverDrawerProps) {
  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = SIZE_CLASSES[size] || "max-w-lg";

  return (
    <LargeModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className={`relative flex h-full w-full ${sizeClass} flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200 transition-colors`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              {Icon && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                  {title}
                </h3>
                {subtitle && (
                  <div className="text-xs text-muted truncate mt-0.5">{subtitle}</div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Close drawer"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Form / Content Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 scrollbar-none">
            {children}
          </div>

          {/* Optional Sticky Footer */}
          {footer && (
            <div className="shrink-0 border-t border-border/80 bg-surface-muted/40 p-4 sm:px-6">
              {footer}
            </div>
          )}
        </div>
      </div>
    </LargeModalPortal>
  );
}
