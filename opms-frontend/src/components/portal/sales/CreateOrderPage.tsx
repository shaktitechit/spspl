"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type { FormEvent } from "react";
import {
  ShoppingCart,
  Search,
  User,
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  FileText,
  Check,
  History,
} from "lucide-react";

import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useCreateOrderMutation,
  useListPartiesQuery,
  useListProductsQuery,
  useCreateAttachmentMutation,
  useUpdateOrderPerformaMutation,
} from "@/store/api";
import { useAppSelector } from "@/store";
import { Button } from "@/components/ui/Button";
import {
  PreviousPartyItemsModal,
  type PreviousPartyOrderItem,
} from "@/components/portal/shared/orders/modals/PreviousPartyItemsModal";
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

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";

type Entity = Record<string, unknown>;

function pickList(raw: unknown): Entity[] {
  if (Array.isArray(raw)) return raw as Entity[];
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
}

function PartyAutocomplete({
  parties,
  selectedId,
  onChange,
  className,
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
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
              No parties found
            </div>
          ) : (
            filtered.map((p) => {
              const id = String(p._id ?? p.id ?? "");
              const isSelected = id === selectedId;
              const name = String(p.party_name || "Party");
              const code = p.party_code ? ` · ${p.party_code}` : "";
              const type = p.party_type ? ` (${p.party_type})` : "";
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
                  <span className="truncate">
                    {name}
                    {code && <span className="text-2xs text-slate-500 dark:text-slate-400 ml-1">{code}</span>}
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
            })
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
}

function ProductAutocomplete({
  products,
  selectedId,
  onChange,
  className,
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
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
              No products found
            </div>
          ) : (
            filtered.map((p) => {
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
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer ${
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
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function CreateOrderPage() {
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const partiesQ = useListPartiesQuery({ status: "active" });
  const productsQ = useListProductsQuery({});

  const parties = useMemo(() => pickList(partiesQ.data), [partiesQ.data]);
  const products = useMemo(() => pickList(productsQ.data), [productsQ.data]);

  const [partyId, setPartyId] = useState("");
  const [orderDate, setOrderDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });
  const [expectedDate, setExpectedDate] = useState("");
  const headerDiscount = "0";
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const [previousItemsModalOpen, setPreviousItemsModalOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [performaValues, setPerformaValues] = useState<PerformaFormValues>(INITIAL_PERFORMA_VALUES);
  const [attachmentFiles, setAttachmentFiles] = useState<PerformaAttachmentFiles>({
    po_file: null,
    cost_sheet_file: null,
    aadhaar_file: null,
    pan_file: null,
    gst_file: null,
    kyc_files: [],
  });

  const [createOrder, { isLoading }] = useCreateOrderMutation();
  const [createAttachment] = useCreateAttachmentMutation();
  const [updateOrderPerforma] = useUpdateOrderPerformaMutation();

  const handleAttachmentFileChange = useCallback(
    (field: keyof PerformaAttachmentFiles, file: File | File[] | null) => {
      setAttachmentFiles((prev) => ({ ...prev, [field]: file }));
    },
    [],
  );

  const selectedParty = useMemo(() => {
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(partyId));
  }, [parties, partyId]);

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

  const selectedPartyName = selectedParty
    ? String(selectedParty.party_name || "")
    : "";

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

      setPerformaValues((prev) => ({
        ...prev,
        customer_type: prev.customer_type || friendlyCustomerType,
        payment_terms: prev.payment_terms || String((selectedParty as any).payment_terms || "30 days"),
        freight_charges: prev.freight_charges || "Included",
        sales_person: prev.sales_person || String(user?.name || user?.username || ""),
        ship_to_address: prev.ship_to_address || formatAddressOneLine(chosen || bAddr),
      }));
    } else {
      setBillingAddress(emptyOrderAddress);
      setShippingAddress(emptyOrderAddress);
    }
  }, [selectedParty, user]);

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

  const onPartyChange = useCallback((id: string) => {
    setPartyId(id);
    if (id) {
      setPreviousItemsModalOpen(true);
    } else {
      setPreviousItemsModalOpen(false);
    }
  }, []);

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
          const pid = String(p._id ?? p.id ?? "");
          const defaultPrice = Number(p.standard_rate ?? p.price ?? p.unit_price ?? p.mrp ?? 0);
          return {
            ...row,
            productId: pid,
            product_name: String(p.product_name ?? ""),
            sku: String(p.sku ?? ""),
            brand: String(p.brand ?? ""),
            manufacturer: String(p.manufacturer ?? ""),
            product_group: String(p.product_group ?? ""),
            product_subgroup: String(p.product_subgroup ?? ""),
            unit: String(p.unit ?? ""),
            unit_price: defaultPrice,
            gst_percent: Number(p.gst_percent ?? p.default_gst_rate ?? p.gst_rate ?? 18),
          };
        }),
      );
    },
    [products],
  );

  const loadPreviousItems = useCallback(
    (selectedItems: PreviousPartyOrderItem[]) => {
      if (!selectedItems.length) return;
      const mappedLines: LineRow[] = selectedItems.map((item) => {
        const p = products.find(
          (x) => String(x._id ?? x.id ?? "") === String(item.productId),
        );
        const price =
          Number(item.unit_price) > 0
            ? Number(item.unit_price)
            : Number(p?.standard_rate ?? p?.price ?? p?.unit_price ?? p?.mrp ?? 0);
        const gst =
          item.gst_percent ??
          Number(p?.gst_percent ?? p?.default_gst_rate ?? p?.gst_rate ?? 18);

        return {
          key:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          productId: item.productId,
          product_name: item.product_name,
          sku: item.sku || (p ? String(p.sku || "") : ""),
          brand: item.brand || (p ? String(p.brand || "") : ""),
          manufacturer: item.manufacturer || (p ? String(p.manufacturer || "") : ""),
          product_group: item.product_group || (p ? String(p.product_group || "") : ""),
          product_subgroup: item.product_subgroup || (p ? String(p.product_subgroup || "") : ""),
          unit: item.unit || (p ? String(p.unit || "") : ""),
          quantity: item.quantity > 0 ? item.quantity : 1,
          free_qty: item.free_qty || 0,
          unit_price: price,
          discount_percent: Number(item.discount_percent ?? 0),
          discount_amount: Number(item.discount_amount ?? 0),
          gst_percent: gst,
          applied_rate_type: "MANUAL",
          remarks: item.remarks || "",
        };
      });

      if (mappedLines.length > 0) {
        setLines(mappedLines);
        toast.success(
          `Loaded ${mappedLines.length} previous item${mappedLines.length === 1 ? "" : "s"} for this party.`,
        );
      }
    },
    [products],
  );

  const liveSummary = useMemo(() => {
    let subtotal = 0;
    let discount = 0;
    let taxable = 0;
    let gst = 0;
    let total = 0;

    for (const row of lines) {
      if (!row.productId) continue;
      subtotal += lineGross(row);
      discount += lineDiscount(row);
      taxable += lineTaxable(row);
      gst += lineGst(row);
      total += lineTotal(row);
    }

    const finalTotal = Math.max(0, total - Number(headerDiscount || 0));
    return {
      subtotal,
      discount,
      taxable,
      gst,
      total: finalTotal,
      itemCount: lines.filter((l) => l.productId).length,
    };
  }, [lines, headerDiscount]);

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
          sku: l.sku || "",
          brand: l.brand || "",
          manufacturer: l.manufacturer || "",
          product_group: l.product_group || "",
          product_subgroup: l.product_subgroup || "",
          unit: l.unit || "",
          ordered_quantity: Number(l.quantity),
          free_quantity: Number(l.free_qty || 0),
          allocated_quantity: 0,
          dispatched_quantity: 0,
          delivered_quantity: 0,
          cancelled_quantity: 0,
          unit_price: Number(l.unit_price),
          discount_percent: Number(l.discount_percent || 0),
          discount_amount: Number(l.discount_amount || 0),
          gst_percent: Number(l.gst_percent ?? 18),
          applied_rate_type: l.applied_rate_type,
          remarks: l.remarks.trim() || "",
        }));

      if (!prepared.length) {
        toast.error("Add at least one line with a product.");
        return;
      }
      const badQty = prepared.some(
        (l) => !Number.isFinite(l.ordered_quantity) || l.ordered_quantity < 1,
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

      const finalPerforma: PerformaFormValues = {
        ...performaValues,
        sales_person: performaValues.sales_person.trim() || String(user?.name || user?.username || ""),
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

      const body = {
        party: partyId,
        order_items: prepared,
        discount_amount: Number(headerDiscount || 0),
        priority: "normal",
        remarks: remarks.trim() || "",
        order_date: orderDate,
        expected_delivery_date: expectedDate,
        assigned_sales_user: (user?._id || user?.id) ? String(user?._id || user?.id) : undefined,
        billing_address: billingAddress.address_line_1 ? billingAddress : undefined,
        shipping_address: shippingAddress.address_line_1
          ? shippingAddress
          : billingAddress.address_line_1
          ? billingAddress
          : undefined,
        save_shipping_to_party: saveShippingToParty,
        performa: finalPerforma,
      };

      try {
        const data = (await createOrder(body).unwrap()) as any;
        const createdOrderId = String(data?._id || data?.id || data?.order_id || "");

        if (createdOrderId) {
          if (attachmentFiles.po_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.po_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "po");
            fd.append("remarks", "Purchase Order (PO)");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload PO attachment:", err);
            });
          }

          if (attachmentFiles.cost_sheet_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.cost_sheet_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
            fd.append("category", "cost_sheet");
            fd.append("remarks", "Cost Sheet / Margin Sheet");
            await createAttachment(fd).unwrap().catch((err) => {
              console.warn("Failed to upload Cost Sheet attachment:", err);
            });
          }

          if (attachmentFiles.aadhaar_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.aadhaar_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
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

          if (attachmentFiles.pan_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.pan_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
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

          if (attachmentFiles.gst_file) {
            const fd = new FormData();
            fd.append("file", attachmentFiles.gst_file);
            fd.append("entity_type", "order");
            fd.append("entity_id", createdOrderId);
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

          if (attachmentFiles.kyc_files && attachmentFiles.kyc_files.length > 0) {
            for (const file of attachmentFiles.kyc_files) {
              const fd = new FormData();
              fd.append("file", file);
              fd.append("entity_type", "order");
              fd.append("entity_id", createdOrderId);
              fd.append("category", "kyc");
              fd.append("remarks", "KYC Document");
              await createAttachment(fd).unwrap().catch((err) => {
                console.warn("Failed to upload KYC attachment:", err);
              });

              if (partyId) {
                const pfd = new FormData();
                pfd.append("file", file);
                pfd.append("entity_type", "party");
                pfd.append("entity_id", partyId);
                pfd.append("category", "kyc");
                pfd.append("remarks", "KYC Document from Order");
                await createAttachment(pfd).unwrap().catch(() => {});
              }
            }
          }

          // Sync performa after all attachments uploaded to ensure IDs and statuses link immediately
          await updateOrderPerforma({
            orderId: createdOrderId,
            data: finalPerforma,
          }).unwrap().catch((err) => {
            console.warn("Failed to sync performa after attachments upload:", err);
          });
        }

        toast.success(
          data?.order_no
            ? `Draft order ${data.order_no} created successfully`
            : "Draft order created successfully",
        );
        router.push("/sales/orders");
      } catch (rejected) {
        toast.error(mutationRejectedMessage(rejected));
      }
    },
    [
      partyId,
      lines,
      headerDiscount,
      remarks,
      orderDate,
      expectedDate,
      user,
      performaValues,
      attachmentFiles,
      createOrder,
      createAttachment,
      updateOrderPerforma,
      billingAddress,
      shippingAddress,
      saveShippingToParty,
      selectedParty,
      selectedPartyAddress,
      router,
    ],
  );

  const validateStep1 = useCallback(() => {
    if (!partyId) {
      toast.error("Select a party.");
      return false;
    }
    const prepared = lines.filter((l) => l.productId);
    if (!prepared.length) {
      toast.error("Add at least one line with a product.");
      return false;
    }
    const badQty = prepared.some(
      (l) => !Number.isFinite(l.quantity) || l.quantity < 1,
    );
    if (badQty) {
      toast.error("Each line needs quantity ≥ 1.");
      return false;
    }
    if (!orderDate.trim()) {
      toast.error("Order date is required.");
      return false;
    }
    if (!expectedDate.trim()) {
      toast.error("Expected delivery date is required.");
      return false;
    }
    return true;
  }, [partyId, lines, orderDate, expectedDate]);

  const handleNextToStep2 = useCallback(() => {
    if (!validateStep1()) return;

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
      sales_person: prev.sales_person || String(user?.name || user?.username || ""),
      dispatch_date: prev.dispatch_date || expectedDate,
      ship_to_address: prev.ship_to_address || currentShipTo,
      payment_terms: prev.payment_terms || String((selectedParty as any)?.payment_terms || "30 days"),
      customer_type: prev.customer_type || friendlyCustomerType,
      freight_charges: prev.freight_charges || "Included",
    }));
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [validateStep1, user, expectedDate, selectedParty, shippingAddress, billingAddress, selectedPartyAddress]);

  return (
    <div className="mx-auto w-full max-w-[min(100rem,calc(100vw-2rem))] space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Link
              href="/sales/orders"
              className="hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              Orders
            </Link>
            <span>/</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Create Order
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Create Order
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Create and save a new purchase or sales draft order with negotiated pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/sales/orders"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5 transition"
          >
            Back to Orders
          </Link>
        </div>
      </div>

      {/* Step Tabs Header */}
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

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Step 1: Order Details & Line Items */}
        {step === 1 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Left Column */}
            <div className="min-w-0 space-y-6">
              {/* Party & Dates Section */}
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
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Select Party <span className="text-rose-500">*</span>
                    </label>
                    <PartyAutocomplete
                      parties={parties}
                      selectedId={partyId}
                      onChange={onPartyChange}
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
                        <th className="pb-2 font-semibold w-28">Price (₹)</th>
                        <th className="pb-2 font-semibold w-20">Disc %</th>
                        <th className="pb-2 font-semibold w-20">GST %</th>
                        <th className="pb-2 font-semibold w-28 text-right">Total (₹)</th>
                        <th className="pb-2 font-semibold w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {lines.map((line, idx) => {
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
                                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-white/10 dark:bg-slate-950 dark:text-slate-50"
                              />
                              {line.productId && (
                                <div className="mt-1">
                                  <input
                                    type="text"
                                    placeholder="Item remarks (optional)..."
                                    value={line.remarks}
                                    onChange={(e) => updateLine(line.key, { remarks: e.target.value })}
                                    className="w-full rounded border border-slate-200/80 bg-white/50 px-2 py-0.5 text-2xs text-slate-700 placeholder:text-slate-400 focus:bg-white dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
                                  />
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

                            <td className="py-2.5 pr-2 align-top">
                              <input
                                type="number"
                                step="any"
                                min={0}
                                value={line.unit_price}
                                onChange={(e) =>
                                  updateLine(line.key, {
                                    unit_price: Math.max(0, Number(e.target.value) || 0),
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
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
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
              {/* Sales Representative Card */}
              <section className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-slate-900">
                <header className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <User className="h-4 w-4 text-blue-500" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      Sales Representative
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Order creator & assigned representative.
                    </p>
                  </div>
                </header>

                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 border border-slate-100 dark:border-white/5">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {String(user?.name || user?.username || "You")}
                  </div>
                  {user?.email && (
                    <div className="text-2xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {String(user.email)}
                    </div>
                  )}
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
                    disabled={isLoading}
                    className="w-full py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition cursor-pointer"
                  >
                    {isLoading ? "Saving draft..." : "Or save draft now without Performa"}
                  </button>
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
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{String(user?.name || user?.username || "—")}</span>
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
                disabled={isLoading}
                className="font-semibold shadow-md shadow-primary/25 min-w-[160px] cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin text-primary-foreground" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving draft order...
                  </>
                ) : (
                  "Save draft order"
                )}
              </Button>
            </div>
          </div>
        )}
      </form>

      <PreviousPartyItemsModal
        open={previousItemsModalOpen}
        onClose={() => setPreviousItemsModalOpen(false)}
        partyId={partyId}
        partyName={selectedPartyName}
        onLoad={loadPreviousItems}
      />
    </div>
  );
}
