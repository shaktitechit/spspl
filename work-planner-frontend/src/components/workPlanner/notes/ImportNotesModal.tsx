"use client";

import { useState, useMemo } from "react";
import {
  X,
  Search,
  Building2,
  CheckSquare,
  Square,
  Clock,
  MapPin,
  Tag,
  Plus,
  StickyNote,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User as UserIcon,
  Calendar,
  FileText,
  Sparkles,
} from "lucide-react";
import { useGetNotesQuery } from "@/store/api/workPlannerApiSlice";
import type { UserNoteRecord, WorkPlanVisitRecord, WorkPlanWorkRecord } from "@/types/workPlanner";

interface ImportNotesModalProps {
  open: boolean;
  mode: "visits" | "tasks";
  onClose: () => void;
  onImportVisits?: (visits: Partial<WorkPlanVisitRecord>[], noteIds: string[]) => void;
  onImportTasks?: (works: Partial<WorkPlanWorkRecord>[], noteIds: string[]) => void;
}

export function ImportNotesModal({
  open,
  mode,
  onClose,
  onImportVisits,
  onImportTasks,
}: ImportNotesModalProps) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [taskSubFilter, setTaskSubFilter] = useState<"all" | "task" | "general">("all");

  // Fetch pending notes
  const { data: notesRes, isLoading } = useGetNotesQuery(
    {
      status: "pending",
      type: mode === "visits" ? "visit" : "all",
    },
    { skip: !open }
  );

  const rawNotesList: UserNoteRecord[] = useMemo(() => {
    if (Array.isArray(notesRes)) return notesRes;
    if (Array.isArray((notesRes as any)?.data)) return (notesRes as any).data;
    return [];
  }, [notesRes]);

  // Restrict to visits for mode === "visits", or (task | general) for mode === "tasks"
  const notesList: UserNoteRecord[] = useMemo(() => {
    if (mode === "visits") {
      return rawNotesList.filter((n) => n.type === "visit");
    }
    // mode === "tasks" includes tasks and quick notes (general)
    return rawNotesList.filter((n) => n.type === "task" || n.type === "general" || !n.type);
  }, [rawNotesList, mode]);

  // Filter notes by sub-tab (for tasks) and search query
  const filteredNotes = useMemo(() => {
    return notesList.filter((n) => {
      // Sub-type filter
      if (mode === "tasks") {
        if (taskSubFilter === "task" && n.type !== "task") return false;
        if (taskSubFilter === "general" && n.type !== "general") return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const title = (n.title || "").toLowerCase();
      const party = (n.party_name || "").toLowerCase();
      const city = (n.city || "").toLowerCase();
      const locality = (n.locality || "").toLowerCase();
      const desc = (n.description || n.content || "").toLowerCase();
      const category = (n.category || "").toLowerCase();

      return (
        title.includes(q) ||
        party.includes(q) ||
        city.includes(q) ||
        locality.includes(q) ||
        desc.includes(q) ||
        category.includes(q)
      );
    });
  }, [notesList, mode, taskSubFilter, search]);

  if (!open) return null;

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.length === filteredNotes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotes.map((n) => String(n._id || n.id)));
    }
  };

  const handleImport = () => {
    const selectedNotes = notesList.filter((n) =>
      selectedIds.includes(String(n._id || n.id))
    );

    if (mode === "visits" && onImportVisits) {
      const mappedVisits: Partial<WorkPlanVisitRecord>[] = selectedNotes.map((n) => {
        const contacts = Array.isArray(n.contacts) && n.contacts.length > 0
          ? n.contacts
          : (n.contact_person || n.contact_number)
            ? [{ contact_person: n.contact_person || "", contact_number: n.contact_number || "" }]
            : [];

        return {
          party: typeof n.party === "object" && n.party ? (n.party as any)._id : n.party || undefined,
          party_name: n.party_name || n.title || "Party Visit",
          party_type: (n.party_type as any) || "existing",
          contacts,
          contact_person: n.contact_person || contacts[0]?.contact_person || "",
          contact_number: n.contact_number || contacts[0]?.contact_number || "",
          locality: n.locality || "",
          city: n.city || "",
          purpose: n.purpose || "Sales Discussion",
          planned_start_time: n.planned_time || "",
          notes: n.description || n.content || "",
          remarks: n.description || n.content || "",
          status: "created",
        };
      });

      onImportVisits(mappedVisits, selectedIds);
    } else if (mode === "tasks" && onImportTasks) {
      const mappedWorks: Partial<WorkPlanWorkRecord>[] = selectedNotes.map((n) => ({
        title: n.title || (n.content ? (n.content.length > 60 ? n.content.substring(0, 57) + "..." : n.content) : "Quick Note Task"),
        description: n.description || n.content || "",
        priority: (n.priority as any) || "medium",
        status: "created",
      }));

      onImportTasks(mappedWorks, selectedIds);
    }

    onClose();
  };

  const taskCount = notesList.filter((n) => n.type === "task").length;
  const generalCount = notesList.filter((n) => n.type === "general").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-surface-muted/50">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {mode === "visits" ? "Import Field Visits from Scratchpad" : "Import Tasks & Quick Notes from Scratchpad"}
              </h2>
              <p className="text-xs text-muted">
                {mode === "visits"
                  ? "Select your private visit notes to import directly into this Work Plan"
                  : "Select tasks or quick notes to import as planned tasks in this Work Plan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-Tabs for Task mode */}
        {mode === "tasks" && (
          <div className="px-4 pt-3 pb-1 border-b border-border bg-surface-muted/20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTaskSubFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                taskSubFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-surface text-muted hover:text-foreground border border-border"
              }`}
            >
              All Items ({notesList.length})
            </button>
            <button
              type="button"
              onClick={() => setTaskSubFilter("task")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                taskSubFilter === "task"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-surface text-muted hover:text-blue-600 border border-border"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Tasks ({taskCount})
            </button>
            <button
              type="button"
              onClick={() => setTaskSubFilter("general")}
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold transition cursor-pointer ${
                taskSubFilter === "general"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "bg-surface text-muted hover:text-purple-600 border border-border"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Quick Notes ({generalCount})
            </button>
          </div>
        )}

        {/* Search Bar & Select All */}
        <div className="p-4 border-b border-border bg-surface flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${
                mode === "visits"
                  ? "visit notes by customer, city, notes..."
                  : "tasks and quick notes by title, content, category..."
              }...`}
              className="w-full rounded-xl border border-border bg-surface-muted/40 pl-9 pr-3.5 py-2 text-xs font-semibold text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          </div>

          {filteredNotes.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-muted transition cursor-pointer shrink-0"
            >
              {selectedIds.length === filteredNotes.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {/* List Content */}
        <div className="p-4 max-h-96 overflow-y-auto space-y-2.5">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-muted flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading your scratchpad notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <StickyNote className="h-8 w-8 text-muted mx-auto opacity-40" />
              <p className="text-xs font-bold text-foreground">
                No unadded {mode === "visits" ? "visit" : "task/quick"} notes found
              </p>
              <p className="text-[11px] text-muted max-w-sm mx-auto">
                All your {mode === "visits" ? "visit" : "task and quick"} notes have already been added to Work Plans, or none match your filter.
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => {
              const nId = String(note._id || note.id);
              const isSelected = selectedIds.includes(nId);

              const visitContacts = Array.isArray(note.contacts) && note.contacts.length > 0
                ? note.contacts
                : (note.contact_person || note.contact_number)
                  ? [{ contact_person: note.contact_person, contact_number: note.contact_number }]
                  : [];
              const primaryContact = visitContacts[0];
              const extraCount = visitContacts.length - 1;

              return (
                <div
                  key={nId}
                  onClick={() => handleToggleSelect(nId)}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 transition cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-surface-muted/50"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border transition ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border bg-surface"
                      }`}
                    >
                      <CheckSquare className={`h-3.5 w-3.5 ${isSelected ? "block" : "hidden"}`} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    {mode === "visits" ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="text-xs font-bold text-foreground truncate">
                            {note.party_name || note.title}
                          </span>
                          {note.purpose && (
                            <span className="rounded bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted border border-border">
                              {note.purpose}
                            </span>
                          )}
                          {note.planned_time && (
                            <span className="text-[10px] text-muted flex items-center gap-1 font-medium">
                              <Clock className="h-3 w-3" /> {note.planned_time}
                            </span>
                          )}
                        </div>

                        {/* Contacts & Locality */}
                        <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
                          {primaryContact && (
                            <span className="flex items-center gap-1 text-foreground font-medium">
                              <UserIcon className="h-3 w-3 text-muted shrink-0" />
                              <span>
                                {primaryContact.contact_person}{" "}
                                {primaryContact.contact_number ? `(${primaryContact.contact_number})` : ""}
                              </span>
                              {extraCount > 0 && (
                                <span className="inline-flex rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                                  +{extraCount} more
                                </span>
                              )}
                            </span>
                          )}
                          {(note.locality || note.city) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted shrink-0" />
                              <span>{[note.locality, note.city].filter(Boolean).join(", ")}</span>
                            </span>
                          )}
                        </div>

                        {/* Description / Remarks */}
                        {note.description && (
                          <div className="rounded-lg bg-surface-muted/50 p-2 text-xs text-muted leading-relaxed border border-border/40">
                            <span className="font-semibold text-foreground">Agenda / Notes: </span>
                            <span>{note.description}</span>
                          </div>
                        )}
                      </div>
                    ) : note.type === "general" ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="h-4 w-4 text-purple-500 shrink-0" />
                          <span className="text-xs font-bold text-foreground">
                            {note.title || "Untitled Quick Note"}
                          </span>
                          <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.2 text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                            Quick Note
                          </span>
                          {note.category && note.category !== "general" && (
                            <span className="rounded bg-surface-muted px-1.5 py-0.2 text-[9px] font-semibold text-muted border border-border uppercase">
                              {note.category.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>

                        {/* Note Content / Description */}
                        {(note.content || note.description) && (
                          <div className="rounded-lg bg-surface-muted/50 p-2 text-xs text-muted leading-relaxed border border-border/40 line-clamp-2">
                            <span>{note.content || note.description}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckSquare className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-xs font-bold text-foreground">
                            {note.title}
                          </span>
                          <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                            Task
                          </span>
                          {note.priority && (
                            <span
                              className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
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
                          {note.target_date && (
                            <span className="text-[10px] text-muted font-medium flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {new Date(note.target_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {(note.description || note.content) && (
                          <div className="rounded-lg bg-surface-muted/50 p-2 text-xs text-muted leading-relaxed border border-border/40">
                            <span className="font-semibold text-foreground">Description: </span>
                            <span>{note.description || note.content}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-surface-muted/30">
          <span className="text-xs font-semibold text-muted">
            {selectedIds.length} item(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Import Selected ({selectedIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
