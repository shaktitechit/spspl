"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Building2,
  MapPin,
  CreditCard,
  ShieldCheck,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Copy,
  Star,
  Loader2,
  Save,
  X,
  Phone,
  Mail,
  RefreshCw,
} from "lucide-react";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";
import { readSessionFromStorage } from "@/utils/authStorage";
import type { BranchRecord, BranchBankingRecord } from "@/store/api/branchApiSlice";

interface BranchesManagerProps {
  companyData?: any;
  token?: string;
}

type BranchSubTab = "details" | "address" | "taxation" | "banking";

export function BranchesManager({ companyData, token }: BranchesManagerProps) {
  const sessionToken = token || (typeof window !== "undefined" ? readSessionFromStorage()?.token : "") || "";

  const [branches, setBranches] = useState<BranchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [isSettingHqId, setIsSettingHqId] = useState<string | null>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<BranchSubTab>("details");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [copySourceBranchId, setCopySourceBranchId] = useState<string>("");

  // Form state for creating / editing branch
  const [branchForm, setBranchForm] = useState<Partial<BranchRecord>>({
    branch_code: "",
    branch_name: "",
    branch_type: "regional_office",
    is_head_office: false,
    is_active: true,
    address: {
      street: "",
      landmark: "",
      city: "",
      state: "",
      state_code: "",
      pincode: "",
      country: "India",
      currency: "INR",
      timezone: "Asia/Kolkata",
      financial_year: "",
    },
    taxation: {
      gstin: "",
      pan: companyData?.pan || "",
      cin: companyData?.cin || "",
      drug_license: "",
      fssai_license: "",
      invoice_footer_note: "",
    },
    contact: {
      manager_name: "",
      email: "",
      billing_email: "",
      phone: "",
      alternate_phone: "",
      website: companyData?.website || "",
    },
    banking: [
      {
        bank_name: "",
        account_name: "",
        account_number: "",
        ifsc_code: "",
        branch_name: "",
        account_type: "Current Account",
        upi_id: "",
        swift_code: "",
        is_primary: true,
      },
    ],
    invoicing: {
      invoice_prefix: "",
      challan_prefix: "",
      quotation_prefix: "",
    },
  });

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const authHeader = getAuthHeaders(sessionToken);
      const headers = {
        ...authHeader,
        ...((init.headers as Record<string, string>) || {}),
      };

      try {
        const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
        if (!res.ok && (res.status === 401 || res.status === 404 || res.status >= 500)) {
          // If direct API failed, fallback to local Next.js proxy route
          try {
            const proxyRes = await fetch(path, { ...init, headers, credentials: "include" });
            if (proxyRes.ok) return proxyRes;
          } catch {
            // ignore proxy error and return original res
          }
        }
        return res;
      } catch {
        // Fallback to local Next.js proxy route if API_BASE is unreachable from browser
        return await fetch(path, { ...init, headers, credentials: "include" });
      }
    },
    [sessionToken]
  );

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch("/api/branches");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || `Failed to fetch branches (Status ${res.status})`);
      }

      const list = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json?.branches)
        ? json.branches
        : [];
      setBranches(list);
    } catch (err: any) {
      setFetchError(err?.message || "Failed to load branches");
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditing) {
        setIsEditing(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditing]);

  const headOfficeBranch = branches.find((b) => b.is_head_office) || branches[0];

  const handleOpenCreate = () => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedBranchId(null);
    setCopySourceBranchId(headOfficeBranch?._id || branches[0]?._id || "");
    setBranchForm({
      branch_code: `BR-${String(branches.length + 1).padStart(2, "0")}`,
      branch_name: "",
      branch_type: "regional_office",
      is_head_office: false,
      is_active: true,
      address: {
        street: "",
        landmark: "",
        city: "",
        state: "",
        state_code: "",
        pincode: "",
        country: "India",
        currency: "INR",
        timezone: "Asia/Kolkata",
        financial_year: companyData?.financial_year || "2025-2026",
      },
      taxation: {
        gstin: "",
        pan: companyData?.pan || "",
        cin: companyData?.cin || "",
        drug_license: "",
        fssai_license: "",
        invoice_footer_note: "",
      },
      contact: {
        manager_name: "",
        email: "",
        billing_email: "",
        phone: "",
        alternate_phone: "",
        website: companyData?.website || "",
      },
      banking: [
        {
          bank_name: "",
          account_name: "",
          account_number: "",
          ifsc_code: "",
          branch_name: "",
          account_type: "Current Account",
          upi_id: "",
          swift_code: "",
          is_primary: true,
        },
      ],
      invoicing: {
        invoice_prefix: `BR${branches.length + 1}/`,
        challan_prefix: `DC${branches.length + 1}/`,
        quotation_prefix: `QT${branches.length + 1}/`,
      },
    });
    setActiveSubTab("details");
    setIsEditing(true);
  };

  const handleOpenEdit = (branch: BranchRecord) => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedBranchId(branch._id || null);
    setBranchForm({
      ...branch,
      banking: branch.banking?.length
        ? branch.banking
        : [
            {
              bank_name: "",
              account_name: "",
              account_number: "",
              ifsc_code: "",
              branch_name: "",
              account_type: "Current Account",
              upi_id: "",
              swift_code: "",
              is_primary: true,
            },
          ],
    });
    setActiveSubTab("details");
    setIsEditing(true);
  };

  const handleCloneBranch = (sourceBranch: BranchRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActionError(null);
    setSelectedBranchId(null);
    setCopySourceBranchId(sourceBranch._id || "");

    const nextCode = `BR-${String(branches.length + 1).padStart(2, "0")}`;

    setBranchForm({
      branch_code: nextCode,
      branch_name: `${sourceBranch.branch_name} (Copy)`,
      branch_type: sourceBranch.branch_type || "regional_office",
      is_head_office: false,
      is_active: true,
      address: sourceBranch.address
        ? { ...sourceBranch.address }
        : {
            street: "",
            city: "",
            state: "",
            pincode: "",
            country: "India",
            currency: "INR",
            timezone: "Asia/Kolkata",
          },
      taxation: sourceBranch.taxation
        ? { ...sourceBranch.taxation }
        : {
            gstin: "",
            pan: companyData?.pan || "",
            cin: companyData?.cin || "",
            drug_license: "",
            fssai_license: "",
            invoice_footer_note: "",
          },
      contact: sourceBranch.contact
        ? { ...sourceBranch.contact }
        : {
            manager_name: "",
            email: "",
            billing_email: "",
            phone: "",
            alternate_phone: "",
            website: companyData?.website || "",
          },
      banking: sourceBranch.banking?.length
        ? sourceBranch.banking.map((b) => ({ ...b, _id: undefined }))
        : [
            {
              bank_name: "",
              account_name: "",
              account_number: "",
              ifsc_code: "",
              branch_name: "",
              account_type: "Current Account",
              upi_id: "",
              swift_code: "",
              is_primary: true,
            },
          ],
      invoicing: {
        invoice_prefix: `BR${branches.length + 1}/`,
        challan_prefix: `DC${branches.length + 1}/`,
        quotation_prefix: `QT${branches.length + 1}/`,
      },
    });

    setActiveSubTab("details");
    setIsEditing(true);
    setActionSuccess(`Cloned details from "${sourceBranch.branch_name}". Update code or location as needed and click Save.`);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleCopyFromSelectedBranch = (
    branchId: string,
    section: "all" | "address" | "taxation" | "banking" | "contact"
  ) => {
    const source = branches.find((b) => b._id === branchId) || headOfficeBranch;
    if (!source) return;

    setBranchForm((prev) => {
      const next = { ...prev };
      if (section === "all" || section === "address") {
        next.address = { ...(source.address || {}) } as any;
      }
      if (section === "all" || section === "taxation") {
        next.taxation = { ...(source.taxation || {}) } as any;
      }
      if (section === "all" || section === "banking") {
        next.banking = source.banking?.length
          ? source.banking.map((b) => ({ ...b, _id: undefined }))
          : next.banking;
      }
      if (section === "all" || section === "contact") {
        next.contact = { ...(source.contact || {}) } as any;
      }
      return next;
    });

    const labels: Record<string, string> = {
      all: "all details (address, taxation, banking, contacts)",
      address: "Address & Localization",
      taxation: "Taxation & Compliance",
      banking: "Bank Accounts",
      contact: "Contact Information",
    };

    setActionSuccess(`Copied ${labels[section] || section} from "${source.branch_name}"!`);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const handleCopyFromHeadOffice = (section: "address" | "taxation" | "banking" | "all") => {
    if (!headOfficeBranch?._id) return;
    handleCopyFromSelectedBranch(headOfficeBranch._id, section);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    setIsSaving(true);

    try {
      if (!branchForm.branch_code?.trim()) {
        throw new Error("Branch Code is required (e.g. MUM-01)");
      }
      if (!branchForm.branch_name?.trim()) {
        throw new Error("Branch Name is required");
      }

      const method = selectedBranchId ? "PUT" : "POST";
      const path = selectedBranchId
        ? `/api/branches/${selectedBranchId}`
        : `/api/branches`;

      // Clean payload: strip _id, createdAt, updatedAt, __v when creating a new branch
      const payload: any = { ...branchForm };
      if (!selectedBranchId) {
        delete payload._id;
        delete payload.createdAt;
        delete payload.updatedAt;
        delete payload.__v;
        if (!payload.company_id || typeof payload.company_id !== "string") {
          delete payload.company_id;
        }
      }
      if (Array.isArray(payload.banking)) {
        payload.banking = payload.banking.map((b: any) => {
          if (!selectedBranchId) {
            const { _id, ...rest } = b;
            return rest;
          }
          return b;
        });
      }

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || `Failed to save branch (Status ${res.status})`);
      }

      setActionSuccess(selectedBranchId ? "Branch profile updated successfully!" : "New branch registered successfully!");
      setIsEditing(false);
      fetchBranches();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || "Failed to save branch information.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSetHq = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to designate this branch as the corporate Head Office?")) return;

    setIsSettingHqId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiFetch(`/api/branches/${id}/set-head-office`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || "Failed to set Head Office");
      }

      setActionSuccess("Head Office updated successfully!");
      fetchBranches();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err?.message || "Failed to update Head Office");
    } finally {
      setIsSettingHqId(null);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this branch?")) return;

    setIsDeletingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await apiFetch(`/api/branches/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message || "Failed to delete branch");
      }

      setActionSuccess("Branch removed successfully!");
      if (selectedBranchId === id) setIsEditing(false);
      fetchBranches();
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      setActionError(err?.message || "Failed to delete branch");
    } finally {
      setIsDeletingId(null);
    }
  };

  // Banking array handlers
  const handleAddBankAccount = () => {
    setBranchForm((prev) => ({
      ...prev,
      banking: [
        ...(prev.banking || []),
        {
          bank_name: "",
          account_name: "",
          account_number: "",
          ifsc_code: "",
          branch_name: "",
          account_type: "Current Account",
          upi_id: "",
          swift_code: "",
          is_primary: false,
        },
      ],
    }));
  };

  const handleRemoveBankAccount = (index: number) => {
    setBranchForm((prev) => ({
      ...prev,
      banking: (prev.banking || []).filter((_, i) => i !== index),
    }));
  };

  const handleBankChange = (index: number, field: keyof BranchBankingRecord, value: any) => {
    setBranchForm((prev) => {
      const updated = [...(prev.banking || [])];
      if (field === "is_primary" && value === true) {
        updated.forEach((acc, i) => {
          acc.is_primary = i === index;
        });
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, banking: updated };
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Loading Company Branches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Multi-Branch Locations & Facilities</h3>
              <p className="text-xs text-muted">
                Manage Head Office, state distribution hubs, warehouses, and regional billing entities
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchBranches}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {branches.length > 0 && (
            <button
              type="button"
              onClick={() => handleCloneBranch(headOfficeBranch || branches[0])}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition active:scale-95"
              title="Clone existing branch to create a new branch"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy / Clone Branch
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New Branch
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {(actionError || fetchError) && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError || fetchError}</span>
        </div>
      )}

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches.map((branch) => {
          const isHq = branch.is_head_office;
          const isSelected = selectedBranchId === branch._id && isEditing;

          return (
            <div
              key={branch._id}
              onClick={() => handleOpenEdit(branch)}
              className={`group relative flex flex-col justify-between rounded-2xl border p-4.5 transition cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-md"
                  : isHq
                  ? "border-primary/40 bg-card hover:border-primary shadow-xs"
                  : "border-border bg-card hover:border-primary/30 hover:bg-surface-muted shadow-xs"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-3xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-foreground/10 text-foreground">
                      {branch.branch_code}
                    </span>
                    <span className="text-3xs font-semibold capitalize text-muted">
                      {branch.branch_type.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isHq ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-3xs font-bold text-primary">
                        <Star className="h-3 w-3 fill-primary" /> Head Office
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleSetHq(branch._id!, e)}
                        disabled={isSettingHqId === branch._id}
                        className="text-3xs text-muted hover:text-primary hover:underline px-1.5 py-0.5"
                        title="Set as Corporate Head Office"
                      >
                        Set HQ
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition line-clamp-1">
                    {branch.branch_name}
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <span className="truncate">
                      {branch.address?.city ? `${branch.address.city}, ${branch.address.state || ""}` : "No address set"}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-3xs">
                  <div>
                    <span className="block text-muted">Branch GSTIN</span>
                    <span className="font-mono font-semibold text-foreground truncate block">
                      {branch.taxation?.gstin || "Not Registered"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-muted">Settlement Bank</span>
                    <span className="font-semibold text-foreground truncate block">
                      {branch.banking?.[0]?.bank_name || "Central Account"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-3xs">
                <span className="text-muted truncate">
                  Contact: {branch.contact?.phone || branch.contact?.email || "General"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleCloneBranch(branch, e)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-3xs font-semibold text-muted hover:text-primary hover:bg-primary/10 transition"
                    title="Clone / Copy this branch to create a new one"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(branch)}
                    className="p-1 rounded-lg text-muted hover:text-primary hover:bg-primary/10 transition"
                    title="Edit Branch"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  {!isHq && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(branch._id!, e)}
                      disabled={isDeletingId === branch._id}
                      className="p-1 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete Branch"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Branch Detail & Editor Form Modal Dialog */}
      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop click dismiss */}
          <div
            className="fixed inset-0 bg-transparent"
            onClick={() => setIsEditing(false)}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <div
            className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Sticky Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      {selectedBranchId ? `Edit Branch: ${branchForm.branch_name || "Facility"}` : "Create New Branch Facility"}
                    </h3>
                    {branchForm.branch_code && (
                      <span className="font-mono text-3xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-foreground/10 text-foreground">
                        {branchForm.branch_code}
                      </span>
                    )}
                    {branchForm.is_head_office && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-3xs font-bold text-primary">
                        <Star className="h-3 w-3 fill-primary" /> Head Office
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Configure physical address, state GSTIN taxation, and dedicated branch banking credentials
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl p-2 text-muted hover:text-foreground hover:bg-surface-muted transition"
                  title="Close modal (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable form) */}
            <form id="branch-modal-form" onSubmit={handleSaveBranch} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Quick Copy Feature Panel */}
          {branches.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
                  <Copy className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {selectedBranchId ? "Copy Details from Another Branch" : "Quick Setup: Copy / Clone from Existing Branch"}
                  </p>
                  <p className="text-3xs text-muted">
                    Pre-fill address, state GSTIN, bank accounts, or contact details from any facility
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  value={copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || "")}
                  onChange={(e) => setCopySourceBranchId(e.target.value)}
                  className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.branch_name} ({b.branch_code}){b.is_head_office ? " — HQ" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyFromSelectedBranch(
                      copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                      "all"
                    )
                  }
                  className="rounded-lg bg-primary text-white hover:bg-primary/90 px-3 py-1.5 text-xs font-bold shadow-xs transition"
                  title="Copy all address, taxation, banking, and contact details"
                >
                  Copy All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyFromSelectedBranch(
                      copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                      "address"
                    )
                  }
                  className="rounded-lg border border-border bg-card hover:bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition"
                  title="Copy physical address and state localization"
                >
                  Address
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyFromSelectedBranch(
                      copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                      "taxation"
                    )
                  }
                  className="rounded-lg border border-border bg-card hover:bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition"
                  title="Copy GSTIN, PAN, and regulatory licenses"
                >
                  Taxation
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyFromSelectedBranch(
                      copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                      "banking"
                    )
                  }
                  className="rounded-lg border border-border bg-card hover:bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition"
                  title="Copy bank accounts and IFSC codes"
                >
                  Banking
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyFromSelectedBranch(
                      copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                      "contact"
                    )
                  }
                  className="rounded-lg border border-border bg-card hover:bg-surface-muted px-2.5 py-1.5 text-xs font-semibold text-foreground transition"
                  title="Copy manager and contact details"
                >
                  Contact
                </button>
              </div>
            </div>
          )}

          {/* Sub-Tabs Navigation */}
          <div className="flex items-center justify-between gap-2 border-b border-border pb-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {[
                { id: "details", label: "General & Identity", icon: Building2 },
                { id: "address", label: "Address & Localization", icon: MapPin },
                { id: "taxation", label: "Taxation & Compliance", icon: ShieldCheck },
                { id: "banking", label: "Banking & Settlement", icon: CreditCard },
              ].map((subTab) => {
                const Icon = subTab.icon;
                const isActive = activeSubTab === subTab.id;
                return (
                  <button
                    key={subTab.id}
                    type="button"
                    onClick={() => setActiveSubTab(subTab.id as BranchSubTab)}
                    className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition ${
                      isActive
                        ? "bg-primary text-white shadow-xs"
                        : "text-muted hover:text-foreground hover:bg-surface-muted"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{subTab.label}</span>
                  </button>
                );
              })}
            </div>

            {branches.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleCopyFromSelectedBranch(
                    copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                    activeSubTab === "details" ? "contact" : (activeSubTab as any)
                  )
                }
                className="flex items-center gap-1 text-3xs font-semibold text-primary hover:underline px-2 py-1 shrink-0"
                title="Populate current tab fields from selected branch"
              >
                <Copy className="h-3 w-3" />
                Copy {activeSubTab === "details" ? "Contact Info" : activeSubTab} from Selected Branch
              </button>
            )}
          </div>

          {/* Sub-Tab 1: General Details */}
          {activeSubTab === "details" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Branch Code *</label>
                <input
                  type="text"
                  required
                  value={branchForm.branch_code || ""}
                  onChange={(e) => setBranchForm((p) => ({ ...p, branch_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. MUM-HQ, DEL-01, WH-BLR"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={branchForm.branch_name || ""}
                  onChange={(e) => setBranchForm((p) => ({ ...p, branch_name: e.target.value }))}
                  placeholder="e.g. Mumbai Regional Sales Office"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Facility Type</label>
                <select
                  value={branchForm.branch_type || "regional_office"}
                  onChange={(e) => setBranchForm((p) => ({ ...p, branch_type: e.target.value as any }))}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="head_office">Head Office</option>
                  <option value="regional_office">Regional Office</option>
                  <option value="warehouse">Warehouse & Fulfillment Hub</option>
                  <option value="retail_depot">Retail Depot / Store</option>
                  <option value="manufacturing_unit">Manufacturing Unit / Plant</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Branch Manager / Head</label>
                <input
                  type="text"
                  value={branchForm.contact?.manager_name || ""}
                  onChange={(e) =>
                    setBranchForm((p) => ({
                      ...p,
                      contact: { ...p.contact!, manager_name: e.target.value },
                    }))
                  }
                  placeholder="Contact Person / Head"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Official Branch Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                  <input
                    type="email"
                    value={branchForm.contact?.email || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        contact: { ...p.contact!, email: e.target.value },
                      }))
                    }
                    placeholder="branch@company.com"
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                  <input
                    type="text"
                    value={branchForm.contact?.phone || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        contact: { ...p.contact!, phone: e.target.value },
                      }))
                    }
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-border bg-background pl-9 pr-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(branchForm.is_active)}
                    onChange={(e) => setBranchForm((p) => ({ ...p, is_active: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">Branch is Active & Accepting Orders</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(branchForm.is_head_office)}
                    onChange={(e) => setBranchForm((p) => ({ ...p, is_head_office: e.target.checked }))}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-semibold text-foreground">Set as Corporate Head Office</span>
                </label>
              </div>
            </div>
          )}

          {/* Sub-Tab 2: Address & Localization */}
          {activeSubTab === "address" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h5 className="text-xs font-bold text-foreground">Facility Physical Location</h5>
                  <p className="text-3xs text-muted">Registered office or warehouse coordinates</p>
                </div>
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyFromSelectedBranch(
                        copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                        "address"
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-3xs font-semibold text-foreground hover:bg-surface-muted transition"
                    title="Copy address fields from selected branch"
                  >
                    <Copy className="h-3 w-3 text-primary" />
                    Copy Address
                  </button>
                )}
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Street Address</label>
                <textarea
                  rows={2}
                  value={branchForm.address?.street || ""}
                  onChange={(e) =>
                    setBranchForm((p) => ({
                      ...p,
                      address: { ...p.address!, street: e.target.value },
                    }))
                  }
                  placeholder="Complete registered physical location for this facility..."
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">City</label>
                  <input
                    type="text"
                    value={branchForm.address?.city || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, city: e.target.value },
                      }))
                    }
                    placeholder="City"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">State</label>
                  <input
                    type="text"
                    value={branchForm.address?.state || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, state: e.target.value },
                      }))
                    }
                    placeholder="e.g. Maharashtra"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">GST State Code (2-digit)</label>
                  <input
                    type="text"
                    maxLength={2}
                    value={branchForm.address?.state_code || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, state_code: e.target.value },
                      }))
                    }
                    placeholder="e.g. 27"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Postal / Zip Code</label>
                  <input
                    type="text"
                    value={branchForm.address?.pincode || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, pincode: e.target.value },
                      }))
                    }
                    placeholder="Pincode"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Currency</label>
                  <input
                    type="text"
                    value={branchForm.address?.currency || "INR"}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, currency: e.target.value },
                      }))
                    }
                    placeholder="INR (₹)"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Timezone</label>
                  <input
                    type="text"
                    value={branchForm.address?.timezone || "Asia/Kolkata"}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        address: { ...p.address!, timezone: e.target.value },
                      }))
                    }
                    placeholder="Asia/Kolkata"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 3: Taxation & Compliance */}
          {activeSubTab === "taxation" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h5 className="text-xs font-bold text-foreground">Tax Identifiers & Regulatory Compliance</h5>
                  <p className="text-3xs text-muted">Branch GSTIN, PAN, and drug / FSSAI licenses</p>
                </div>
                {branches.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyFromSelectedBranch(
                        copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                        "taxation"
                      )
                    }
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-3xs font-semibold text-foreground hover:bg-surface-muted transition"
                    title="Copy taxation identifiers from selected branch"
                  >
                    <Copy className="h-3 w-3 text-primary" />
                    Copy Taxation
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Branch Specific GSTIN</label>
                  <input
                    type="text"
                    value={branchForm.taxation?.gstin || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        taxation: { ...p.taxation!, gstin: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                  <span className="text-3xs text-muted mt-1 block">
                    Under Indian GST, each state branch requires its own State GSTIN
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Corporate PAN</label>
                  <input
                    type="text"
                    value={branchForm.taxation?.pan || companyData?.pan || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        taxation: { ...p.taxation!, pan: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="AAAAA0000A"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">State Drug License (20B/21B)</label>
                  <input
                    type="text"
                    value={branchForm.taxation?.drug_license || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        taxation: { ...p.taxation!, drug_license: e.target.value },
                      }))
                    }
                    placeholder="State License No."
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">FSSAI License</label>
                  <input
                    type="text"
                    value={branchForm.taxation?.fssai_license || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        taxation: { ...p.taxation!, fssai_license: e.target.value },
                      }))
                    }
                    placeholder="FSSAI Registration No."
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Branch Invoice Prefix</label>
                  <input
                    type="text"
                    value={branchForm.invoicing?.invoice_prefix || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        invoicing: { ...p.invoicing!, invoice_prefix: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="e.g. MUM/, DEL-INV/"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Delivery Challan Prefix</label>
                  <input
                    type="text"
                    value={branchForm.invoicing?.challan_prefix || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        invoicing: { ...p.invoicing!, challan_prefix: e.target.value.toUpperCase() },
                      }))
                    }
                    placeholder="e.g. DC-MUM/"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-foreground block mb-1">Branch Document Footer Note</label>
                  <textarea
                    rows={2}
                    value={branchForm.taxation?.invoice_footer_note || ""}
                    onChange={(e) =>
                      setBranchForm((p) => ({
                        ...p,
                        taxation: { ...p.taxation!, invoice_footer_note: e.target.value },
                      }))
                    }
                    placeholder="Custom jurisdiction or terms displayed on invoices issued from this branch..."
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-Tab 4: Banking & Payments */}
          {activeSubTab === "banking" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h5 className="text-xs font-bold text-foreground">Dedicated Branch Bank Accounts</h5>
                  <p className="text-3xs text-muted">Direct settlement bank credentials and UPI handles</p>
                </div>
                <div className="flex items-center gap-2">
                  {branches.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyFromSelectedBranch(
                          copySourceBranchId || (headOfficeBranch?._id || branches[0]?._id || ""),
                          "banking"
                        )
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-3xs font-semibold text-foreground hover:bg-surface-muted transition"
                      title="Copy bank accounts from selected branch"
                    >
                      <Copy className="h-3 w-3 text-primary" />
                      Copy Bank Accounts
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddBankAccount}
                    className="flex items-center gap-1 text-3xs font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg hover:bg-primary hover:text-white transition"
                  >
                    <Plus className="h-3 w-3" /> Add Account
                  </button>
                </div>
              </div>

              {branchForm.banking && branchForm.banking.length > 0 ? (
                <div className="space-y-4">
                  {branchForm.banking.map((acc, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-border bg-background p-4 space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-bold text-foreground">
                            Account #{index + 1} {acc.bank_name ? `(${acc.bank_name})` : ""}
                          </span>
                          {acc.is_primary && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              Primary Payout
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {!acc.is_primary && (
                            <button
                              type="button"
                              onClick={() => handleBankChange(index, "is_primary", true)}
                              className="text-3xs text-primary hover:underline font-medium"
                            >
                              Make Primary
                            </button>
                          )}
                          {branchForm.banking!.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBankAccount(index)}
                              className="text-muted hover:text-rose-400 p-1"
                              title="Remove Account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">Bank Name</label>
                          <input
                            type="text"
                            value={acc.bank_name}
                            onChange={(e) => handleBankChange(index, "bank_name", e.target.value)}
                            placeholder="e.g. HDFC Bank"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">Account Holder Name</label>
                          <input
                            type="text"
                            value={acc.account_name}
                            onChange={(e) => handleBankChange(index, "account_name", e.target.value)}
                            placeholder="Beneficiary Name"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">Account Number</label>
                          <input
                            type="text"
                            value={acc.account_number}
                            onChange={(e) => handleBankChange(index, "account_number", e.target.value)}
                            placeholder="50200012345678"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">IFSC Code</label>
                          <input
                            type="text"
                            value={acc.ifsc_code}
                            onChange={(e) => handleBankChange(index, "ifsc_code", e.target.value.toUpperCase())}
                            placeholder="HDFC0001234"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground uppercase placeholder:text-muted focus:border-primary focus:outline-none font-mono"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">Branch / Location</label>
                          <input
                            type="text"
                            value={acc.branch_name}
                            onChange={(e) => handleBankChange(index, "branch_name", e.target.value)}
                            placeholder="Main Branch"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-3xs font-semibold text-muted block mb-1">Branch UPI ID</label>
                          <input
                            type="text"
                            value={acc.upi_id || ""}
                            onChange={(e) => handleBankChange(index, "upi_id", e.target.value)}
                            placeholder="branch@upi"
                            className="w-full rounded-xl border border-border bg-card px-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted italic">No branch-specific bank accounts configured yet.</p>
              )}
            </div>
          )}
            </form>

            {/* Modal Sticky Footer */}
            <div className="sticky bottom-0 z-20 flex items-center justify-between border-t border-border bg-card/95 backdrop-blur-md px-6 py-3.5">
              <div className="text-xs text-muted hidden sm:flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{selectedBranchId ? "Editing existing branch facility" : "New branch will be linked to parent organization"}</span>
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  form="branch-modal-form"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary transition active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {selectedBranchId ? "Save Branch Changes" : "Create Branch"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
