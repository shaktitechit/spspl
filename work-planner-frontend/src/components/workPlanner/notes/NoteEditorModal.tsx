"use client";

import { useEffect, useState, useMemo } from "react";
import {
  X,
  Save,
  Clock,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Tag,
  CheckSquare,
  AlertTriangle,
  Sparkles,
  Pin,
  Search,
  ChevronDown,
  User,
  Phone,
  MapPin,
  FileText,
  Mail,
  Bell,
  CheckCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { UserNoteRecord, UserNoteContact } from "@/types/workPlanner";
import type { PartyRecord } from "@/types/party";
import { useGetPartiesQuery } from "@/store/api/partyApiSlice";

interface NoteEditorModalProps {
  open: boolean;
  initialNote?: UserNoteRecord | null;
  initialType?: "task" | "visit" | "general";
  isSaving: boolean;
  onClose: () => void;
  onSave: (body: Partial<UserNoteRecord>) => Promise<void>;
}

const NOTE_COLORS = [
  { id: "default", label: "Default", ring: "ring-zinc-400", bg: "bg-card border-border" },
  { id: "emerald", label: "Emerald", ring: "ring-emerald-500", bg: "bg-emerald-500/20 border-emerald-500/40" },
  { id: "blue", label: "Blue", ring: "ring-blue-500", bg: "bg-blue-500/20 border-blue-500/40" },
  { id: "amber", label: "Amber", ring: "ring-amber-500", bg: "bg-amber-500/20 border-amber-500/40" },
  { id: "rose", label: "Rose", ring: "ring-rose-500", bg: "bg-rose-500/20 border-rose-500/40" },
  { id: "purple", label: "Purple", ring: "ring-purple-500", bg: "bg-purple-500/20 border-purple-500/40" },
] as const;

export function NoteEditorModal({
  open,
  initialNote,
  initialType = "task",
  isSaving,
  onClose,
  onSave,
}: NoteEditorModalProps) {
  const [type, setType] = useState<"task" | "visit" | "general">(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<UserNoteRecord["color"]>("default");
  const [category, setCategory] = useState<string>("general");
  const [isPinned, setIsPinned] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Task fields
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [targetDate, setTargetDate] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);

  // Visit fields
  const [selectedParty, setSelectedParty] = useState<PartyRecord | null>(null);
  const [partyName, setPartyName] = useState("");
  const [partyType, setPartyType] = useState<"existing" | "new_party" | "new_lead">("existing");
  const [contactPerson, setContactPerson] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contacts, setContacts] = useState<UserNoteContact[]>([]);
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("");
  const [purpose, setPurpose] = useState("Sales Discussion");
  const [plannedTime, setPlannedTime] = useState("");

  const [partySearch, setPartySearch] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);

  // Reminders
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("10:00");
  const [notifyApp, setNotifyApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Parties Query for visits
  const { data: partiesRes } = useGetPartiesQuery(undefined, { skip: !open });
  const partiesList: PartyRecord[] = useMemo(() => {
    if (Array.isArray(partiesRes)) return partiesRes;
    if (Array.isArray((partiesRes as any)?.data)) return (partiesRes as any).data;
    return [];
  }, [partiesRes]);

  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return partiesList.slice(0, 15);
    const q = partySearch.toLowerCase();
    return partiesList
      .filter((p) => {
        const pCity =
          p.billing_address?.city ||
          p.shipping_address?.city ||
          p.district ||
          p.state ||
          "";
        return (
          (p.party_name || "").toLowerCase().includes(q) ||
          pCity.toLowerCase().includes(q)
        );
      })
      .slice(0, 15);
  }, [partiesList, partySearch]);

  useEffect(() => {
    if (open) {
      if (initialNote) {
        setType(initialNote.type || (initialNote.party_name ? "visit" : "task"));
        setTitle(initialNote.title || "");
        setDescription(initialNote.description || initialNote.content || "");
        setColor(initialNote.color || "default");
        setCategory(initialNote.category || "general");
        setIsPinned(Boolean(initialNote.is_pinned));
        setTags(Array.isArray(initialNote.tags) ? initialNote.tags : []);

        // Task
        setPriority(initialNote.priority || "medium");
        setTargetDate(
          initialNote.target_date
            ? new Date(initialNote.target_date).toISOString().slice(0, 10)
            : ""
        );
        setIsCompleted(Boolean(initialNote.is_completed));

        // Visit
        setPartyName(initialNote.party_name || "");
        setPartyType(initialNote.party_type || "existing");
        setContactPerson(initialNote.contact_person || "");
        setContactNumber(initialNote.contact_number || "");
        setContacts(Array.isArray(initialNote.contacts) ? initialNote.contacts : []);
        setLocality(initialNote.locality || "");
        setCity(initialNote.city || "");
        setPurpose(initialNote.purpose || "Sales Discussion");
        setPlannedTime(initialNote.planned_time || "");

        if (initialNote.reminder?.enabled && initialNote.reminder?.remind_at) {
          const d = new Date(initialNote.reminder.remind_at);
          setReminderEnabled(true);
          setReminderDate(d.toISOString().slice(0, 10));
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          setReminderTime(`${hh}:${mm}`);
          setNotifyApp(initialNote.reminder.notify_app !== false);
          setNotifyEmail(initialNote.reminder.notify_email !== false);
        } else {
          setReminderEnabled(false);
          setReminderDate("");
          setReminderTime("10:00");
          setNotifyApp(true);
          setNotifyEmail(true);
        }
      } else {
        // Reset
        setType(initialType);
        setTitle("");
        setDescription("");
        setColor("default");
        setCategory("general");
        setIsPinned(false);
        setTags([]);

        setPriority("medium");
        setTargetDate("");
        setIsCompleted(false);

        setSelectedParty(null);
        setPartyName("");
        setPartyType("existing");
        setContactPerson("");
        setContactNumber("");
        setContacts([]);
        setLocality("");
        setCity("");
        setPurpose("Sales Discussion");
        setPlannedTime("");

        setReminderEnabled(false);
        setReminderDate("");
        setReminderTime("10:00");
        setNotifyApp(true);
        setNotifyEmail(true);
      }
    }
  }, [open, initialNote, initialType]);

  if (!open) return null;

  const handleAddTag = () => {
    const t = tagInput.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const handleSelectParty = (p: PartyRecord) => {
    setSelectedParty(p);
    setPartyName(p.party_name || "");

    // Extract all directory contacts
    const resolvedContacts: UserNoteContact[] = [];
    if (Array.isArray(p.contacts) && p.contacts.length > 0) {
      for (const c of p.contacts) {
        if (c.contact_person || c.contact_number) {
          resolvedContacts.push({
            contact_person: c.contact_person || "",
            contact_number: c.contact_number || "",
          });
        }
      }
    }
    if (resolvedContacts.length === 0 && (p.contact_person || p.mobile)) {
      resolvedContacts.push({
        contact_person: p.contact_person || "",
        contact_number: p.mobile || "",
      });
    }

    setContacts(resolvedContacts);
    setContactPerson(resolvedContacts[0]?.contact_person || p.contact_person || "");
    setContactNumber(resolvedContacts[0]?.contact_number || p.mobile || "");

    setLocality(p.billing_address?.street || p.shipping_address?.street || "");
    setCity(p.billing_address?.city || p.shipping_address?.city || p.district || "");
    setPartyDropdownOpen(false);
    setPartySearch("");
  };

  const handleAddManualContact = () => {
    setContacts((prev) => [...prev, { contact_person: "", contact_number: "" }]);
  };

  const handleUpdateContact = (index: number, field: keyof UserNoteContact, val: string) => {
    setContacts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      if (index === 0) {
        if (field === "contact_person") setContactPerson(val);
        if (field === "contact_number") setContactNumber(val);
      }
      return next;
    });
  };

  const handleRemoveContact = (index: number) => {
    setContacts((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0) {
        setContactPerson(next[0].contact_person || "");
        setContactNumber(next[0].contact_number || "");
      } else {
        setContactPerson("");
        setContactNumber("");
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalTitle = title.trim();
    if (!finalTitle) {
      if (type === "visit") {
        finalTitle = partyName.trim() || "Planned Visit";
      } else if (type === "task") {
        toast.error("Please enter a task title");
        return;
      } else {
        finalTitle = "Quick Note";
      }
    }

    if (type === "visit" && !partyName.trim() && !selectedParty) {
      toast.error("Please specify a party or customer name for this visit note");
      return;
    }

    let remindAtIso: string | null = null;
    if (reminderEnabled) {
      if (!reminderDate) {
        toast.error("Please select a reminder date");
        return;
      }
      const [hours, minutes] = reminderTime.split(":").map((n) => parseInt(n, 10) || 0);
      const rDate = new Date(reminderDate);
      rDate.setHours(hours, minutes, 0, 0);
      remindAtIso = rDate.toISOString();
    }

    // Filter valid contacts
    const validContacts = contacts.filter((c) => c.contact_person?.trim() || c.contact_number?.trim());
    if (validContacts.length === 0 && (contactPerson.trim() || contactNumber.trim())) {
      validContacts.push({
        contact_person: contactPerson.trim(),
        contact_number: contactNumber.trim(),
      });
    }

    const payload: Partial<UserNoteRecord> = {
      type,
      title: finalTitle,
      description: description.trim(),
      content: description.trim(),
      color,
      category,
      is_pinned: isPinned,
      tags,
      reminder: {
        enabled: reminderEnabled,
        remind_at: remindAtIso,
        notify_app: notifyApp,
        notify_email: notifyEmail,
      },
    };

    if (type === "task") {
      payload.priority = priority;
      payload.target_date = targetDate ? new Date(targetDate).toISOString() : null;
      payload.is_completed = isCompleted;
    } else if (type === "visit") {
      payload.party = selectedParty ? selectedParty._id || (selectedParty as any).id : undefined;
      payload.party_name = partyName.trim();
      payload.party_type = partyType;
      payload.contact_person = contactPerson.trim() || validContacts[0]?.contact_person || "";
      payload.contact_number = contactNumber.trim() || validContacts[0]?.contact_number || "";
      payload.contacts = validContacts;
      payload.locality = locality.trim();
      payload.city = city.trim();
      payload.purpose = purpose.trim();
      payload.planned_time = plannedTime.trim();
    }

    await onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-3 sm:my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3 sm:py-4 bg-surface-muted/50 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              {type === "task" ? (
                <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : type === "visit" ? (
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                {initialNote ? "Edit Note" : "Create New Note"}
              </h2>
              <p className="text-[11px] sm:text-xs text-muted line-clamp-1">
                Private scratchpad item that can be converted into daily Work Plans
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

        {/* Note Type Selector Tabs */}
        {!initialNote && (
          <div className="flex border-b border-border bg-surface px-3 sm:px-6 pt-2 sm:pt-3 gap-1 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
            <button
              type="button"
              onClick={() => setType("task")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
                type === "task"
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Task Note
            </button>
            <button
              type="button"
              onClick={() => setType("visit")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
                type === "visit"
                  ? "border-amber-500 text-amber-600 bg-amber-500/5"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Visit Note
            </button>
            <button
              type="button"
              onClick={() => setType("general")}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition cursor-pointer shrink-0 ${
                type === "general"
                  ? "border-purple-500 text-purple-600 bg-purple-500/5"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Quick Note
            </button>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 flex-1 overflow-y-auto">
          {/* TASK NOTE FORM */}
          {type === "task" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Prepare Q3 tender submission documentation"
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
                  >
                    <option value="low">🟢 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🟠 High Priority</option>
                    <option value="urgent">🔴 Urgent / Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Target / Due Date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Detailed Task Description &amp; Instructions
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter notes, key checklist items, or background requirements..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden resize-none"
                />
              </div>
            </div>
          )}

          {/* VISIT NOTE FORM */}
          {type === "visit" && (
            <div className="space-y-4">
              {/* Party Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-foreground mb-1">
                  Party / Customer Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => {
                      setPartyName(e.target.value);
                      setPartySearch(e.target.value);
                      setPartyDropdownOpen(true);
                      setSelectedParty(null);
                    }}
                    onFocus={() => setPartyDropdownOpen(true)}
                    placeholder="Search existing customer or enter custom client..."
                    className="w-full rounded-xl border border-border bg-surface pl-9 pr-3.5 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden"
                  />
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted" />
                </div>

                {partyDropdownOpen && filteredParties.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-border bg-card shadow-lg py-1">
                    {filteredParties.map((p) => {
                      const pContactsCount = (p.contacts?.length || 0) + (p.contact_person ? 1 : 0);
                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() => handleSelectParty(p)}
                          className="flex w-full items-center justify-between px-3.5 py-2 text-left text-xs hover:bg-surface-muted transition cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-foreground">{p.party_name}</span>
                            <span className="ml-2 text-muted text-[11px]">
                              {[p.billing_address?.city, p.state].filter(Boolean).join(", ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {pContactsCount > 0 && (
                              <span className="text-[10px] text-muted bg-surface-muted px-1.5 py-0.5 rounded border border-border">
                                {pContactsCount} contact(s)
                              </span>
                            )}
                            <span className="text-[10px] text-primary font-semibold">Select</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Contacts Section */}
              <div className="rounded-xl border border-border/80 bg-surface-muted/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-primary" />
                    Party Contacts {contacts.length > 0 ? `(${contacts.length})` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddManualContact}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Contact
                  </button>
                </div>

                {contacts.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => setContactPerson(e.target.value)}
                        placeholder="e.g. Mr. Rajesh Sharma"
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-muted mb-1">
                        Contact Number
                      </label>
                      <input
                        type="text"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="e.g. 9876543210"
                        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {contacts.map((c, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                      >
                        <input
                          type="text"
                          value={c.contact_person || ""}
                          onChange={(e) => handleUpdateContact(idx, "contact_person", e.target.value)}
                          placeholder="Contact person name"
                          className="flex-1 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-hidden"
                        />
                        <input
                          type="text"
                          value={c.contact_number || ""}
                          onChange={(e) => handleUpdateContact(idx, "contact_number", e.target.value)}
                          placeholder="Phone / Mobile"
                          className="w-36 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(idx)}
                          className="rounded p-1 text-muted hover:bg-rose-500/15 hover:text-rose-500 transition cursor-pointer"
                          title="Remove Contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Locality / Area
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Industrial Area Phase 2"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    City / Town
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Hyderabad"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Purpose of Visit
                  </label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground focus:border-primary focus:outline-hidden"
                  >
                    <option value="Sales Discussion">Sales Discussion</option>
                    <option value="Lead Follow-up">Lead Follow-up</option>
                    <option value="Payment Follow-up">Payment Follow-up</option>
                    <option value="Tender / Specs Finalization">Tender / Specs Finalization</option>
                    <option value="Site Survey / Measurement">Site Survey / Measurement</option>
                    <option value="Product Demonstration">Product Demonstration</option>
                    <option value="Relationship Meeting">Relationship Meeting</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Planned Time / Slot
                  </label>
                  <input
                    type="text"
                    value={plannedTime}
                    onChange={(e) => setPlannedTime(e.target.value)}
                    placeholder="e.g. 11:30 AM"
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Visit Background / Agenda Notes &amp; Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Key discussion agenda or prior context..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-xs text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden resize-none"
                />
              </div>
            </div>
          )}

          {/* QUICK NOTE FORM */}
          {type === "general" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Note Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Note headline..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Content &amp; Notes
                </label>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Type your notes, ideas, phone memos..."
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted/60 focus:border-primary focus:outline-hidden resize-none"
                />
              </div>
            </div>
          )}

          {/* Color & Pin Options */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Color:</span>
              <div className="flex items-center gap-1.5">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id as any)}
                    className={`h-6 w-6 rounded-full border transition cursor-pointer ${c.bg} ${
                      color === c.id ? `ring-2 ${c.ring} ring-offset-2 scale-110` : "opacity-75 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                isPinned
                  ? "bg-amber-500/20 text-amber-600 border border-amber-500/30"
                  : "bg-surface text-muted hover:text-foreground border border-border"
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-amber-500" : ""}`} />
              {isPinned ? "Pinned to Top" : "Pin Note"}
            </button>
          </div>

          {/* Reminder Section */}
          <div className="rounded-xl border border-border bg-surface-muted/30 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  Set Reminder &amp; Alerts
                </span>
              </label>

              {reminderEnabled && (
                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>

            {reminderEnabled && (
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">
                      Reminder Date
                    </label>
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={(e) => setReminderDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-muted mb-1">
                      Reminder Time
                    </label>
                    <input
                      type="time"
                      value={reminderTime}
                      onChange={(e) => setReminderTime(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-muted">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyApp}
                      onChange={(e) => setNotifyApp(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-primary"
                    />
                    <Bell className="h-3.5 w-3.5 text-primary" /> In-App Notification
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-primary"
                    />
                    <Mail className="h-3.5 w-3.5 text-primary" /> Email Alert
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-hover hover:text-foreground transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-hover transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : initialNote ? "Update Note" : "Save Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
