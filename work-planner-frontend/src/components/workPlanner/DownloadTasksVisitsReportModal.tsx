"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  RefreshCw,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { WorkPlanRecord } from "@/types/workPlanner";
import { formatPlanDate, salesUserLabel, formatTime, stripHtml } from "./workPlanUtils";
import { downloadExcelReport } from "./exportExcelReport";
import { downloadPdfReport } from "./exportPdfReport";
import { usePdfCompanyLetterhead } from "./pdfCompanyLetterhead";

export interface FlatItem {
  id: string;
  planId: string;
  itemType: "visit" | "task";
  planDate: string;
  executiveName: string;
  executiveEmail: string;
  titleOrParty: string;
  contactPerson: string;
  contactNumber: string;
  parentLocation: string;
  locationOrAddress: string;
  descriptionOrNotes: string;
  plannedTime: string;
  status: string;
  raw: any;
}

export interface DownloadTasksVisitsReportModalProps {
  open: boolean;
  plans: WorkPlanRecord[];
  onClose: () => void;
}

export function DownloadTasksVisitsReportModal({
  open,
  plans,
  onClose,
}: DownloadTasksVisitsReportModalProps) {
  const letterhead = usePdfCompanyLetterhead();
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<"all" | "visits" | "tasks">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Flatten all visits & tasks from plans array
  const flatItems = useMemo<FlatItem[]>(() => {
    const list: FlatItem[] = [];

    for (const p of plans) {
      const pId = p._id || p.id || "";
      const pDate = p.plan_date || "";
      const execName = salesUserLabel(p.sales_user);
      const execEmail = typeof p.sales_user === "object" ? p.sales_user?.email || "" : "";

      // Visits
      if (Array.isArray(p.visits)) {
        for (const v of p.visits) {
          const visitContacts = Array.isArray(v.contacts) && v.contacts.length > 0
            ? v.contacts
            : (v.contact_person || v.contact_number || v.phone || v.contact_email)
              ? [
                  {
                    contact_person: v.contact_person,
                    contact_number: v.contact_number || v.phone,
                    contact_email: v.contact_email,
                  },
                ]
              : [];

          const contactPersonStr = visitContacts.length > 0
            ? visitContacts.map((c) => c.contact_person).filter(Boolean).join(", ") || "—"
            : v.contact_person || "—";

          const contactNumberStr = visitContacts.length > 0
            ? visitContacts.map((c) => c.contact_number).filter(Boolean).join(", ") || "—"
            : v.contact_number || v.phone || "—";

          list.push({
            id: v._id || v.id || `visit-${list.length}`,
            planId: pId,
            itemType: "visit",
            planDate: pDate,
            executiveName: execName,
            executiveEmail: execEmail,
            titleOrParty: v.party_name || (typeof v.party === "object" ? (v.party as any)?.party_name : undefined) || "Field Visit",
            contactPerson: contactPersonStr,
            contactNumber: contactNumberStr,
            parentLocation: p.location || "—",
            locationOrAddress: v.address || p.location || "—",
            descriptionOrNotes: v.purpose || v.notes || "—",
            plannedTime: formatTime(v.planned_start_time),
            status: v.status || "created",
            raw: v,
          });
        }
      }

      // Work Tasks
      if (Array.isArray(p.works)) {
        for (const w of p.works) {
          list.push({
            id: w._id || w.id || `task-${list.length}`,
            planId: pId,
            itemType: "task",
            planDate: pDate,
            executiveName: execName,
            executiveEmail: execEmail,
            titleOrParty: w.title || "Work Task",
            contactPerson: "—",
            contactNumber: "—",
            parentLocation: p.location || "—",
            locationOrAddress: p.location || "Office / Remote",
            descriptionOrNotes: w.description || "—",
            plannedTime: formatTime(w.planned_start_time),
            status: w.status || "created",
            raw: w,
          });
        }
      }
    }

    return list;
  }, [plans]);

  // Apply Modal Filters
  const filteredItems = useMemo(() => {
    return flatItems.filter((item) => {
      if (categoryFilter === "visits" && item.itemType !== "visit") return false;
      if (categoryFilter === "tasks" && item.itemType !== "task") return false;

      if (statusFilter !== "all" && String(item.status).toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }

      if (dateFrom && item.planDate && item.planDate.slice(0, 10) < dateFrom) return false;
      if (dateTo && item.planDate && item.planDate.slice(0, 10) > dateTo) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const text = `${item.titleOrParty} ${item.executiveName} ${item.contactPerson} ${item.locationOrAddress} ${item.descriptionOrNotes} ${item.status}`.toLowerCase();
        if (!text.includes(q)) return false;
      }

      return true;
    });
  }, [flatItems, categoryFilter, statusFilter, dateFrom, dateTo, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredItems.length;
    const completed = filteredItems.filter((i) => i.status === "completed").length;
    const inProgress = filteredItems.filter((i) => i.status === "in_progress" || i.status === "checked_in").length;
    const pending = filteredItems.filter((i) => i.status === "pending" || i.status === "created").length;
    return { total, completed, inProgress, pending };
  }, [filteredItems]);

  if (!open) return null;

  // Handle Export Excel
  const handleExportExcel = () => {
    setDownloadingExcel(true);
    try {
      const columns = [
        { key: "planDate", label: "Plan Date" },
        { key: "itemType", label: "Category" },
        { key: "executiveName", label: "Executive Name" },
        { key: "executiveEmail", label: "Executive Email" },
        { key: "parentLocation", label: "Parent Plan Location" },
        { key: "titleOrParty", label: "Party Name / Task Title" },
        { key: "contactPerson", label: "Contact Person" },
        { key: "contactNumber", label: "Contact Number" },
        { key: "locationOrAddress", label: "Location / Address" },
        { key: "descriptionOrNotes", label: "Purpose / Description" },
        { key: "plannedTime", label: "Planned Schedule" },
        { key: "status", label: "Status" },
        { key: "outcomeOrRemarks", label: "Outcome / Remarks" },
        { key: "managerRemarks", label: "Supervisory / Manager Remarks" },
        { key: "meetingDoctor", label: "Meeting With Doctor" },
        { key: "meetingPurchase", label: "Meeting With Purchase" },
        { key: "meetingFinance", label: "Meeting With Finance" },
        { key: "meetingEngineer", label: "Meeting With Engineer" },
        { key: "newProductIntroduced", label: "New Product Introduced" },
        { key: "orderReceived", label: "Order Received" },
      ];

      const rows = filteredItems.map((item) => ({
        planDate: formatPlanDate(item.planDate),
        itemType: item.itemType === "visit" ? "Field Visit" : "Work Task",
        executiveName: item.executiveName,
        executiveEmail: item.executiveEmail,
        parentLocation: item.parentLocation || "—",
        titleOrParty: item.titleOrParty,
        contactPerson: item.contactPerson,
        contactNumber: item.contactNumber,
        locationOrAddress: item.locationOrAddress,
        descriptionOrNotes: item.descriptionOrNotes,
        plannedTime: item.plannedTime,
        status: String(item.status).toUpperCase().replace(/_/g, " "),
        outcomeOrRemarks: stripHtml(
          item.raw?.outcome ||
            item.raw?.completion_remarks ||
            item.raw?.pending_remarks ||
            item.raw?.in_progress_remarks ||
            "—"
        ),
        managerRemarks: stripHtml(item.raw?.manager_remarks || "—"),
        meetingDoctor: item.itemType === "visit" ? (item.raw?.meeting_with_doctor ? "Yes" : "No") : "N/A",
        meetingPurchase: item.itemType === "visit" ? (item.raw?.meeting_with_purchase ? "Yes" : "No") : "N/A",
        meetingFinance: item.itemType === "visit" ? (item.raw?.meeting_with_finance ? "Yes" : "No") : "N/A",
        meetingEngineer: item.itemType === "visit" ? (item.raw?.meeting_with_engineer ? "Yes" : "No") : "N/A",
        newProductIntroduced: item.itemType === "visit" ? (item.raw?.new_product_introduced ? "Yes" : "No") : "N/A",
        orderReceived: item.itemType === "visit" ? (item.raw?.order_received ? "Yes" : "No") : "N/A",
      }));

      const filename = `Tasks_Visits_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;

      downloadExcelReport({
        filename,
        sheetName: "Tasks and Visits",
        title: `Tasks & Field Visits Report — Exported on ${new Date().toLocaleDateString()}`,
        columns,
        rows,
      });

      toast.success(`Exported ${filteredItems.length} items to Excel`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to export Excel report");
    } finally {
      setDownloadingExcel(false);
    }
  };

  // Handle Export PDF
  const handleExportPdf = () => {
    setDownloadingPdf(true);
    try {
      const columns = [
        { key: "planDate", label: "Date" },
        { key: "itemType", label: "Type" },
        { key: "executiveName", label: "Executive" },
        { key: "titleOrParty", label: "Party / Task Title" },
        { key: "contactPerson", label: "Contact Person" },
        { key: "plannedTime", label: "Schedule" },
        { key: "status", label: "Status" },
        { key: "managerRemarks", label: "Manager Remark" },
      ];

      const rows = filteredItems.map((item) => ({
        planDate: formatPlanDate(item.planDate),
        itemType: item.itemType === "visit" ? "Visit" : "Task",
        executiveName: item.executiveName,
        titleOrParty: item.titleOrParty,
        contactPerson: item.contactPerson,
        plannedTime: item.plannedTime,
        status: String(item.status).toUpperCase().replace(/_/g, " "),
        managerRemarks: stripHtml(item.raw?.manager_remarks || "—"),
      }));

      const filename = `Tasks_Visits_Report_${new Date().toISOString().slice(0, 10)}.pdf`;

      downloadPdfReport({
        filename,
        title: "Tasks & Field Visits Summary Report",
        subtitle: `Total Items: ${stats.total} | Completed: ${stats.completed} | In Progress: ${stats.inProgress} | Pending: ${stats.pending}`,
        columns,
        rows,
        letterhead,
      });

      toast.success(`Generated PDF report with ${filteredItems.length} items`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to export PDF report");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-card font-sans overflow-hidden">
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 sm:px-6 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
                Tasks &amp; Field Visits Dispatch
              </h3>
              <p className="text-[11px] sm:text-xs text-muted truncate">
                Configure filters and export detailed activity reports
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-xl p-1 text-muted hover:bg-surface-muted hover:text-foreground active:scale-95 transition cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body with Filters & KPIs */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5 bg-surface-muted/20">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-xl border border-border bg-card p-3 sm:p-3.5 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-muted truncate block">Total Activity</span>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-0.5">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 sm:p-3.5 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 truncate block">
                Completed
              </span>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                {stats.completed}
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 sm:p-3.5 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate block">
                In Progress
              </span>
              <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                {stats.inProgress}
              </p>
            </div>
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 sm:p-3.5 shadow-2xs">
              <span className="text-[10px] sm:text-[11px] font-semibold text-sky-600 dark:text-sky-400 truncate block">
                Pending / Created
              </span>
              <p className="text-lg sm:text-xl font-bold text-sky-700 dark:text-sky-300 mt-0.5">
                {stats.pending}
              </p>
            </div>
          </div>

          {/* Filter Configuration Controls */}
          <div className="rounded-xl border border-border bg-card p-3.5 sm:p-4 space-y-3.5 sm:space-y-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-border pb-2.5">
              <Filter className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Report Filter Parameters
              </h4>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {/* Category Filter */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Activity Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Items (Visits &amp; Tasks)</option>
                  <option value="visits">Field Visits Only</option>
                  <option value="tasks">Work Tasks Only</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Execution Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="created">Created</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="checked_in">Checked In</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              {/* Search input */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Keyword Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search executive, party, task..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface pl-8 pr-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Date From */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Plan Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Plan Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
                />
              </div>

              {/* Reset Filters button */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setStatusFilter("all");
                    setSearchQuery("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 sm:py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset Filters
                </button>
              </div>
            </div>
          </div>

          {/* Quick Preview Table snippet */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-3.5 sm:px-4 py-2.5 bg-surface-muted border-b border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                Matching Report Entries ({filteredItems.length})
              </span>
              <span className="text-[11px] text-muted">Previewing top rows</span>
            </div>
            <div className="max-h-96 min-h-[200px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-left text-xs min-w-[500px]">
                <thead className="border-b border-border bg-surface-muted/50 font-semibold text-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Executive</th>
                    <th className="px-3 py-2">Title / Party Name</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted">
                        No entries match current report filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.slice(0, 10).map((item) => (
                      <tr key={item.id} className="hover:bg-surface-muted/40">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {formatPlanDate(item.planDate)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              item.itemType === "visit"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {item.itemType === "visit" ? "Visit" : "Task"}
                          </span>
                        </td>
                        <td className="px-3 py-2 truncate max-w-[120px]">
                          {item.executiveName}
                        </td>
                        <td className="px-3 py-2 font-semibold truncate max-w-[180px]">
                          {item.titleOrParty}
                        </td>
                        <td className="px-3 py-2 uppercase text-[10px] font-bold text-muted whitespace-nowrap">
                          {String(item.status).replace(/_/g, " ")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer with Export Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between border-t border-border bg-surface px-4 sm:px-6 py-3.5 sm:py-4 gap-2.5 shrink-0">
          <span className="text-xs text-muted font-medium text-center sm:text-left">
            Ready to export <span className="font-bold text-foreground">{filteredItems.length}</span> items
          </span>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border bg-card px-4 py-2.5 sm:py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground active:scale-[0.98] transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={downloadingPdf || filteredItems.length === 0}
              onClick={handleExportPdf}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 sm:py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              {downloadingPdf ? "Generating PDF…" : "Export PDF"}
            </button>
            <button
              type="button"
              disabled={downloadingExcel || filteredItems.length === 0}
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 sm:py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] transition cursor-pointer"
            >
              <Download className="h-4 w-4" />
              {downloadingExcel ? "Generating Excel…" : "Export Excel (.xlsx)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DownloadTasksVisitsReportModal;
