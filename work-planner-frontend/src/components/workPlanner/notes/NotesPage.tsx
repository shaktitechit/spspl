"use client";

import { useState, useMemo } from "react";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Clock,
  Archive,
  CheckCircle2,
  Calendar,
  Sparkles,
  RefreshCw,
  Filter,
  CheckSquare,
  Building2,
  FileText,
  Trash2,
  Check,
  X,
  Layers,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGetNotesQuery,
  useGetNotesKpisQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
  useTogglePinNoteMutation,
  useToggleArchiveNoteMutation,
  useToggleCompleteNoteMutation,
  useBulkConvertToWorkPlanMutation,
} from "@/store/api/workPlannerApiSlice";
import type { UserNoteRecord } from "@/types/workPlanner";
import { NoteCard } from "./NoteCard";
import { NoteEditorModal } from "./NoteEditorModal";
import { BatchConvertToWorkPlanModal } from "./BatchConvertToWorkPlanModal";
import { ConfirmDeleteModal } from "../ConfirmDeleteModal";

type NoteFilterTab =
  | "all"
  | "tasks"
  | "visits"
  | "general"
  | "pending"
  | "converted"
  | "pinned"
  | "archived";

export function NotesPage() {
  const [activeTab, setActiveTab] = useState<NoteFilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [colorFilter, setColorFilter] = useState("all");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<UserNoteRecord | null>(null);
  const [editorInitialType, setEditorInitialType] = useState<"task" | "visit" | "general">("task");

  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id?: string; bulk?: boolean; count?: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Queries & Mutations
  const queryParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (activeTab === "archived") {
      p.archived = "true";
    } else {
      p.archived = "false";
    }
    if (activeTab === "tasks") p.type = "task";
    if (activeTab === "visits") p.type = "visit";
    if (activeTab === "general") p.type = "general";
    if (activeTab === "pending") p.status = "pending";
    if (activeTab === "converted") p.status = "converted";
    if (activeTab === "pinned") p.pinned = "true";

    if (categoryFilter !== "all") p.category = categoryFilter;
    if (colorFilter !== "all") p.color = colorFilter;
    if (searchQuery.trim()) p.search = searchQuery.trim();
    return p;
  }, [activeTab, categoryFilter, colorFilter, searchQuery]);

  const { data: notesList = [], isLoading, isFetching, refetch } = useGetNotesQuery(queryParams);
  const { data: kpis } = useGetNotesKpisQuery();

  const [createNoteMut, { isLoading: isCreating }] = useCreateNoteMutation();
  const [updateNoteMut, { isLoading: isUpdating }] = useUpdateNoteMutation();
  const [deleteNoteMut] = useDeleteNoteMutation();
  const [togglePinMut] = useTogglePinNoteMutation();
  const [toggleArchiveMut] = useToggleArchiveNoteMutation();
  const [toggleCompleteMut] = useToggleCompleteNoteMutation();
  const [bulkConvertMut, { isLoading: isConverting }] = useBulkConvertToWorkPlanMutation();

  // Multi-Select Handlers: only allow unconverted notes to be selected
  const unconvertedNotes = useMemo(() => {
    return notesList.filter(
      (n) => !n.is_converted_to_work_plan && !n.work_plan_date && !n.work_plan
    );
  }, [notesList]);

  const handleToggleSelect = (id: string) => {
    const targetNote = notesList.find((n) => String(n._id || n.id) === id);
    if (
      targetNote &&
      (targetNote.is_converted_to_work_plan ||
        targetNote.work_plan_date ||
        targetNote.work_plan)
    ) {
      toast.info("This item is already included in a Work Plan");
      return;
    }
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    const unconvertedIds = unconvertedNotes.map((n) => String(n._id || n.id));
    if (selectedIds.length > 0 && selectedIds.length === unconvertedIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unconvertedIds);
    }
  };

  const selectedNotesList = useMemo(() => {
    return notesList.filter((n) => selectedIds.includes(String(n._id || n.id)));
  }, [notesList, selectedIds]);

  const selectedVisitCount = useMemo(() => {
    return selectedNotesList.filter((n) => n.type === "visit").length;
  }, [selectedNotesList]);

  const selectedTaskCount = useMemo(() => {
    return selectedNotesList.filter((n) => n.type === "task").length;
  }, [selectedNotesList]);

  const selectedGeneralCount = useMemo(() => {
    return selectedNotesList.filter(
      (n) => n.type === "general" || (!n.type && n.type !== "task" && n.type !== "visit")
    ).length;
  }, [selectedNotesList]);

  // Open Create Modal with default type
  const handleOpenCreate = (noteType: "task" | "visit" | "general" = "task") => {
    setEditingNote(null);
    setEditorInitialType(noteType);
    setEditorOpen(true);
  };

  const handleOpenEdit = (note: UserNoteRecord) => {
    setEditingNote(note);
    setEditorInitialType(note.type || "task");
    setEditorOpen(true);
  };

  const handleSaveNote = async (body: Partial<UserNoteRecord>) => {
    try {
      if (editingNote) {
        const nId = String(editingNote._id || editingNote.id);
        await updateNoteMut({ id: nId, ...body }).unwrap();
        toast.success("Note updated successfully");
      } else {
        await createNoteMut(body).unwrap();
        toast.success("Note created successfully");
      }
      setEditorOpen(false);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to save note");
    }
  };

  const handleDeleteNote = (id: string) => {
    setDeleteTarget({ id });
  };

  const handleTogglePin = async (id: string) => {
    try {
      await togglePinMut(id).unwrap();
    } catch (err: any) {
      toast.error("Failed to update pin status");
    }
  };

  const handleToggleArchive = async (id: string) => {
    try {
      await toggleArchiveMut(id).unwrap();
      toast.success("Archive status updated");
    } catch (err: any) {
      toast.error("Failed to update archive status");
    }
  };

  const handleToggleComplete = async (id: string) => {
    try {
      await toggleCompleteMut(id).unwrap();
    } catch (err: any) {
      toast.error("Failed to update task status");
    }
  };

  const handleSingleConvertToWorkPlan = (note: UserNoteRecord) => {
    setSelectedIds([String(note._id || note.id)]);
    setConvertModalOpen(true);
  };

  // Bulk Delete
  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setDeleteTarget({ bulk: true, count: selectedIds.length });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.bulk && selectedIds.length > 0) {
        await Promise.all(selectedIds.map((id) => deleteNoteMut(id).unwrap()));
        setSelectedIds([]);
        toast.success(`Deleted ${selectedIds.length} note(s)`);
      } else if (deleteTarget.id) {
        await deleteNoteMut(deleteTarget.id).unwrap();
        setSelectedIds((prev) => prev.filter((item) => item !== deleteTarget.id));
        toast.success("Note deleted");
      }
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to delete note");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Top Banner Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-2xs">
              <StickyNote className="h-4.5 w-4.5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                Notes &amp; Scratchpad
              </h1>
              <p className="text-[11px] text-muted">
                Capture tasks, customer visits, and memos. Select items to make or import into daily Work Plans.
              </p>
            </div>
          </div>
        </div>

        {/* Creation Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg border border-border bg-surface p-2 text-muted hover:bg-surface-hover hover:text-foreground transition shadow-2xs cursor-pointer"
            title="Refresh Notes"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-primary" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate("task")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition shadow-2xs cursor-pointer"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            + Task
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate("visit")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition shadow-2xs cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5" />
            + Visit
          </button>

          <button
            type="button"
            onClick={() => handleOpenCreate("general")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            + Quick Note
          </button>
        </div>
      </div>

      {/* Compact KPI Stats Overview */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <div
          onClick={() => setActiveTab("all")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "all"
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">All Notes</span>
            <Layers className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-foreground">{kpis?.total ?? 0}</p>
        </div>

        <div
          onClick={() => setActiveTab("tasks")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "tasks"
              ? "border-blue-500 bg-blue-500/5 ring-1 ring-blue-500"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tasks</span>
            <CheckSquare className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-blue-600 dark:text-blue-400">
            {kpis?.tasks ?? 0}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("visits")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "visits"
              ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Visits</span>
            <Building2 className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-amber-600 dark:text-amber-400">
            {kpis?.visits ?? 0}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("pending")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "pending"
              ? "border-rose-500 bg-rose-500/5 ring-1 ring-rose-500"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Not In Plan</span>
            <Clock className="h-3.5 w-3.5 text-rose-500" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-rose-600 dark:text-rose-400">
            {kpis?.pending ?? 0}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("converted")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "converted"
              ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">In Work Plan</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
            {kpis?.converted ?? 0}
          </p>
        </div>

        <div
          onClick={() => setActiveTab("pinned")}
          className={`rounded-xl border p-2.5 transition cursor-pointer ${
            activeTab === "pinned"
              ? "border-amber-500 bg-amber-500/5 ring-1 ring-amber-500"
              : "border-border bg-card hover:bg-surface-muted/40"
          }`}
        >
          <div className="flex items-center justify-between text-muted">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pinned / Remind</span>
            <Pin className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="mt-0.5 text-lg font-extrabold text-foreground">
            {kpis?.reminders ?? 0}
          </p>
        </div>
      </div>

      {/* Compact Filter Navigation Bar & Search */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
          {[
            { id: "all", label: "All" },
            { id: "tasks", label: "Tasks" },
            { id: "visits", label: "Visits" },
            { id: "general", label: "Quick Notes" },
            { id: "pending", label: "Not In Plan" },
            { id: "converted", label: "Plan Added" },
            { id: "pinned", label: "Pinned" },
            { id: "archived", label: "Archived" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as NoteFilterTab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input & Select All */}
        <div className="flex items-center gap-2">
          {unconvertedNotes.length > 0 && (
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-bold text-foreground hover:bg-surface-muted transition cursor-pointer shrink-0"
            >
              {selectedIds.length > 0 && selectedIds.length === unconvertedNotes.length
                ? "Deselect All"
                : "Select All"}
            </button>
          )}

          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, party, notes..."
              className="w-full rounded-lg border border-border bg-surface pl-7 pr-2.5 py-1 text-xs font-semibold text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden"
            />
            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted" />
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-48 animate-pulse rounded-2xl border border-border bg-surface-muted/40"
            />
          ))}
        </div>
      ) : notesList.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/60 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <StickyNote className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-foreground">No notes found</h3>
          <p className="text-xs text-muted max-w-sm mx-auto mt-1 mb-5">
            {activeTab === "archived"
              ? "You don't have any archived notes."
              : activeTab === "pending"
                ? "All your task and visit notes are currently attached to Work Plans!"
                : "Create a Task Note, Visit Note, or Quick Memo to get started."}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreate("task")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Task Note
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreate("visit")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
            >
              <Building2 className="h-4 w-4" />
              Add Visit Note
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notesList.map((note) => {
            const nId = String(note._id || note.id);
            return (
              <NoteCard
                key={nId}
                note={note}
                isSelected={selectedIds.includes(nId)}
                onToggleSelect={handleToggleSelect}
                onEdit={handleOpenEdit}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
                onToggleArchive={handleToggleArchive}
                onToggleComplete={handleToggleComplete}
                onConvertToWorkPlan={handleSingleConvertToWorkPlan}
              />
            );
          })}
        </div>
      )}

      {/* Floating Sticky Multi-Select Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-3 sm:px-4 animate-in slide-in-from-bottom-5">
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-md p-2.5 sm:p-3.5 shadow-2xl ring-1 ring-primary/20">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-xl bg-primary text-primary-foreground text-[11px] sm:text-xs font-extrabold shrink-0">
                {selectedIds.length}
              </span>
              <div className="text-xs font-bold text-foreground truncate">
                <span className="hidden sm:inline">Selected: </span>
                <span className="text-muted font-semibold truncate">
                  {[
                    selectedVisitCount > 0 ? `${selectedVisitCount} Visit` : "",
                    selectedTaskCount > 0 ? `${selectedTaskCount} Task` : "",
                    selectedGeneralCount > 0 ? `${selectedGeneralCount} Memo` : "",
                  ]
                    .filter(Boolean)
                    .join(", ") || `${selectedIds.length} Items`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition cursor-pointer"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                className="rounded-xl border border-border bg-surface p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                title="Delete Selected"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setConvertModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-sm cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                Make Work Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {editorOpen && (
        <NoteEditorModal
          open={editorOpen}
          initialNote={editingNote}
          initialType={editorInitialType}
          isSaving={isCreating || isUpdating}
          onClose={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
          onSave={handleSaveNote}
        />
      )}

      {convertModalOpen && (
        <BatchConvertToWorkPlanModal
          open={convertModalOpen}
          selectedNotes={selectedNotesList}
          onClose={() => setConvertModalOpen(false)}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          open={Boolean(deleteTarget)}
          title={deleteTarget.bulk ? `Delete ${deleteTarget.count || selectedIds.length} Notes?` : "Delete Note?"}
          description={
            deleteTarget.bulk
              ? `Are you sure you want to delete ${deleteTarget.count || selectedIds.length} selected notes from your Scratchpad? This action cannot be undone.`
              : "Are you sure you want to delete this note from your Scratchpad? This action cannot be undone."
          }
          confirmLabel={deleteTarget.bulk ? `Delete ${deleteTarget.count || selectedIds.length} Notes` : "Delete Note"}
          isDeleting={isDeleting}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
