"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle,
  X,
  Shield,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { readSessionFromStorage } from "@/utils/authStorage";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import type { Portal } from "@/types/userManager";

export default function PortalsPage() {
  const [session, setSession] = useState<any>(null);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal State for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingPortal, setEditingPortal] = useState<Portal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: "",
    code: "",
    description: "",
    access_roles_input: "executive, manager",
    is_active: true,
  });

  useEffect(() => {
    setSession(readSessionFromStorage());
  }, []);

  const token = session?.token;

  const fetchPortals = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/portals?include_inactive=true`, {
        headers: getAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error("Could not fetch portals list.");
      }
      const data = await res.json();
      setPortals(extractList(data));
    } catch (e: any) {
      setError(e?.message || "Failed to load portals.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchPortals();
    }
  }, [token, fetchPortals]);

  const handleSeedPortals = async () => {
    if (!token) return;
    setIsSeeding(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/portals/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        setSuccessMsg("Standard portals seeded successfully.");
        await fetchPortals();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Seeding portals failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not seed portals.");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPortal(null);
    setModalForm({
      name: "",
      code: "",
      description: "",
      access_roles_input: "executive, manager",
      is_active: true,
    });
    setShowModal(true);
  };

  const handleOpenEditModal = (portal: Portal) => {
    setEditingPortal(portal);
    setModalForm({
      name: portal.name,
      code: portal.code,
      description: portal.description || "",
      access_roles_input: (portal.access_roles || ["executive", "manager"]).join(", "),
      is_active: portal.is_active !== false,
    });
    setShowModal(true);
  };

  const handleSavePortal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    const rolesArray = modalForm.access_roles_input
      .split(",")
      .map((r) => r.trim().toLowerCase())
      .filter(Boolean);

    try {
      const payload = {
        name: modalForm.name.trim(),
        code: modalForm.code.trim().toLowerCase(),
        description: modalForm.description.trim(),
        access_roles: rolesArray.length > 0 ? rolesArray : ["executive", "manager"],
        is_active: modalForm.is_active,
      };

      const url = editingPortal
        ? `${API_BASE}/api/portals/${editingPortal._id || editingPortal.id}`
        : `${API_BASE}/api/portals`;

      const method = editingPortal ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.message || "Failed to save portal.");
      }

      setSuccessMsg(`Portal '${modalForm.name}' saved successfully.`);
      setShowModal(false);
      await fetchPortals();
    } catch (err: any) {
      setError(err?.message || "Failed to save portal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePortal = async (portal: Portal) => {
    const pid = portal._id || portal.id;
    if (!token || !pid) return;
    if (!confirm(`Are you sure you want to delete portal '${portal.name}'?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/portals/${pid}`, {
        method: "DELETE",
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        throw new Error("Failed to delete portal.");
      }

      setSuccessMsg(`Portal '${portal.name}' deleted.`);
      await fetchPortals();
    } catch (err: any) {
      setError(err?.message || "Failed to delete portal.");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </Link>
          </div>
          <h1 className="text-xl font-extrabold text-foreground tracking-tight mt-1 flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-primary" />
            Portal Management Console
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Configure system portals and their allowed user access roles (e.g., Executive, Manager)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSeedPortals}
            disabled={isSeeding}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition shadow-xs disabled:opacity-60"
          >
            {isSeeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-amber-500" />}
            Seed Default Portals
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Portal
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Portals Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-16 text-muted gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold">Loading system portals…</p>
        </div>
      ) : portals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-12 text-center space-y-3">
          <Layers className="h-10 w-10 text-muted" />
          <h3 className="text-base font-bold text-foreground">No Portals Registered</h3>
          <p className="text-xs text-muted max-w-md">
            Click &quot;Seed Default Portals&quot; to auto-generate standard portals (Work Planner, Transport Planner, etc.) or create a custom one.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSeedPortals}
              disabled={isSeeding}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition"
            >
              <Sparkles className="h-4 w-4" /> Seed Standard Portals
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portals.map((portal) => {
            const isActive = portal.is_active !== false;
            const roles = portal.access_roles || ["executive", "manager"];

            return (
              <div
                key={portal.code}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col justify-between space-y-4 hover:border-primary/40 transition duration-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{portal.name}</h3>
                        <p className="text-3xs font-mono text-muted">code: {portal.code}</p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-3xs font-semibold ${
                        isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                      }`}
                    >
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <p className="text-xs text-muted mt-3 line-clamp-2">
                    {portal.description || "No description provided for this portal."}
                  </p>

                  <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span className="text-3xs uppercase font-bold text-muted tracking-wider">
                        Available Access Roles
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {roles.map((r, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg border border-border bg-surface-muted px-2.5 py-0.5 text-3xs font-semibold text-foreground"
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Link
                    href={`/dashboard/portals/${portal.code || portal.name}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-muted transition"
                  >
                    View Details
                  </Link>

                  <button
                    onClick={() => handleOpenEditModal(portal)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit
                  </button>

                  <button
                    onClick={() => handleDeletePortal(portal)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal for Create / Edit Portal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border p-5">
              <h3 className="text-base font-bold text-foreground">
                {editingPortal ? "Edit Portal Configuration" : "Create New System Portal"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePortal} className="p-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Portal Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Work Planner Portal"
                  required
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Portal Identifier Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalForm.code}
                  onChange={(e) => setModalForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. work_planner"
                  required
                  disabled={!!editingPortal}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Description</label>
                <textarea
                  value={modalForm.description}
                  onChange={(e) => setModalForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief summary of portal function and purpose"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition resize-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  Access Roles (comma separated)
                </label>
                <input
                  type="text"
                  value={modalForm.access_roles_input}
                  onChange={(e) => setModalForm((f) => ({ ...f, access_roles_input: e.target.value }))}
                  placeholder="e.g. executive, manager"
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition"
                />
                <p className="text-3xs text-muted mt-1">
                  Specify available roles users can hold within this portal (e.g. executive, manager).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Status</label>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                  <span className="text-xs font-medium text-foreground">
                    {modalForm.is_active ? "Active Portal" : "Inactive / Disabled"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalForm((f) => ({ ...f, is_active: !f.is_active }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      modalForm.is_active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        modalForm.is_active ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary/90 transition active:scale-95 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                    </>
                  ) : (
                    "Save Portal"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
