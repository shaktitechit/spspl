"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Check, Loader2, Sparkles, AlertCircle, Shield } from "lucide-react";
import { API_BASE, getAuthHeaders, extractList } from "@/utils/apiHelpers";
import type { Portal, UserPortalAssignment } from "@/types/userManager";

interface PortalAccessSelectorProps {
  token: string | null;
  selectedPortals: UserPortalAssignment[];
  onChange: (portals: UserPortalAssignment[]) => void;
}

export function PortalAccessSelector({ token, selectedPortals, onChange }: PortalAccessSelectorProps) {
  const [portalsList, setPortalsList] = useState<Portal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPortals = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/portals`, {
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        const data = await res.json();
        setPortalsList(extractList(data));
      } else {
        setError("Failed to fetch portals list");
      }
    } catch (e: any) {
      setError(e?.message || "Could not connect to portal service");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPortals();
  }, [fetchPortals]);

  const handleSeedPortals = async () => {
    if (!token) return;
    setIsSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/api/portals/seed`, {
        method: "POST",
        headers: getAuthHeaders(token),
      });
      if (res.ok) {
        await fetchPortals();
      }
    } catch (e) {
      console.warn("Seeding portals failed:", e);
    } finally {
      setIsSeeding(false);
    }
  };

  const isPortalSelected = (code: string) => {
    return selectedPortals.some((p) => p.portal_code === code);
  };

  const getAssignedRoles = (code: string): string[] => {
    const found = selectedPortals.find((p) => p.portal_code === code);
    return found?.access_roles || [];
  };

  const togglePortal = (portal: Portal) => {
    const code = portal.code;
    if (isPortalSelected(code)) {
      // Deselect
      onChange(selectedPortals.filter((p) => p.portal_code !== code));
    } else {
      // Select with default role (e.g. executive if available)
      const defaultRoles = portal.access_roles && portal.access_roles.length > 0
        ? [portal.access_roles[0]]
        : ["executive"];
      onChange([
        ...selectedPortals,
        {
          portal_code: code,
          portal_name: portal.name,
          access_roles: defaultRoles,
        },
      ]);
    }
  };

  const selectRoleForPortal = (portalCode: string, role: string) => {
    const updated = selectedPortals.map((p) => {
      if (p.portal_code !== portalCode) return p;
      return { ...p, access_roles: [role] };
    });
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold text-foreground">
            Portal Access & Roles Assignment
          </label>
          <p className="text-3xs text-muted mt-0.5">
            Assign portal access and role permissions (e.g., Executive, Manager) for this user account
          </p>
        </div>

        {portalsList.length === 0 && !isLoading && (
          <button
            type="button"
            onClick={handleSeedPortals}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
          >
            {isSeeding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Seed Default Portals
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2.5 py-4 text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading available portals…
        </div>
      ) : error && portalsList.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : portalsList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/50 p-4 text-center space-y-2">
          <Globe className="h-6 w-6 text-muted mx-auto" />
          <p className="text-xs text-muted">No portals configured in the system yet.</p>
          <button
            type="button"
            onClick={handleSeedPortals}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition"
          >
            {isSeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Seed Standard Portals
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {portalsList.map((portal) => {
            const selected = isPortalSelected(portal.code);
            const assignedRoles = getAssignedRoles(portal.code);
            const availableRoles = portal.access_roles && portal.access_roles.length > 0
              ? portal.access_roles
              : ["executive", "manager"];

            return (
              <div
                key={portal.code}
                className={`rounded-xl border p-3.5 transition-all duration-200 ${
                  selected
                    ? "border-primary/40 bg-primary/5 shadow-xs"
                    : "border-border bg-background/60 hover:border-border/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => togglePortal(portal)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                        selected
                          ? "bg-primary border-primary text-white"
                          : "border-border bg-card text-transparent hover:border-primary/50"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </button>

                    <div>
                      <h4
                        onClick={() => togglePortal(portal)}
                        className="text-xs font-bold text-foreground cursor-pointer select-none"
                      >
                        {portal.name}
                      </h4>
                      <p className="text-3xs font-mono text-muted">code: {portal.code}</p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-3xs font-bold ${
                      selected
                        ? "bg-primary/20 text-primary"
                        : "bg-surface-muted text-muted"
                    }`}
                  >
                    {selected ? "Assigned" : "Inactive"}
                  </span>
                </div>

                {portal.description && (
                  <p className="text-3xs text-muted mt-2 line-clamp-2">{portal.description}</p>
                )}

                {/* Portal Access Roles Sub-selection */}
                {selected && (
                  <div className="mt-3 pt-2.5 border-t border-border/60">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="h-3 w-3 text-primary" />
                      <span className="text-3xs font-semibold uppercase text-muted tracking-wider">
                        Portal Access Roles
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {availableRoles.map((role) => {
                        const hasRole = assignedRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => selectRoleForPortal(portal.code, role)}
                            className={`rounded-lg px-2.5 py-1 text-3xs font-semibold transition ${
                              hasRole
                                ? "bg-primary text-white shadow-xs"
                                : "border border-border bg-surface-muted text-muted hover:text-foreground"
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
