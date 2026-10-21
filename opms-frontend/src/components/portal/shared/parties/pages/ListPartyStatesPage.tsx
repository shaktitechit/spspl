"use client";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type PartyStateRecord,
  useListPartyStatesQuery,
  useListPartyCountriesQuery,
  useDeletePartyStateMutation,
} from "@/store/api";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import { ListEntitySearchPanel } from "@/components/portal/shared/orders/list/ListEntitySearchPanel";
import { OrderListPaginationBar } from "@/components/portal/shared/orders/list/OrderListPaginationBar";
import { RefreshCw, Plus, Edit, Trash2, Map } from "lucide-react";
import PartyStateDetailModal from "../modals/PartyStateDetailModal";

export type ListPartyStatesPageProps = {
  portalHome?: string;
};

function countryLabel(row: PartyStateRecord): string {
  const c = row.country;
  if (c && typeof c === "object" && "name" in c) return String(c.name);
  return "—";
}

export default function ListPartyStatesPage({ portalHome: _portalHome = "/admin" }: ListPartyStatesPageProps) {
  const { data: countriesData } = useListPartyCountriesQuery({ limit: 1000 });
  const countries = useMemo(
    () => (Array.isArray(countriesData?.data) ? countriesData.data : []),
    [countriesData]
  );

  const [countryFilter, setCountryFilter] = useState("all");
  const listParams = useMemo(
    () => ({
      limit: 1000,
      ...(countryFilter !== "all" ? { country_id: countryFilter } : {}),
    }),
    [countryFilter]
  );

  const { data, isLoading, isFetching, isError, refetch } = useListPartyStatesQuery(listParams);
  const rows = useMemo(
    () => (Array.isArray(data?.data) ? (data.data as PartyStateRecord[]) : []),
    [data]
  );

  const [deleteState] = useDeletePartyStateMutation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editTarget, setEditTarget] = useState<PartyStateRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PartyStateRecord | null>(null);

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter === "active" && !r.is_active) return false;
      if (statusFilter === "inactive" && r.is_active) return false;
      if (!q) return true;
      return [r.name, countryLabel(r), r.description]
        .map((v) => String(v || "").toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [rows, searchQuery, statusFilter]);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const startEntry = filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endEntry = Math.min(currentPage * itemsPerPage, filtered.length);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteState(deleteTarget._id).unwrap();
      toast.success("State deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete state");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <PortalBusyOverlay active={isLoading} message="Loading states…" />

      <div className="relative shrink-0 overflow-hidden rounded-xl border border-blue-500/10 bg-gradient-to-r from-blue-600/5 to-indigo-600/10 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-50">Party States</h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              States / provinces linked to a country.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="size-3" />
              Add State
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600">Country filter</label>
        <select
          value={countryFilter}
          onChange={(e) => {
            setCountryFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-900"
        >
          <option value="all">All countries</option>
          {countries.map((c: any) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <ListEntitySearchPanel
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        desktopPlaceholder="Search by state or country…"
        mobilePlaceholder="Search states…"
        compact
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        {isError && <div className="py-16 text-center text-xs text-slate-500">Failed to load states.</div>}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Map className="mx-auto size-10 text-slate-400" />
            <p className="mt-2 text-xs text-slate-500">No states found.</p>
          </div>
        )}
        {!isLoading && !isError && filtered.length > 0 && (
          <>
            <OrderListPaginationBar
              startEntry={startEntry}
              endEntry={endEntry}
              totalEntries={filtered.length}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(v) => {
                setItemsPerPage(v);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">State</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Country</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paged.map((row) => (
                    <tr key={row._id}>
                      <td className="px-4 py-3 font-semibold">{row.name}</td>
                      <td className="px-4 py-3 text-slate-500">{countryLabel(row)}</td>
                      <td className="px-4 py-3">
                        {row.is_active ? (
                          <span className="text-2xs font-semibold text-emerald-700">Active</span>
                        ) : (
                          <span className="text-2xs text-slate-500">Inactive</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditTarget(row)} className="rounded border p-1 cursor-pointer">
                            <Edit className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="rounded border p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {(createOpen || editTarget) && (
        <PartyStateDetailModal
          stateId={editTarget?._id ?? null}
          create={createOpen}
          defaultCountryId={countryFilter !== "all" ? countryFilter : ""}
          onClose={() => {
            setCreateOpen(false);
            setEditTarget(null);
          }}
          onSuccess={() => refetch()}
        />
      )}

      {deleteTarget && (
        <LargeModalPortal>
          <div className="max-w-md rounded-xl border bg-white p-6 dark:bg-slate-900 dark:border-white/10">
            <h3 className="text-sm font-bold">Delete state?</h3>
            <p className="mt-2 text-xs text-slate-500">
              Remove <strong>{deleteTarget.name}</strong>? Delete cities under this state first.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border px-4 py-2 text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDelete} className="rounded-lg bg-rose-600 px-4 py-2 text-xs text-white cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </LargeModalPortal>
      )}
    </div>
  );
}
