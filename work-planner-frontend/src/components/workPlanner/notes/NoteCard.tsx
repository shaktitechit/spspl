"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit3,
  Clock,
  CheckSquare,
  Square,
  Building2,
  Calendar,
  ExternalLink,
  PlusCircle,
  Tag,
  AlertTriangle,
  ArrowRight,
  MapPin,
  Phone,
  User as UserIcon,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import type { UserNoteRecord } from "@/types/workPlanner";
import { formatPlanDate } from "../workPlanUtils";

interface NoteCardProps {
  note: UserNoteRecord;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onEdit: (note: UserNoteRecord) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onToggleComplete?: (id: string) => void;
  onConvertToWorkPlan?: (note: UserNoteRecord) => void;
}

const COLOR_CLASSES: Record<
  string,
  { bg: string; border: string; header: string; accent: string }
> = {
  default: {
    bg: "bg-card hover:bg-card/90",
    border: "border-border",
    header: "text-foreground",
    accent: "text-primary",
  },
  emerald: {
    bg: "bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/20",
    border: "border-emerald-500/30",
    header: "text-emerald-900 dark:text-emerald-100",
    accent: "text-emerald-600 dark:text-emerald-400",
  },
  blue: {
    bg: "bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-950/20",
    border: "border-blue-500/30",
    header: "text-blue-900 dark:text-blue-100",
    accent: "text-blue-600 dark:text-blue-400",
  },
  amber: {
    bg: "bg-amber-500/5 hover:bg-amber-500/10 dark:bg-amber-950/20",
    border: "border-amber-500/30",
    header: "text-amber-900 dark:text-amber-100",
    accent: "text-amber-600 dark:text-amber-400",
  },
  rose: {
    bg: "bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/20",
    border: "border-rose-500/30",
    header: "text-rose-900 dark:text-rose-100",
    accent: "text-rose-600 dark:text-rose-400",
  },
  purple: {
    bg: "bg-purple-500/5 hover:bg-purple-500/10 dark:bg-purple-950/20",
    border: "border-purple-500/30",
    header: "text-purple-900 dark:text-purple-100",
    accent: "text-purple-600 dark:text-purple-400",
  },
};

