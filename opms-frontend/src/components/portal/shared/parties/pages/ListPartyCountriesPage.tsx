"use client";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type PartyCountryRecord,
  useListPartyCountriesQuery,
  useDeletePartyCountryMutation,
} from "@/store/api";
import { PortalBusyOverlay } from "@/components/portal/shared/shell/PortalBusyOverlay";
import { ListEntitySearchPanel } from "@/components/portal/shared/orders/list/ListEntitySearchPanel";
import { OrderListPaginationBar } from "@/components/portal/shared/orders/list/OrderListPaginationBar";
import { RefreshCw, Plus, Edit, Trash2, Globe } from "lucide-react";
import PartyCountryDetailModal from "../modals/PartyCountryDetailModal";

export type ListPartyCountriesPageProps = {
  portalHome?: string;
};

export default function ListPartyCountriesPage({ portalHome: _portalHome = "/admin" }: ListPartyCountriesPageProps) {
  const { data, isLoading, isFetching, isError, refetch } = useListPartyCountriesQuery({ limit: 1000 });
  const rows = useMemo(
    () => (Array.isArray(data?.data) ? (data.data as PartyCountryRecord[]) : []),
    [data]
  );

  const [deleteCountry] = useDeletePartyCountryMutation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editTarget, setEditTarget] = useState<PartyCountryRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PartyCountryRecord | null>(null);

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
      return [r.name, r.iso_code, r.description]
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
      await deleteCountry(deleteTarget._id).unwrap();
      toast.success("Country deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete country");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <PortalBusyOverlay active={isLoading} message="Loading countries…" />

      <div className="relative shrink-0 overflow-hidden rounded-xl border border-blue-500/10 bg-gradient-to-r from-blue-600/5 to-indigo-600/10 px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-50">Party Countries</h1>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              Master list of countries for party geography.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm cursor-pointer"
            >
              <RefreshCw className={`size-3 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
            >
              <Plus className="size-3" />
              Add Country
            </button>
          </div>
        </div>
      </div>

      <ListEntitySearchPanel
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        desktopPlaceholder="Search by name or ISO code…"
        mobilePlaceholder="Search countries…"
        compact
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        {isError && (
          <div className="py-16 text-center text-xs text-slate-500">Failed to load countries.</div>
        )}
        {!isLoading && !isError && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Globe className="mx-auto size-10 text-slate-400" />
            <p className="mt-2 text-xs text-slate-500">No countries found.</p>
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
                  <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-white/5">
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">ISO</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-500 uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paged.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                      <td className="px-4 py-3 text-slate-500">{row.iso_code || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${
                            row.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditTarget(row)}
                            className="rounded border border-slate-200 p-1 cursor-pointer"
                          >
                            <Edit className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(row)}
                            className="rounded border border-slate-200 p-1 text-rose-600 cursor-pointer"
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
        <PartyCountryDetailModal
          countryId={editTarget?._id ?? null}
          create={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setEditTarget(null);
          }}
          onSuccess={() => refetch()}
        />
      )}

      {deleteTarget && (
        <LargeModalPortal>
          <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-sm font-bold">Delete country?</h3>
            <p className="mt-2 text-xs text-slate-500">
              Remove <strong>{deleteTarget.name}</strong>? States under this country must be removed first.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border px-4 py-2 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs text-white cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </LargeModalPortal>
      )}
    </div>
  );
}
