"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "@/lib/toast";
import {
  type ProductSubgroupRecord,
  useCreateProductSubgroupMutation,
  useGetProductSubgroupQuery,
  useListProductGroupsQuery,
  usePatchProductSubgroupMutation,
} from "@/store/api";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { X, Network } from "lucide-react";

export type ProductSubgroupDetailModalProps = {
  subgroupId?: string | null;
  create?: boolean;
  initialName?: string;
  defaultGroupId?: string;
  defaultGroupName?: string;
  onClose: () => void;
  onSuccess?: (subgroup: ProductSubgroupRecord) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const labelClass = "text-xs font-semibold text-slate-700 dark:text-slate-300";
const btnSecondaryClass =
  "rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer";
const btnPrimaryClass =
  "rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer";

export default function ProductSubgroupDetailModal({
  subgroupId,
  create = false,
  initialName = "",
  defaultGroupId = "",
  defaultGroupName = "",
  onClose,
  onSuccess,
}: ProductSubgroupDetailModalProps) {
  const isEdit = !create && !!subgroupId;

  const { data: subgroupData, isLoading: isLoadingSubgroup } = useGetProductSubgroupQuery(
    subgroupId || "",
    { skip: !isEdit }
  );
  const { data: groupsData, isLoading: isLoadingGroups } = useListProductGroupsQuery({
    limit: 1000,
  });
  const groups = useMemo(
    () => (Array.isArray(groupsData?.data) ? groupsData.data : []),
    [groupsData]
  );

  const [createProductSubgroup] = useCreateProductSubgroupMutation();
  const [patchProductSubgroup] = usePatchProductSubgroupMutation();

  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(defaultGroupId);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [showInUnbilled, setShowInUnbilled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEdit && subgroupData) {
      setName(subgroupData.name || "");
      const gid =
        subgroupData.group && typeof subgroupData.group === "object"
          ? subgroupData.group._id
          : subgroupData.group;
      setGroupId(String(gid || ""));
      setDescription(subgroupData.description || "");
      setIsActive(subgroupData.is_active !== false);
      setIsFeatured(Boolean(subgroupData.is_featured));
      setShowInUnbilled(subgroupData.show_in_unbilled_order_list !== false);
    } else if (create) {
      setName(initialName || "");
      setDescription("");
      setIsActive(true);
      setIsFeatured(false);
      setShowInUnbilled(true);

      // Match group by id or name
      if (defaultGroupId) {
        setGroupId(defaultGroupId);
      } else if (defaultGroupName && groups.length > 0) {
        const found = groups.find(
          (g) => g.name.toLowerCase() === defaultGroupName.toLowerCase().trim()
        );
        if (found) setGroupId(found._id);
        else if (groups[0]?._id) setGroupId(groups[0]._id);
      } else if (groups.length > 0 && !groupId) {
        setGroupId(groups[0]._id);
      }
    }
  }, [isEdit, create, subgroupData, initialName, defaultGroupId, defaultGroupName, groups]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Subgroup name is required");
      return;
    }
    if (!groupId) {
      toast.error("Commercial Group is required");
      return;
    }

    setIsSaving(true);
    try {
      const body: Partial<ProductSubgroupRecord> = {
        name: name.trim(),
        group: groupId,
        description: description.trim(),
        is_active: isActive,
        is_featured: isFeatured,
        show_in_unbilled_order_list: showInUnbilled,
      };

      let savedSubgroup: ProductSubgroupRecord;
      if (isEdit && subgroupId) {
        savedSubgroup = await patchProductSubgroup({ id: subgroupId, patch: body }).unwrap();
        toast.success("Subgroup updated");
      } else {
        savedSubgroup = await createProductSubgroup(body).unwrap();
        toast.success("Subgroup created");
      }
      onSuccess?.(savedSubgroup);
      onClose();
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to save subgroup");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <Network className="size-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEdit ? "Edit Subgroup" : "Create Subgroup"}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            {isLoadingSubgroup ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading…</div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className={labelClass}>Subgroup Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Analgesics, Antibiotics"
                    className={inputClass}
                    disabled={isSaving}
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Parent Commercial Group *</label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className={inputClass}
                    required
                    disabled={isSaving || isLoadingGroups}
                  >
                    <option value="">Select commercial group</option>
                    {groups.map((g) => (
                      <option key={g._id} value={g._id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional details about this subgroup..."
                    rows={3}
                    className={`${inputClass} resize-none`}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Active</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showInUnbilled}
                      onChange={(e) => setShowInUnbilled(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show in Unbilled List</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isFeatured}
                      onChange={(e) => setIsFeatured(e.target.checked)}
                      disabled={isSaving}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Featured</span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className={btnSecondaryClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={btnPrimaryClass}
                  >
                    {isSaving ? "Saving…" : isEdit ? "Update Subgroup" : "Create Subgroup"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}
