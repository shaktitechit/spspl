"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import {
  ShoppingCart,
  Search,
  User,
  Users,
  Tag,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  FileText,
  Check,
  History,
  X,
  Mail,
  Clock,
} from "lucide-react";

import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  MapOrderLinePriceModal,
  type MapOrderLinePriceSuccess,
  type MapOrderLinePriceTarget,
} from "@/components/portal/shared/orders/modals/MapOrderLinePriceModal";
import {
  PreviousPartyItemsModal,
  type PreviousPartyOrderItem,
} from "@/components/portal/shared/orders/modals/PreviousPartyItemsModal";
import { PartyDetailModal } from "@/components/portal/shared/parties/modals/PartyDetailModal";
import { ProductDetailModal } from "@/components/portal/shared/products/modals/ProductDetailModal";
import { Button } from "@/components/ui/Button";
import {
  PerformaInvoiceFields,
  type PerformaFormValues,
  type PerformaAttachmentFiles,
  INITIAL_PERFORMA_VALUES,
} from "@/components/portal/shared/orders/performa/PerformaInvoiceFields";
import {
  OrderAddressSelector,
  type OrderAddressData,
  emptyOrderAddress,
  formatAddressOneLine,
} from "@/components/portal/shared/orders/addresses/OrderAddressSelector";
import {
  LineRateStatusBadge,
  rateLookupKey,
  resolveLineUnitPrice,
  resolveRateDisplayStatus,
} from "@/components/portal/shared/orders/lib/orderLineRateDisplay";
import {
  useCheckPartyLineRatesQuery,
  useCreateOrderMutation,
  useListPartiesQuery,
  useListProductsQuery,
  useListUsersQuery,
  useCreateAttachmentMutation,
  useUpdateOrderPerformaMutation,
} from "@/store/api";
import type { CheckOrderRatesItem } from "@/store/api/slices/partyOrderProductsRateApi";
import { useAppSelector } from "@/store";
import { usePortalSettings } from "@/hooks/usePortalSettings";

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";

type Entity = Record<string, unknown>;

function pickList(raw: unknown): Entity[] {
  if (Array.isArray(raw)) return raw as Entity[];
  if (
    raw &&
    typeof raw === "object" &&
    "users" in raw &&
    Array.isArray((raw as { users: unknown }).users)
  ) {
    return (raw as { users: Entity[] }).users;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: Entity[] }).items;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data: unknown }).data)
  ) {
    return (raw as { data: Entity[] }).data;
  }
  return [];
}

type LineRow = {
  key: string;
  productId: string;
  product_name: string;
  sku: string;
  brand: string;
  manufacturer: string;
  product_group: string;
  product_subgroup: string;
  unit: string;
  quantity: number;
  free_qty: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_percent: number;
  applied_rate_type: string;
  remarks: string;
};

function newLine(): LineRow {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    product_name: "",
    sku: "",
    brand: "",
    manufacturer: "",
    product_group: "",
    product_subgroup: "",
    unit: "",
    quantity: 1,
    free_qty: 0,
    unit_price: 0,
    discount_percent: 0,
    discount_amount: 0,
    gst_percent: 18,
    applied_rate_type: "SR",
    remarks: "",
  };
}

function formatMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function lineGross(row: LineRow): number {
  return Number(row.quantity || 0) * Number(row.unit_price || 0);
}

function lineDiscount(row: LineRow): number {
  const gross = lineGross(row);
  const percent = Number(row.discount_percent || 0);
  if (percent > 0) return (gross * percent) / 100;
  return Number(row.discount_amount || 0);
}

function lineTaxable(row: LineRow): number {
  return Math.max(0, lineGross(row) - lineDiscount(row));
}

function lineGst(row: LineRow): number {
  return (lineTaxable(row) * Number(row.gst_percent || 0)) / 100;
}

function lineTotal(row: LineRow): number {
  return lineTaxable(row) + lineGst(row);
}