export function NoteCard({
  note,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleArchive,
  onToggleComplete,
  onConvertToWorkPlan,
}: NoteCardProps) {
  const noteId = String(note._id || note.id || "");
  const colorScheme = COLOR_CLASSES[note.color || "default"] || COLOR_CLASSES.default;

  const isConverted = Boolean(
    note.is_converted_to_work_plan || note.work_plan_date || note.work_plan
  );

  const reminderDate =
    note.reminder?.enabled && note.reminder?.remind_at
      ? new Date(note.reminder.remind_at)
      : null;
  const isReminderDue = reminderDate ? reminderDate.getTime() <= Date.now() : false;

  const workPlanId =
    typeof note.work_plan === "object" && note.work_plan
      ? (note.work_plan as any)._id || (note.work_plan as any).id
      : note.work_plan;

  const planDateParam = note.work_plan_date
    ? typeof note.work_plan_date === "string"
      ? note.work_plan_date.substring(0, 10)
      : new Date(note.work_plan_date).toISOString().substring(0, 10)
    : "";

  const planHref = workPlanId
    ? `/dashboard/plans/${workPlanId}`
    : planDateParam
      ? `/dashboard/plans?date=${planDateParam}`
      : `/dashboard/plans`;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-xl border p-3.5 sm:p-4 transition-all duration-200 shadow-2xs hover:shadow-xs ${
        colorScheme.bg
      } ${isSelected ? "ring-2 ring-primary border-primary" : colorScheme.border}`}
    >
      {/* Top Header Toolbar */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Multi-Select Checkbox (Only for unconverted notes) */}
            {!isConverted && onToggleSelect && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(noteId);
                }}
                className={`flex h-4.5 w-4.5 items-center justify-center rounded border transition cursor-pointer ${
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border bg-surface hover:border-primary text-transparent"
                }`}
                title={isSelected ? "Deselect item" : "Select item for Work Plan"}
              >
                <CheckSquare className={`h-3 w-3 ${isSelected ? "block" : "hidden"}`} />
              </button>
            )}

            {/* Type Badge */}
            {note.type === "task" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                <CheckSquare className="h-2.5 w-2.5" />
                Task
              </span>
            )}
            {note.type === "visit" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                <Building2 className="h-2.5 w-2.5" />
                Visit
              </span>
            )}
            {note.type === "general" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                <FileText className="h-2.5 w-2.5" />
                Quick Note
              </span>
            )}

            {/* Priority Badge (Tasks) */}
            {note.type === "task" && note.priority && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  note.priority === "urgent" || note.priority === "high"
                    ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                    : note.priority === "medium"
                      ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                      : "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                }`}
              >
                {note.priority}
              </span>
            )}

            {/* Pinned Pill */}
            {note.is_pinned && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                <Pin className="h-2.5 w-2.5 fill-amber-500" />
                Pinned
              </span>
            )}

            {/* Category Pill */}
            {note.category && note.category !== "general" && (
              <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted border border-border">
                {note.category.replace(/_/g, " ")}
              </span>
            )}
          </div>

          {/* Quick Icon Actions */}
          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={() => onTogglePin(noteId)}
              className={`rounded-md p-1 transition cursor-pointer ${
                note.is_pinned
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
              title={note.is_pinned ? "Unpin Note" : "Pin to Top"}
            >
              {note.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>

            <button
              type="button"
              onClick={() => onToggleArchive(noteId)}
              className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title={note.is_archived ? "Unarchive Note" : "Archive Note"}
            >
              {note.is_archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
            </button>

            <button
              type="button"
              onClick={() => onEdit(note)}
              className="rounded-md p-1 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Edit Note"
            >
              <Edit3 className="h-3 w-3" />
            </button>

            <button
              type="button"
              onClick={() => onDelete(noteId)}
              className="rounded-md p-1 text-muted hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer"
              title="Delete Note"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Title & Body */}
        <div className="space-y-1">
          {note.type === "task" ? (
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {note.is_completed && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                )}
                <h3
                  className={`text-xs font-bold text-foreground leading-snug ${
                    note.is_completed ? "line-through text-muted opacity-70" : ""
                  }`}
                >
                  {note.title}
                </h3>
              </div>
              {note.target_date && (
                <p className="text-[10px] text-muted flex items-center gap-1 font-medium">
                  <Calendar className="h-2.5 w-2.5" />
                  Due: {new Date(note.target_date).toLocaleDateString()}
                </p>
              )}
              {note.description && (
                <p className="text-xs text-muted leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {note.description}
                </p>
              )}
            </div>
          ) : note.type === "visit" ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <h3 className="text-xs font-bold text-foreground truncate">
                  {note.party_name || note.title}
                </h3>
              </div>

              {/* Visit Details Grid */}
              <div className="rounded-lg border border-border/70 bg-surface/60 p-2 space-y-1 text-[11px] text-muted">
                {(() => {
                  const visitContacts = Array.isArray(note.contacts) && note.contacts.length > 0
                    ? note.contacts
                    : (note.contact_person || note.contact_number)
                      ? [{ contact_person: note.contact_person, contact_number: note.contact_number }]
                      : [];
                  if (visitContacts.length === 0) return null;
                  const primary = visitContacts[0];
                  const extraCount = visitContacts.length - 1;
                  return (
                    <div className="flex items-center gap-1 text-foreground font-medium flex-wrap">
                      <UserIcon className="h-2.5 w-2.5 text-muted shrink-0" />
                      <span className="truncate">
                        {primary.contact_person} {primary.contact_number ? `(${primary.contact_number})` : ""}
                      </span>
                      {extraCount > 0 && (
                        <span
                          className="inline-flex rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary"
                          title={visitContacts.slice(1).map((c) => `${c.contact_person} (${c.contact_number})`).join(", ")}
                        >
                          +{extraCount} more
                        </span>
                      )}
                    </div>
                  );
                })()}
                {(note.locality || note.city) && (
                  <div className="flex items-center gap-1 truncate text-[10px]">
                    <MapPin className="h-2.5 w-2.5 text-muted shrink-0" />
                    <span>{[note.locality, note.city].filter(Boolean).join(", ")}</span>
                  </div>
                )}
                {note.purpose && (
                  <div className="flex items-center gap-1 truncate text-[10px]">
                    <Tag className="h-2.5 w-2.5 text-muted shrink-0" />
                    <span>Purpose: {note.purpose}</span>
                  </div>
                )}
                {note.planned_time && (
                  <div className="flex items-center gap-1 text-foreground font-medium text-[10px]">
                    <Clock className="h-2.5 w-2.5 text-muted shrink-0" />
                    <span>Time: {note.planned_time}</span>
                  </div>
                )}
              </div>

              {note.description && (
                <div className="rounded-md bg-surface-muted/40 p-1.5 border border-border/50 text-[11px] text-muted leading-relaxed line-clamp-2">
                  <span className="font-semibold text-foreground not-italic">Notes: </span>
                  <span>{note.description}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-foreground leading-snug">
                {note.title}
              </h3>
              {(note.content || note.description) && (
                <p className="text-xs text-muted leading-relaxed line-clamp-3 whitespace-pre-wrap">
                  {note.content || note.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {note.tags.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-muted border border-border"
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Conversion status, Reminders & Quick Action */}
      <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
        {/* Work Plan Link Status Banner */}
        {note.is_converted_to_work_plan ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 truncate">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span>Work Plan Added: {note.work_plan_date ? formatPlanDate(note.work_plan_date) : "Assigned"}</span>
            </span>
            <Link
              href={planHref}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              View Plan <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Not in Work Plan
            </span>
            {onConvertToWorkPlan && (
              <button
                type="button"
                onClick={() => onConvertToWorkPlan(note)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1 text-[11px] font-bold transition cursor-pointer"
                title="Convert this note into a daily Work Plan"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add to Plan
              </button>
            )}
          </div>
        )}

        {/* Reminder Badge */}
        {note.reminder?.enabled && reminderDate && (
          <div
            className={`flex items-center justify-between text-[10px] rounded-md px-2 py-0.5 border ${
              isReminderDue
                ? "bg-rose-500/10 text-rose-600 border-rose-500/25 font-bold"
                : "bg-surface-muted text-muted border-border font-medium"
            }`}
          >
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Reminder: {reminderDate.toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
            </span>
            {note.reminder.notify_email && <span className="opacity-75">📧 Email On</span>}
          </div>
        )}
      </div>
    </div>
  );
}
