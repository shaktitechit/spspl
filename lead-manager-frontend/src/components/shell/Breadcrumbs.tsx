"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Home,
  Users,
  CalendarDays,
  BarChart3,
  FileText,
  TrendingUp,
  BookOpen,
  Network,
  User,
  PlusCircle,
  Pencil,
  Eye,
} from "lucide-react";

interface CrumbItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  isCurrent: boolean;
}

const SEGMENT_MAP: Record<
  string,
  { label: string; icon?: React.ComponentType<{ className?: string }> }
> = {
  dashboard: { label: "Control Center", icon: Home },
  leads: { label: "Leads", icon: Users },
  "follow-ups": { label: "Follow-Ups", icon: CalendarDays },
  reports: { label: "Reports", icon: BarChart3 },
  create: { label: "New Lead", icon: PlusCircle },
  new: { label: "New Lead", icon: PlusCircle },
  edit: { label: "Edit", icon: Pencil },
  quotations: { label: "Quotations", icon: FileText },
  terms: { label: "Terms & Conditions", icon: BookOpen },
  "team-manager": { label: "Team Manager", icon: Network },
  profile: { label: "Profile", icon: User },
};

export function Breadcrumbs() {
  const pathname = usePathname();

  const crumbs = useMemo<CrumbItem[]>(() => {
    if (!pathname) return [];

    const segments = pathname.split("/").filter(Boolean);
    const result: CrumbItem[] = [];

    let accumulatedPath = "";

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      accumulatedPath += `/${seg}`;

      const isCurrent = i === segments.length - 1;

      // Handle MongoDB ObjectIds (24 hex characters) or numeric IDs
      const isId = /^[a-f\d]{24}$/i.test(seg) || /^\d+$/.test(seg);

      if (isId) {
        const prevSeg = segments[i - 1];
        const label = prevSeg === "leads" ? "Lead Details" : prevSeg === "quotations" ? "Quotation Details" : `#${seg.slice(-6)}`;
        result.push({
          label,
          href: accumulatedPath,
          icon: Eye,
          isCurrent,
        });
        continue;
      }

      const mapped = SEGMENT_MAP[seg.toLowerCase()];
      if (mapped) {
        result.push({
          label: mapped.label,
          href: accumulatedPath,
          icon: mapped.icon,
          isCurrent,
        });
      } else {
        // Fallback for custom or dynamic sub-routes
        const formattedLabel = seg
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

        result.push({
          label: formattedLabel,
          href: accumulatedPath,
          isCurrent,
        });
      }
    }

    return result;
  }, [pathname]);

  if (crumbs.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumbs"
      className="flex items-center gap-1.5 text-xs font-medium text-muted overflow-x-auto scrollbar-none py-1"
    >
      {crumbs.map((crumb, idx) => {
        const Icon = crumb.icon;
        const isFirst = idx === 0;
        const isLast = idx === crumbs.length - 1;

        return (
          <React.Fragment key={crumb.href}>
            {!isFirst && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/60" />
            )}

            {isLast ? (
              <span
                className="flex items-center gap-1.5 font-bold text-foreground truncate max-w-[180px] sm:max-w-[260px]"
                title={crumb.label}
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-primary shrink-0" />}
                <span className="truncate">{crumb.label}</span>
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="flex items-center gap-1.5 text-muted hover:text-foreground transition-colors hover:underline underline-offset-4 shrink-0"
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-muted/80 shrink-0" />}
                <span className="hidden sm:inline">{crumb.label}</span>
                {isFirst && <span className="sm:hidden">{crumb.label}</span>}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