interface PartyAutocompleteProps {
  parties: Entity[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
  onQuickAdd?: (searchName: string) => void;
}

function PartyAutocomplete({
  parties,
  selectedId,
  onChange,
  className,
  onQuickAdd,
}: PartyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedParty = useMemo(() => {
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedId));
  }, [parties, selectedId]);

  useEffect(() => {
    if (selectedParty) {
      setSearch(String(selectedParty.party_name || ""));
    } else {
      setSearch("");
    }
  }, [selectedParty]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parties;
    return parties.filter((p) => {
      const name = String(p.party_name || "").toLowerCase();
      const code = String(p.party_code || "").toLowerCase();
      const type = String(p.party_type || "").toLowerCase();
      return name.includes(q) || code.includes(q) || type.includes(q);
    });
  }, [parties, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedParty) {
          setSearch(String(selectedParty.party_name || ""));
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedParty]);

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-[100]" : "z-10"}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="Search party by name..."
          className={`${className} pr-10`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-slate-500">
          <Search className="h-4 w-4" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[9999] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-2xl dark:border-white/10 dark:bg-slate-900 ring-1 ring-black/5">
          {filtered.length === 0 ? (
            <div className="p-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="px-2 py-1 text-xs text-slate-400">No parties found</div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onQuickAdd(search.trim());
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Quick Add Party {search.trim() ? `"${search.trim()}"` : ""}
                </button>
              )}
            </div>
          ) : (
            <>
              {filtered.map((p) => {
                const id = String(p._id ?? p.id ?? "");
                const isSelected = id === selectedId;
                const name = String(p.party_name || "Party");
                const type = p.party_type ? ` (${p.party_type})` : "";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                      isSelected
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <span>
                      {name}
                      {type && <span className="text-xs text-slate-400 ml-1">{type}</span>}
                      {p.sra === true && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-2xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 ml-1.5">
                          SRA
                        </span>
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 p-1 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onQuickAdd(search.trim());
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Quick Add Party {search.trim() ? `"${search.trim()}"` : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface ProductAutocompleteProps {
  products: Entity[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
  onQuickAdd?: (searchName: string) => void;
}

function ProductAutocomplete({
  products,
  selectedId,
  onChange,
  className,
  onQuickAdd,
}: ProductAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => String(p._id ?? p.id ?? "") === String(selectedId));
  }, [products, selectedId]);

  useEffect(() => {
    if (selectedProduct) {
      const name = String(selectedProduct.product_name || "");
      const sku = selectedProduct.sku ? ` (${selectedProduct.sku})` : "";
      setSearch(`${name}${sku}`);
    } else {
      setSearch("");
    }
  }, [selectedProduct]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      const name = String(p.product_name || "").toLowerCase();
      const sku = String(p.sku || "").toLowerCase();
      const brand = String(p.brand || "").toLowerCase();
      return name.includes(q) || sku.includes(q) || brand.includes(q);
    });
  }, [products, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedProduct) {
          const name = String(selectedProduct.product_name || "");
          const sku = selectedProduct.sku ? ` (${selectedProduct.sku})` : "";
          setSearch(`${name}${sku}`);
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedProduct]);

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? "z-[100]" : "z-10"}`}>
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="Search product..."
          className={`${className} pr-10`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400 dark:text-slate-500">
          <Search className="h-4 w-4" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[9999] mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-2xl dark:border-white/10 dark:bg-slate-900 ring-1 ring-black/5 min-w-[280px]">
          {filtered.length === 0 ? (
            <div className="p-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="px-2 py-1 text-2xs text-slate-400">No products found</div>
              {onQuickAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onQuickAdd(search.trim());
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-400 dark:hover:bg-blue-900/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Quick Add Product {search.trim() ? `"${search.trim()}"` : ""}
                </button>
              )}
            </div>
          ) : (
            <>
              {filtered.map((p) => {
                const id = String(p._id ?? p.id ?? "");
                const isSelected = id === selectedId;
                const name = String(p.product_name || "Product");
                const sku = p.sku ? ` · ${p.sku}` : "";
                const brand = p.brand ? ` (${p.brand})` : "";
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-white/5 ${
                      isSelected
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <span className="truncate">
                      {name}
                      {sku && <span className="text-2xs text-slate-500 dark:text-slate-400 ml-1">{sku}</span>}
                      {brand && <span className="text-2xs text-slate-400 ml-1">{brand}</span>}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
              {onQuickAdd && (
                <div className="border-t border-slate-100 p-1 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onQuickAdd(search.trim());
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Quick Add Product {search.trim() ? `"${search.trim()}"` : ""}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getDepartmentBadge(dept: unknown): { label: string; className: string } | null {
  if (!dept) return null;
  const raw =
    typeof dept === "object" && dept !== null
      ? String(
          (dept as Record<string, unknown>).name ||
            (dept as Record<string, unknown>).code ||
            ""
        )
      : String(dept);
  const normalized = raw.toLowerCase().trim();
  if (!normalized) return null;

  switch (normalized) {
    case "sales":
      return {
        label: "Sales",
        className:
          "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "admin":
      return {
        label: "Admin",
        className:
          "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-950/40 dark:text-purple-300",
      };
    case "coordinator":
      return {
        label: "Coordinator",
        className:
          "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/40 dark:text-sky-300",
      };
    default:
      return {
        label: raw.charAt(0).toUpperCase() + raw.slice(1),
        className:
          "bg-slate-100 text-slate-700 ring-slate-600/10 dark:bg-white/10 dark:text-slate-300",
      };
  }
}

interface SalesAutocompleteProps {
  salesUsers: Entity[];
  selectedId: string;
  onChange: (id: string) => void;
  className?: string;
}

function SalesAutocomplete({
  salesUsers,
  selectedId,
  onChange,
  className,
}: SalesAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedUser = useMemo(() => {
    return salesUsers.find((u) => String(u._id ?? u.id ?? "") === String(selectedId));
  }, [salesUsers, selectedId]);

  useEffect(() => {
    if (selectedUser) {
      setSearch(String(selectedUser.name || selectedUser.username || ""));
    } else {
      setSearch("");
    }
  }, [selectedUser]);

  const isInputMatchingSelected = Boolean(
    selectedUser &&
      search.trim() === String(selectedUser.name || selectedUser.username || "").trim()
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q || isInputMatchingSelected) return salesUsers;
    return salesUsers.filter((u) => {
      const name = String(u.name || "").toLowerCase();
      const username = String(u.username || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      return name.includes(q) || username.includes(q) || email.includes(q);
    });
  }, [salesUsers, search, isInputMatchingSelected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (selectedUser) {
          setSearch(String(selectedUser.name || selectedUser.username || ""));
        } else {
          setSearch("");
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedUser]);

  const selectedDeptBadge = selectedUser ? getDepartmentBadge(selectedUser.department) : null;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="Search sales representative..."
          className={`${className} pr-14`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 gap-1.5">
          {selectedId ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearch("");
              }}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10 dark:hover:text-slate-200 cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <span className="pointer-events-none text-slate-400 dark:text-slate-500">
            <Search className="h-4 w-4" />
          </span>
        </div>
      </div>

      {selectedUser && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {selectedDeptBadge && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold ring-1 ring-inset ${selectedDeptBadge.className}`}
            >
              {selectedDeptBadge.label}
            </span>
          )}
          {selectedUser.email ? (
            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate">
              <Mail className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{String(selectedUser.email)}</span>
            </span>
          ) : null}
        </div>
      )}

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setSearch("");
              setIsOpen(false);
            }}
            className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 italic cursor-pointer"
          >
            — Unassigned —
          </button>
          {filtered.length > 0 && <div className="border-t border-slate-100 dark:border-white/5 my-1" />}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
              No users found
            </div>
          ) : (
            filtered.map((u) => {
              const id = String(u._id ?? u.id ?? "");
              const isSelected = id === selectedId;
              const name = String(u.name || u.username || id);
              const email = String(u.email || "");
              const deptBadge = getDepartmentBadge(u.department);

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onChange(id);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer ${
                    isSelected
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-medium"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate font-medium">{name}</span>
                      {deptBadge && (
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset ${deptBadge.className}`}
                        >
                          {deptBadge.label}
                        </span>
                      )}
                    </div>
                    {email && (
                      <span className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                        <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                        <span className="truncate">{email}</span>
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function todayInputValue(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type CoordinatorCreateOrderPageProps = {
  asModal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onCreated?: (info: { orderId: string; orderNo: string }) => void;
  initialPartyId?: string;
  initialAssignedSalesUserId?: string;
  modalSubtitle?: string;
};

export default function CoordinatorCreateOrderPage({
  asModal = false,
  isOpen = true,
  onClose,
  onCreated,
  initialPartyId = "",
  initialAssignedSalesUserId = "",
  modalSubtitle,
}: CoordinatorCreateOrderPageProps = {}) {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);

  const partiesQ = useListPartiesQuery({ status: "active" });
  const productsQ = useListProductsQuery({});
  const salesUsersQ = useListUsersQuery({});

  const [locallyAddedParties, setLocallyAddedParties] = useState<Entity[]>([]);
  const [locallyAddedProducts, setLocallyAddedProducts] = useState<Entity[]>([]);

  const parties = useMemo(() => {
    const list = pickList(partiesQ.data);
    if (!locallyAddedParties.length) return list;
    const existingIds = new Set(list.map((p) => String(p._id ?? p.id ?? "")));
    const fresh = locallyAddedParties.filter((p) => !existingIds.has(String(p._id ?? p.id ?? "")));
    return [...fresh, ...list];
  }, [partiesQ.data, locallyAddedParties]);

  const products = useMemo(() => {
    const list = pickList(productsQ.data);
    if (!locallyAddedProducts.length) return list;
    const existingIds = new Set(list.map((p) => String(p._id ?? p.id ?? "")));
    const fresh = locallyAddedProducts.filter((p) => !existingIds.has(String(p._id ?? p.id ?? "")));
    return [...fresh, ...list];
  }, [productsQ.data, locallyAddedProducts]);

  const salesUsers = useMemo(() => pickList(salesUsersQ.data), [salesUsersQ.data]);

  const [partyId, setPartyId] = useState(initialPartyId);
  const [orderDate, setOrderDate] = useState(todayInputValue);
  const [expectedDate, setExpectedDate] = useState("");
  const headerDiscount = "0";
  const [remarks, setRemarks] = useState("");
  const [assignedSales, setAssignedSales] = useState(initialAssignedSalesUserId);
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const prefillAppliedRef = useRef(false);

  // Quick Add Party & Product Modals State
  const [quickPartyModalOpen, setQuickPartyModalOpen] = useState(false);
  const [quickPartyInitialName, setQuickPartyInitialName] = useState("");

  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [quickProductInitialName, setQuickProductInitialName] = useState("");
  const [quickProductTargetRowKey, setQuickProductTargetRowKey] = useState<string | null>(null);

  const [mapTarget, setMapTarget] = useState<MapOrderLinePriceTarget | null>(null);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [previousItemsModalOpen, setPreviousItemsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const {
    isPerformaEnabled,
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
  } = usePortalSettings();

  useEffect(() => {
    if (!isPerformaEnabled && step === 2) {
      setStep(1);
    }
  }, [isPerformaEnabled, step]);
  const [performaValues, setPerformaValues] = useState<PerformaFormValues>(INITIAL_PERFORMA_VALUES);
  const [attachmentFiles, setAttachmentFiles] = useState<PerformaAttachmentFiles>({
    po_file: null,
    cost_sheet_file: null,
    aadhaar_file: null,
    pan_file: null,
    gst_file: null,
    kyc_files: [],
  });

  const [createOrder, { isLoading: isCreating }] = useCreateOrderMutation();
  const [createAttachment] = useCreateAttachmentMutation();
  const [updateOrderPerforma] = useUpdateOrderPerformaMutation();

  const handleAttachmentFileChange = useCallback(
    (field: keyof PerformaAttachmentFiles, file: File | File[] | null) => {
      setAttachmentFiles((prev) => ({ ...prev, [field]: file }));
    },
    [],
  );

  const isLoading = isCreating;
  const canMapPrice = Boolean(partyId);

  const selectedParty = useMemo(() => {
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(partyId));
  }, [parties, partyId]);

  const selectedSalesUser = useMemo(() => {
    return salesUsers.find((u) => String(u._id ?? u.id ?? "") === String(assignedSales));
  }, [salesUsers, assignedSales]);

  const selectedPartyName = selectedParty
    ? String(selectedParty.party_name || "")
    : "";

  const selectedPartyAddress = useMemo(() => {
    if (!selectedParty) return "";
    const addr = (selectedParty.address || selectedParty.billing_address || "") as any;
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      return [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.pincode]
        .filter(Boolean)
        .join(", ");
    }
    return "";
  }, [selectedParty]);

  const [billingAddress, setBillingAddress] = useState<OrderAddressData>(emptyOrderAddress);
  const [shippingAddress, setShippingAddress] = useState<OrderAddressData>(emptyOrderAddress);
  const [saveShippingToParty, setSaveShippingToParty] = useState<boolean>(false);

  useEffect(() => {
    if (selectedParty) {
      const b = (selectedParty.billing_address || selectedParty.address || {}) as any;
      const bAddr: OrderAddressData = {
        label: "Billing Address",
        recipient_name: String(b.recipient_name || selectedParty.contact_person || ""),
        phone: String(b.phone || selectedParty.mobile || ""),
        gst_no: String(b.gst_no || selectedParty.gst_no || ""),
        address_line_1: String(b.address_line_1 || ""),
        address_line_2: String(b.address_line_2 || ""),
        city: String(b.city || ""),
        state: String(b.state || ""),
        pincode: String(b.pincode || ""),
        country: String(b.country || "India"),
      };
      setBillingAddress(bAddr);

      const s = (selectedParty.shipping_address || {}) as any;
      const sList = Array.isArray(selectedParty.shipping_addresses)
        ? (selectedParty.shipping_addresses as any[])
        : [];
      const defaultInList = sList.find((item) => item.is_default);
      const chosen = defaultInList || (s.address_line_1 ? s : null);

      if (chosen) {
        setShippingAddress({
          label: chosen.label || "Saved Delivery Location",
          recipient_name: chosen.recipient_name || selectedParty.contact_person || "",
          phone: chosen.phone || selectedParty.mobile || "",
          gst_no: chosen.gst_no || selectedParty.gst_no || "",
          address_line_1: chosen.address_line_1 || "",
          address_line_2: chosen.address_line_2 || "",
          city: chosen.city || "",
          state: chosen.state || "",
          pincode: chosen.pincode || "",
          country: chosen.country || "India",
        });
      } else {
        setShippingAddress(bAddr);
      }

      // Prefill performa default values from party
      const pType = String((selectedParty as any).party_type || "").toLowerCase();
      const friendlyCustomerType =
        pType === "hospital" ? "Hospital" :
        pType === "dealer" ? "Dealer" :
        pType === "distributor" ? "Distributor" :
        pType === "institutional" ? "Institutional" :
        pType === "government" ? "Government" :
        "Direct Customer";

      const salesRepName = selectedSalesUser
        ? String(selectedSalesUser.name || selectedSalesUser.username || "").trim()
        : "";

      setPerformaValues((prev) => ({
        ...prev,
        customer_type: prev.customer_type || friendlyCustomerType,
        payment_terms: prev.payment_terms || String((selectedParty as any).payment_terms || "30 days"),
        freight_charges: prev.freight_charges || "Included",
        sales_person: salesRepName || prev.sales_person,
        ship_to_address: prev.ship_to_address || formatAddressOneLine(chosen || bAddr),
      }));
    } else {
      setBillingAddress(emptyOrderAddress);
      setShippingAddress(emptyOrderAddress);
    }
  }, [selectedParty, selectedSalesUser]);

  useEffect(() => {
    if (shippingAddress.address_line_1) {
      const formatted = formatAddressOneLine(shippingAddress);
      setPerformaValues((prev) => ({
        ...prev,
        ship_to_address: formatted,
      }));
    }
  }, [shippingAddress]);

  useEffect(() => {
    if (expectedDate) {
      setPerformaValues((prev) => ({
        ...prev,
        dispatch_date: prev.dispatch_date || expectedDate,
      }));
    }
  }, [expectedDate]);

  // Keep performa sales_person synced whenever sales representative is chosen/changed
  useEffect(() => {
    if (selectedSalesUser) {
      const repName = String(selectedSalesUser.name || selectedSalesUser.username || "").trim();
      if (repName) {
        setPerformaValues((prev) => ({
          ...prev,
          sales_person: repName,
        }));
      }
    }
  }, [selectedSalesUser]);

  const resetForm = useCallback(() => {
    setPartyId("");
    setOrderDate(todayInputValue());
    setExpectedDate("");
    setRemarks("");
    setAssignedSales("");
    setLines([newLine()]);
    setMapTarget(null);
    setMapModalOpen(false);
    setPreviousItemsModalOpen(false);
    setStep(1);
    setPerformaValues(INITIAL_PERFORMA_VALUES);
    setAttachmentFiles({
      po_file: null,
      cost_sheet_file: null,
      aadhaar_file: null,
      pan_file: null,
      gst_file: null,
      kyc_files: [],
    });
    prefillAppliedRef.current = false;
  }, []);

  useEffect(() => {
    if (asModal && !isOpen) {
      resetForm();
      return;
    }
    if (prefillAppliedRef.current) return;
    if (initialPartyId) {
      setPartyId(initialPartyId);
      setPreviousItemsModalOpen(true);
    }
    if (initialAssignedSalesUserId) setAssignedSales(initialAssignedSalesUserId);
  }, [asModal, isOpen, initialPartyId, initialAssignedSalesUserId, resetForm]);

  const lineRateCheckInput = useMemo(() => {
    if (!partyId) return null;
    const items = lines
      .filter((l) => l.productId)
      .map((l) => ({
        product: l.productId,
        applied_rate_type: l.applied_rate_type,
        product_name: l.product_name,
        sku: l.sku,
        unit_price: l.unit_price,
      }));
    if (!items.length) return null;
    return { party: partyId, items };
  }, [partyId, lines]);

  const rateCheckQ = useCheckPartyLineRatesQuery(lineRateCheckInput!, {
    skip: !lineRateCheckInput,
  });

  const rateItemByLine = useMemo(() => {
    const map = new Map<string, CheckOrderRatesItem>();
    for (const item of rateCheckQ.data?.items ?? []) {
      map.set(rateLookupKey(item.product, item.applied_rate_type), item);
    }
    return map;
  }, [rateCheckQ.data]);

  const allItemsNegotiated = useMemo(() => {
    const activeLines = lines.filter((l) => l.productId);
    if (activeLines.length === 0) return false;
    return activeLines.every((line) => {
      const rateItem = rateItemByLine.get(
        rateLookupKey(line.productId, line.applied_rate_type),
      );
      return resolveRateDisplayStatus(rateItem, line.unit_price) === "negotiated";
    });
  }, [lines, rateItemByLine]);

  const resolvePriceForLine = useCallback(
    (
      productId: string,
      rateType: string,
      catalogProduct: Entity | undefined,
    ) => {
      const rateItem = productId
        ? rateItemByLine.get(rateLookupKey(productId, rateType))
        : undefined;
      return resolveLineUnitPrice(rateItem, catalogProduct, rateType);
    },
    [rateItemByLine],
  );

  useEffect(() => {
    if (!rateCheckQ.data?.items?.length) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.productId) return row;
        const rateItem = rateItemByLine.get(
          rateLookupKey(row.productId, row.applied_rate_type),
        );
        if (!rateItem?.hasRate || rateItem.currentMappedRate == null) return row;
        const negotiated = Number(rateItem.currentMappedRate);
        if (!Number.isFinite(negotiated) || row.unit_price === negotiated) {
          return row;
        }
        changed = true;
        return { ...row, unit_price: negotiated };
      });
      return changed ? next : prev;
    });
  }, [rateCheckQ.data, rateItemByLine]);

  const liveSummary = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let gst = 0;
    let total = 0;

    for (const line of lines) {
      if (!line.productId) continue;
      subtotal += lineGross(line);
      discount += lineDiscount(line);
      taxable += lineTaxable(line);
      gst += lineGst(line);
      total += lineTotal(line);
    }

    const headerDisc = Number(headerDiscount || 0);
    const finalTotal = Math.max(0, total - headerDisc);

    return {
      subtotal,
      discount,
      taxable,
      gst,
      total: finalTotal,
      itemCount: lines.filter((l) => l.productId).length,
    };
  }, [lines, headerDiscount]);

  const updateLine = useCallback((key: string, patch: Partial<LineRow>) => {
    setLines((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }, []);

  const removeLine = useCallback((key: string) => {
    setLines((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [newLine()];
    });
  }, []);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, newLine()]);
  }, []);

  const onProductRowChange = useCallback(
    (key: string, productId: string) => {
      const p = products.find(
        (x) => String(x._id ?? x.id ?? "") === String(productId),
      );
      setLines((prev) =>
        prev.map((row) => {
          if (row.key !== key) return row;
          if (!p) {
            return {
              ...row,
              productId: "",
              product_name: "",
              sku: "",
              brand: "",
              manufacturer: "",
              product_group: "",
              product_subgroup: "",
              unit: "",
              unit_price: 0,
              gst_percent: 18,
            };
          }
          const defaultRateType = row.applied_rate_type || "SR";
          const unitPrice = resolvePriceForLine(productId, defaultRateType, p);
          return {
            ...row,
            productId,
            product_name: String(p.product_name ?? ""),
            sku: String(p.sku ?? ""),
            brand: String(p.brand ?? ""),
            manufacturer: String(p.manufacturer ?? ""),
            product_group: String(p.product_group ?? ""),
            product_subgroup: String(p.product_subgroup ?? ""),
            unit: String(p.unit ?? ""),
            unit_price: unitPrice,
            discount_percent: 0,
            discount_amount: 0,
            gst_percent: Number(p.gst_percent ?? p.default_gst_rate ?? p.tax_percent ?? 18),
            applied_rate_type: defaultRateType,
          };
        }),
      );
    },
    [products, resolvePriceForLine],
  );

  const onRateTypeChange = useCallback(
    (key: string, rateType: string) => {
      setLines((prev) =>
        prev.map((row) => {
          if (row.key !== key) return row;
          const p = products.find(
            (x) => String(x._id ?? x.id ?? "") === row.productId,
          );
          const price = resolvePriceForLine(row.productId, rateType, p);
          return {
            ...row,
            applied_rate_type: rateType,
            unit_price: price > 0 ? price : row.unit_price,
          };
        }),
      );
    },
    [products, resolvePriceForLine],
  );

  const openMapModal = useCallback(
    (row: LineRow) => {
      if (!canMapPrice) {
        toast.error("Select a party before mapping prices.");
        return;
      }
      if (!row.productId) {
        toast.error("Select a product on this line first.");
        return;
      }
      const rateItem = rateItemByLine.get(
        rateLookupKey(row.productId, row.applied_rate_type),
      );
      setMapTarget({
        productId: row.productId,
        productName: row.product_name || "Product",
        sku: row.sku || undefined,
        appliedRateType: row.applied_rate_type,
        unitPrice: row.unit_price,
        mappingId: rateItem?.mappingId ?? null,
        isMapped: Boolean(rateItem?.isMapped),
        hasRate: Boolean(rateItem?.hasRate),
      });
      setMapModalOpen(true);
    },
    [canMapPrice, rateItemByLine],
  );

  const closeMapModal = useCallback(() => {
    setMapModalOpen(false);
    setMapTarget(null);
  }, []);

  const handleMapPriceSuccess = useCallback(
    (result: MapOrderLinePriceSuccess) => {
      setLines((prev) =>
        prev.map((row) => {
          if (
            row.productId === result.productId &&
            row.applied_rate_type === result.appliedRateType
          ) {
            return { ...row, unit_price: result.negotiatedRate };
          }
          return row;
        }),
      );
      toast.success("Line price updated to negotiated rate.");
      if (!rateCheckQ.isUninitialized) {
        void rateCheckQ.refetch();
      }
    },
    [rateCheckQ],
  );

  const onPartyChange = useCallback((id: string, skipPreviousItems = false) => {
    setPartyId(id);
    if (id) {
      if (!skipPreviousItems) {
        setPreviousItemsModalOpen(true);
      }
    } else {
      setPreviousItemsModalOpen(false);
    }
  }, []);

  const openQuickPartyModal = useCallback((initialName = "") => {
    setQuickPartyInitialName(initialName);
    setQuickPartyModalOpen(true);
  }, []);

  const handlePartyCreated = useCallback(
    (newParty: Record<string, unknown>) => {
      const pId = String(newParty._id ?? newParty.id ?? "");
      setLocallyAddedParties((prev) => [newParty, ...prev]);
      if (pId) {
        onPartyChange(pId, true);
      }
    },
    [onPartyChange],
  );

  const openQuickProductModal = useCallback(
    (targetRowKey: string | null = null, initialName = "") => {
      setQuickProductTargetRowKey(targetRowKey);
      setQuickProductInitialName(initialName);
      setQuickProductModalOpen(true);
    },
    [],
  );

  const handleProductCreated = useCallback(
    (newProd: Record<string, unknown>) => {
      const pId = String(newProd._id ?? newProd.id ?? "");
      setLocallyAddedProducts((prev) => [newProd, ...prev]);

      if (!pId) return;

      if (quickProductTargetRowKey) {
        onProductRowChange(quickProductTargetRowKey, pId);
      } else {
        const rowKey = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const defaultRateType = "SR";
        const price = resolvePriceForLine(pId, defaultRateType, newProd);
        const newLineItem: LineRow = {
          key: rowKey,
          productId: pId,
          product_name: String(newProd.product_name ?? ""),
          sku: String(newProd.sku ?? ""),
          brand: String(newProd.brand ?? ""),
          manufacturer: String(newProd.manufacturer ?? ""),
          product_group: String(newProd.product_group ?? ""),
          product_subgroup: String(newProd.product_subgroup ?? ""),
          unit: String(newProd.unit ?? "Pcs"),
          quantity: 1,
          free_qty: 0,
          unit_price: price,
          discount_percent: 0,
          discount_amount: 0,
          gst_percent: Number(newProd.gst_percent ?? 18),
          applied_rate_type: defaultRateType,
          remarks: "",
        };
        setLines((prev) => {
          if (prev.length === 1 && !prev[0].productId) {
            return [newLineItem];
          }
          return [...prev, newLineItem];
        });
      }
    },
    [quickProductTargetRowKey, onProductRowChange, resolvePriceForLine],
  );

  const loadPreviousItems = useCallback(
    (items: PreviousPartyOrderItem[]) => {
      if (!items || items.length === 0) return;
      const mappedLines: LineRow[] = items.map((item) => {
        const prod = products.find(
          (p) => String(p._id ?? p.id ?? "") === item.productId,
        );
        const base = newLine();
        return {
          ...base,
          productId: item.productId,
          product_name: item.product_name,
          sku: item.sku || (prod ? String(prod.sku || "") : ""),
          brand: prod ? String(prod.brand || "") : "",
          manufacturer: prod ? String(prod.manufacturer || "") : "",
          product_group: prod ? String(prod.product_group || "") : "",
          product_subgroup: prod ? String(prod.product_subgroup || "") : "",
          unit: prod ? String(prod.unit || "") : "",
          quantity: item.quantity > 0 ? item.quantity : 1,
          free_qty: item.free_qty || 0,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          gst_percent: item.gst_percent || 18,
          applied_rate_type: item.applied_rate_type || "SR",
          remarks: item.remarks || "",
        };
      });
      setLines(mappedLines);
    },
    [products],
  );

  const handleNextToStep2 = useCallback(() => {
    if (!partyId) {
      toast.error("Select a party.");
      return;
    }
    const prepared = lines.filter((l) => l.productId);
    if (!prepared.length) {
      toast.error("Add at least one line with a product.");
      return;
    }
    const badQty = prepared.some(
      (l) => !Number.isFinite(l.quantity) || l.quantity < 1,
    );
    if (badQty) {
      toast.error("Each line needs quantity ≥ 1.");
      return;
    }
    if (!orderDate.trim()) {
      toast.error("Order date is required.");
      return;
    }
    if (!expectedDate.trim()) {
      toast.error("Expected delivery date is required.");
      return;
    }
    if (!assignedSales) {
      toast.error("Please select a sales representative.");
      return;
    }

    const salesRep =
      selectedSalesUser ||
      salesUsers.find((u) => String(u._id ?? u.id ?? "") === String(assignedSales));
    const salesRepName = salesRep
      ? String(salesRep.name || salesRep.username || "").trim()
      : "";

    const pType = String((selectedParty as any)?.party_type || "").toLowerCase();
    const friendlyCustomerType =
      pType === "hospital" ? "Hospital" :
      pType === "dealer" ? "Dealer" :
      pType === "distributor" ? "Distributor" :
      pType === "institutional" ? "Institutional" :
      pType === "government" ? "Government" :
      "Direct Customer";

    const currentShipTo = shippingAddress.address_line_1
      ? formatAddressOneLine(shippingAddress)
      : billingAddress.address_line_1
      ? formatAddressOneLine(billingAddress)
      : selectedPartyAddress;

    setPerformaValues((prev) => ({
      ...prev,
      sales_person: salesRepName || prev.sales_person,
      dispatch_date: prev.dispatch_date || expectedDate,
      ship_to_address: prev.ship_to_address || currentShipTo,
      payment_terms: prev.payment_terms || String((selectedParty as any)?.payment_terms || "30 days"),
      customer_type: prev.customer_type || friendlyCustomerType,
      freight_charges: prev.freight_charges || "Included",
    }));
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    partyId,
    lines,
    orderDate,
    expectedDate,
    assignedSales,
    salesUsers,
    selectedSalesUser,
    selectedParty,
    shippingAddress,
    billingAddress,
    selectedPartyAddress,
  ]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!partyId) {
        toast.error("Select a party.");
        return;
      }
      const prepared = lines
        .filter((l) => l.productId)
        .map((l) => ({
          product: l.productId,
          product_name: l.product_name,
          sku: l.sku,
          brand: l.brand,
          manufacturer: l.manufacturer,
          product_group: l.product_group,
          product_subgroup: l.product_subgroup,
          unit: l.unit,
          quantity: Number(l.quantity),
          free_quantity: Number(l.free_qty || 0),
          unit_price: Number(l.unit_price),
          discount_percent: Number(l.discount_percent || 0),
          discount_amount: Number(l.discount_amount || 0),
          gst_percent: Number(l.gst_percent || 0),
          applied_rate_type: l.applied_rate_type || "SR",
          remarks: l.remarks || "",
        }));

      if (!prepared.length) {
        toast.error("Add at least one line with a product.");
        return;
      }
      const badQty = prepared.some(
        (l) => !Number.isFinite(l.quantity) || l.quantity < 1,
      );
      if (badQty) {
        toast.error("Each line needs quantity ≥ 1.");
        return;
      }
      if (!orderDate.trim()) {
        toast.error("Order date is required.");
        return;
      }
      if (!expectedDate.trim()) {
        toast.error("Expected delivery date is required.");
        return;
      }
      if (!assignedSales) {
        toast.error("Please select a sales representative.");
        return;
      }

      try {
        const friendlyCustomerType = (() => {
          const pType = String((selectedParty as any)?.party_type || "").toLowerCase();
          if (pType === "hospital") return "Hospital";
          if (pType === "dealer") return "Dealer";
          if (pType === "distributor") return "Distributor";
          if (pType === "institutional") return "Institutional";
          if (pType === "government") return "Government";
          return "Direct Customer";
        })();

        const finalShipTo =
          performaValues.ship_to_address.trim() ||
          (shippingAddress.address_line_1
            ? formatAddressOneLine(shippingAddress)
            : billingAddress.address_line_1
            ? formatAddressOneLine(billingAddress)
            : selectedPartyAddress);

        const salesRep =
          selectedSalesUser ||
          salesUsers.find((u) => String(u._id ?? u.id ?? "") === String(assignedSales));
        const salesRepName = salesRep
          ? String(salesRep.name || salesRep.username || "").trim()
          : "";

        const finalPerforma: PerformaFormValues = {
          ...performaValues,
          sales_person:
            performaValues.sales_person.trim() ||
            String(salesRepName || ""),
          dispatch_date: performaValues.dispatch_date || expectedDate,
          ship_to_address: finalShipTo,
          payment_terms: performaValues.payment_terms.trim() || String((selectedParty as any)?.payment_terms || "30 days"),
          customer_type: performaValues.customer_type.trim() || friendlyCustomerType,
          freight_charges: performaValues.freight_charges.trim() || "Included",
          margin_sheet_attached: performaValues.margin_sheet_attached || (attachmentFiles.cost_sheet_file ? "Attached" : ""),
          kyc_status: performaValues.kyc_status || (
            attachmentFiles.aadhaar_file || attachmentFiles.pan_file || attachmentFiles.gst_file || (attachmentFiles.kyc_files && attachmentFiles.kyc_files.length > 0)
              ? "Attached"
              : ""
          ),
        };

        // NOTE: Coordinator order is saved as a DRAFT without approvals
        const body: Record<string, unknown> = {
          party: partyId,
          order_items: prepared,
          discount_amount: Number(headerDiscount || 0),
          priority: "normal",
          remarks: remarks.trim() || "",
          order_date: orderDate,
          expected_delivery_date: expectedDate,
          assigned_sales_user: assignedSales,
          billing_address: billingAddress.address_line_1 ? billingAddress : undefined,
          shipping_address: shippingAddress.address_line_1
            ? shippingAddress
            : billingAddress.address_line_1
            ? billingAddress
            : undefined,
          save_shipping_to_party: saveShippingToParty,
          performa: finalPerforma,
          status: "draft",
        };

        const data = (await createOrder(body).unwrap()) as any;
        const orderNo = String(data?.order_no ?? "");
        const orderId = String(data?._id ?? data?.id ?? "");

        if (orderId) {
          if (isPOEnabled && attachmentFiles.po_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.po_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
            fd.append("category", "po");
            fd.append("remarks", "Purchase Order (PO)");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload PO attachment:", err);
            });
          }

          if (isCostSheetEnabled && attachmentFiles.cost_sheet_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.cost_sheet_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
            fd.append("category", "cost_sheet");
            fd.append("remarks", "Cost Sheet / Margin Sheet");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload Cost Sheet attachment:", err);
            });
          }

          if (isKycEnabled && attachmentFiles.aadhaar_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.aadhaar_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
            fd.append("category", "kyc_aadhaar");
            fd.append("remarks", "Customer Aadhaar Card");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload Aadhaar attachment:", err);
            });

            if (partyId) {
              const pfd = new FormData();
              pfd.append("file", attachmentFiles.aadhaar_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", partyId);
              pfd.append("category", "kyc_aadhaar");
              pfd.append("remarks", "Customer Aadhaar Card from Order");
              await createAttachment(pfd).unwrap().catch(() => {});
            }
          }

          if (isKycEnabled && attachmentFiles.pan_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.pan_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
            fd.append("category", "kyc_pan");
            fd.append("remarks", "Customer PAN Card");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload PAN attachment:", err);
            });

            if (partyId) {
              const pfd = new FormData();
              pfd.append("file", attachmentFiles.pan_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", partyId);
              pfd.append("category", "kyc_pan");
              pfd.append("remarks", "Customer PAN Card from Order");
              await createAttachment(pfd).unwrap().catch(() => {});
            }
          }

          if (isKycEnabled && attachmentFiles.gst_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.gst_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
            fd.append("category", "kyc_gst");
            fd.append("remarks", "Customer GST Certificate");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload GST attachment:", err);
            });

            if (partyId) {
              const pfd = new FormData();
              pfd.append("file", attachmentFiles.gst_file);
              pfd.append("entity_type", "party");
              pfd.append("entity_id", partyId);
              pfd.append("category", "kyc_gst");
              pfd.append("remarks", "Customer GST Certificate from Order");
              await createAttachment(pfd).unwrap().catch(() => {});
            }
          }

          if (isKycEnabled && attachmentFiles.kyc_files && attachmentFiles.kyc_files.length > 0) {
            for (const f of attachmentFiles.kyc_files) {
              const fd = new FormData();
              fd.append("file", f);
              fd.append("entity_type", "order");
              fd.append("entity_id", orderId);
              fd.append("category", "kyc_other");
              fd.append("remarks", `KYC Document (${f.name})`);
              await createAttachment(fd).unwrap().catch((err) => {
                console.warn(`Failed to upload KYC attachment ${f.name}:`, err);
              });
            }
          }

          if (isPerformaEnabled) {
            await updateOrderPerforma({
              orderId,
              data: finalPerforma,
            }).unwrap().catch((err) => {
              console.warn("Failed to sync performa after attachments upload:", err);
            });
          }
        }

        toast.success(
          orderNo
            ? `Order ${orderNo} created as draft successfully.`
            : "Order created as draft successfully.",
        );
        onCreated?.({ orderId, orderNo });
        if (asModal) {
          onClose?.();
        } else {
          router.push(`/coordinator/order/${orderId}`);
        }
      } catch (rejected) {
        toast.error(mutationRejectedMessage(rejected));
      }
    },
    [
      partyId,
      lines,
      orderDate,
      expectedDate,
      assignedSales,
      selectedSalesUser,
      salesUsers,
      remarks,
      headerDiscount,
      billingAddress,
      shippingAddress,
      saveShippingToParty,
      performaValues,
      attachmentFiles,
      selectedParty,
      selectedPartyAddress,
      createOrder,
      createAttachment,
      updateOrderPerforma,
      asModal,
      onClose,
      onCreated,
      router,
    ],
  );

  if (asModal && !isOpen) return null;

  return (
    <div className="mx-auto w-full max-w-[min(100rem,calc(100vw-2rem))] space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/coordinator/orders"
              className="hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              Orders
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Create Order (Draft)
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Create Order (Draft)
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {modalSubtitle ||
              "Orders created by coordinators are saved as drafts. You can review items and submit the order for approval when ready."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/coordinator/orders"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5 transition"
          >
            Back to Orders
          </Link>
        </div>
      </div>

      {/* Draft Notification Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
        <Clock className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div>
          <span className="font-semibold">Coordinator Workflow Note:</span> This order will be created in{" "}
          <span className="font-bold">Draft</span> status. No approval will be created automatically. You can review, attach documents, and submit the order when ready from the Order Details page.
        </div>
      </div>

      {/* Step Tabs Header */}
      {isPerformaEnabled && (
        <div className="flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              step === 1
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-2xs font-bold text-white">
              1
            </span>
            <span>Order Details & Items</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">/</span>

          <button
            type="button"
            onClick={handleNextToStep2}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
              step === 2
                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-2xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              2
            </span>
            <span>Performa Invoice</span>
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1: Order Details & Line Items */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Left Column */}
            <div className="min-w-0 space-y-6">
              {/* Party & Terms Section */}
              <section className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <header className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Party & Dates
                    </h2>
                  </div>
                  {partyId && (
                    <button
                      type="button"
                      onClick={() => setPreviousItemsModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5 text-slate-400" />
                      <span>Past Party Orders</span>
                    </button>
                  )}
                </header>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2 space-y-1 relative z-30">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Select Party <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => openQuickPartyModal("")}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Quick Add Party
                      </button>
                    </div>
                    <PartyAutocomplete
                      parties={parties}
                      selectedId={partyId}
                      onChange={onPartyChange}
                      onQuickAdd={openQuickPartyModal}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Order Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Expected Delivery Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </section>

              {/* Billing & Shipping Addresses */}
              {selectedParty && (
                <OrderAddressSelector
                  party={selectedParty}
                  billingAddress={billingAddress}
                  shippingAddress={shippingAddress}
                  onBillingAddressChange={setBillingAddress}
                  onShippingAddressChange={setShippingAddress}
                  saveShippingToParty={saveShippingToParty}
                  onSaveShippingToPartyChange={setSaveShippingToParty}
                />
              )}

              {/* Catalog Line Items */}
              <section className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-500" />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        Line Items ({lines.filter((l) => l.productId).length})
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Add products and specify quantities.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openQuickProductModal(null)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Quick Add Product</span>
                    </button>
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 transition dark:bg-blue-950/40 dark:text-blue-400 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>
                </header>

                <div className="overflow-x-auto min-h-[320px] pb-40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-white/5 text-slate-500 dark:text-slate-400">
                        <th className="pb-2 font-semibold">Product</th>
                        <th className="pb-2 font-semibold w-24">Qty</th>
                        <th className="pb-2 font-semibold w-20">Free</th>
                        <th className="pb-2 font-semibold w-24">Rate</th>
                        <th className="pb-2 font-semibold w-28">Price (₹)</th>
                        <th className="pb-2 font-semibold w-20">Disc %</th>
                        <th className="pb-2 font-semibold w-20">GST %</th>
                        <th className="pb-2 font-semibold w-28 text-right">Total (₹)</th>
                        <th className="pb-2 font-semibold w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {lines.map((line, idx) => {
                        const rateItem = rateItemByLine.get(
                          rateLookupKey(line.productId, line.applied_rate_type),
                        );
                        const displayStatus = resolveRateDisplayStatus(
                          rateItem,
                          line.unit_price,
                        );

                        return (
                          <tr
                            key={line.key}
                            className="group relative"
                            style={{ zIndex: (lines.length - idx) * 10 + 20 }}
                          >
                            <td
                              className="py-2.5 pr-3 align-top min-w-[240px] relative"
                              style={{ zIndex: (lines.length - idx) * 10 + 25 }}
                            >
                              <ProductAutocomplete
                                products={products}
                                selectedId={line.productId}
                                onChange={(pId) => onProductRowChange(line.key, pId)}
                                onQuickAdd={(name) => openQuickProductModal(line.key, name)}
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50"
                              />
                              {line.productId && (
                                <div className="mt-1 flex items-center gap-2">
                                  <LineRateStatusBadge
                                    status={displayStatus}
                                    rateItem={rateItem}
                                    formatMoney={formatMoney}
                                  />
                                  {canMapPrice && (
                                    <button
                                      type="button"
                                      onClick={() => openMapModal(line)}
                                      className="text-2xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                                    >
                                      Map Rate
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 text-right"
                              />
                            </td>

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                min={0}
                                value={line.free_qty}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    free_qty: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 text-right"
                              />
                            </td>

                            <td className="py-2.5 pr-2 align-top w-24">
                              <select
                                value={line.applied_rate_type || "SR"}
                                onChange={(e) => onRateTypeChange(line.key, e.target.value)}
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 font-medium cursor-pointer"
                              >
                                {line.applied_rate_type === "MANUAL" && (
                                  <option value="MANUAL">Manual</option>
                                )}
                                <option value="SR">SR</option>
                                <option value="SRA">SRA</option>
                                <option value="CR">CR</option>
                              </select>
                            </td>

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={line.unit_price}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    unit_price: Math.max(0, Number(e.target.value) || 0),
                                    applied_rate_type: "MANUAL",
                                  })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 text-right font-mono"
                              />
                            </td>

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                max={100}
                                value={line.discount_percent}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    discount_percent: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 text-right"
                              />
                            </td>

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={line.gst_percent}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    gst_percent: Math.max(0, Number(e.target.value) || 0),
                                  })
                                }
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50 text-right"
                              />
                            </td>

                            <td className="py-2.5 pr-2 align-top text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                              ₹{formatMoney(lineTotal(line))}
                            </td>

                            <td className="py-2.5 text-center align-top">
                              <button
                                type="button"
                                onClick={() => removeLine(line.key)}
                                className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                                title="Remove line"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-650 hover:underline dark:text-blue-400 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add another item</span>
                  </button>
                </div>
              </section>

              {/* Remarks */}
              <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Order Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional order instructions or notes…"
                  className={`${inputClass} mt-1`}
                />
              </section>
            </div>

            {/* Right Column: Assignment & Summary Sidebar */}
            <div className="space-y-6">
              {/* Sales Representative Assignment */}
              <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <header className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
                  <Users className="h-4 w-4 text-blue-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Assignment
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Required — assign sales rep for order tracking.
                    </p>
                  </div>
                </header>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Sales Representative <span className="text-rose-500">*</span>
                  </label>
                  <SalesAutocomplete
                    salesUsers={salesUsers}
                    selectedId={assignedSales}
                    onChange={setAssignedSales}
                    className={inputClass}
                  />
                </div>
              </section>

              {/* Order Summary & Actions */}
              <section className="rounded-xl border border-blue-100 bg-blue-50/20 p-5 shadow-xs dark:border-blue-900/30 dark:bg-blue-950/10">
                <header className="mb-4 border-b border-blue-100/50 pb-3 dark:border-blue-900/20">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Order Summary
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Calculated estimate of current items.
                  </p>
                </header>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Total Items</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-200">
                      {liveSummary.itemCount}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      ₹{formatMoney(liveSummary.subtotal)}
                    </span>
                  </div>
                  {liveSummary.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-mono">-₹{formatMoney(liveSummary.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Taxable Amount</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      ₹{formatMoney(liveSummary.taxable)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>GST (Estimated)</span>
                    <span className="font-mono text-slate-900 dark:text-slate-200">
                      ₹{formatMoney(liveSummary.gst)}
                    </span>
                  </div>

                  <div className="border-t border-blue-200/60 pt-2.5 mt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-slate-50">
                    <span>Estimated Total</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">
                      ₹{formatMoney(liveSummary.total)}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {!assignedSales && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                      Select a sales representative to proceed.
                    </p>
                  )}
                  {!allItemsNegotiated && lines.some((l) => l.productId) && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-medium text-center">
                      All items must be negotiated to proceed.
                    </p>
                  )}
                  {isPerformaEnabled ? (
                    <>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={handleNextToStep2}
                        className="w-full font-semibold shadow-md shadow-primary/25 gap-2 cursor-pointer"
                      >
                        <span>Next: Performa Invoice</span>
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <button
                        type="submit"
                        disabled={isLoading || !allItemsNegotiated || !assignedSales}
                        className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                      >
                        {isLoading ? "Saving draft..." : "Or create & save draft without Performa"}
                      </button>
                    </>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isLoading || !allItemsNegotiated || !assignedSales}
                      className="w-full font-semibold shadow-md shadow-primary/25 gap-2 cursor-pointer"
                    >
                      <span>{isLoading ? "Saving draft..." : "Create Order Draft"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Step 2: Performa Invoice */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Overview Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Step 2: Performa Invoice Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Commercial details, transport carrier, payment terms, and compliance attachments.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200/80 dark:bg-slate-800 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Party: </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedPartyName || "—"}</span>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200/80 dark:bg-slate-800 dark:border-white/5">
                  <span className="text-slate-500 dark:text-slate-400">Sales Rep: </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{String(selectedSalesUser?.name || selectedSalesUser?.username || "—")}</span>
                </div>
                <div className="rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold">
                  Total: ₹{formatMoney(liveSummary.total)}
                </div>
              </div>
            </div>

            {/* Performa Form Fields */}
            <PerformaInvoiceFields
              values={performaValues}
              onChange={(f, v) => setPerformaValues((prev) => ({ ...prev, [f]: v }))}
              billingAddress={selectedPartyAddress}
              attachmentFiles={attachmentFiles}
              onAttachmentFileChange={handleAttachmentFileChange}
            />

            {/* Navigation and Submit Footer */}
            <div className="flex items-center justify-between gap-4 border-t border-slate-200/80 pt-4 dark:border-white/10">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep(1)}
                className="gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Order Items
              </Button>

              <Button
                type="submit"
                disabled={isLoading || !allItemsNegotiated || !assignedSales}
                className="font-semibold shadow-md shadow-primary/25 min-w-[180px] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-primary-foreground" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving Draft Order...
                  </>
                ) : (
                  "Create Draft Order"
                )}
              </Button>
            </div>
          </div>
        )}
      </form>

      <MapOrderLinePriceModal
        open={mapModalOpen}
        onClose={closeMapModal}
        partyId={partyId}
        target={mapTarget}
        onSuccess={handleMapPriceSuccess}
      />

      <PreviousPartyItemsModal
        open={previousItemsModalOpen}
        onClose={() => setPreviousItemsModalOpen(false)}
        partyId={partyId}
        partyName={selectedPartyName}
        onLoad={loadPreviousItems}
      />

      {/* Quick Add Party Modal (Unified Single Form) */}
      <PartyDetailModal
        open={quickPartyModalOpen}
        create={true}
        partyId={null}
        initialName={quickPartyInitialName}
        portalHome="/coordinator"
        onClose={() => setQuickPartyModalOpen(false)}
        onSuccess={handlePartyCreated}
      />

      {/* Quick Add Product Modal (Unified Single Form) */}
      <ProductDetailModal
        open={quickProductModalOpen}
        create={true}
        productId={null}
        initialName={quickProductInitialName}
        onClose={() => setQuickProductModalOpen(false)}
        onSuccess={handleProductCreated}
      />
    </div>
  );
}
