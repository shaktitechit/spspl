"use client";

import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { useCallback, useMemo, useState, useEffect } from "react";
import {
  mutationRejectedMessage,
  mutationSuccessCopy,
} from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import {
  useListPartiesQuery,
  useListProductsQuery,
  usePatchOrderMutation,
  useGetOrderPerformaQuery,
  useUpdateOrderPerformaMutation,
  useCreateAttachmentMutation,
  useCheckPartyLineRatesQuery,
} from "@/store/api";
import {
  rateLookupKey,
  resolveLineUnitPrice,
} from "@/components/portal/shared/orders/lib/orderLineRateDisplay";
import type { CheckOrderRatesItem } from "@/store/api/slices/partyOrderProductsRateApi";
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
import { ArrowLeft, ArrowRight, FileText, Lock } from "lucide-react";
import { usePortalSettings } from "@/hooks/usePortalSettings";

type EditOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  detail: Record<string, unknown> | null;
  user: { _id?: unknown; id?: unknown } | null | undefined;
  refetchOrder: () => void;
  /** When true, only line items are shown and patched (admin/finance amend flow). */
  itemsOnly?: boolean;
  /** Order workflow status — used for price-map eligibility in items-only mode. */
  orderStatus?: string;
  title?: string;
  description?: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-350";
const btnSecondaryClass =
  "rounded-lg border border-slate-200/95 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5 cursor-pointer";

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

function getPriceForRateType(p: Record<string, unknown> | undefined, rateType: string): number {
  if (!p) return 0;
  if (rateType === "SR") return Number(p.base_price ?? 0);
  if (rateType === "SRA") return Number(p.minimum_sale_rate ?? p.base_price ?? 0);
  if (rateType === "CR") return Number(p.mrp ?? p.base_price ?? 0);
  return Number(p.base_price ?? 0); // Fallback
}

function isLikelyObjectId(s: string): boolean {
  return /^[a-f0-9]{24}$/i.test(s);
}

function linesFromDetail(raw: unknown): LineRow[] {
  const items = Array.isArray(raw) ? raw : [];
  if (items.length === 0) return [newLine()];
  return items.map((item, idx) => {
    const l = item as Record<string, unknown>;
    const prod = l.product;
    const productId =
      typeof prod === "string"
        ? prod
        : prod && typeof prod === "object" && (prod as { _id?: unknown })._id != null
          ? String((prod as { _id: unknown })._id)
          : "";
    const key =
      l._id != null
        ? String(l._id)
        : typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `line-${idx}-${Math.random().toString(36).slice(2)}`;
    return {
      key,
      productId,
      product_name: String(l.product_name ?? ""),
      sku: String(l.sku ?? ""),
      brand: String(l.brand ?? ""),
      manufacturer: String(l.manufacturer ?? ""),
      product_group: String(l.product_group ?? ""),
      product_subgroup: String(l.product_subgroup ?? ""),
      unit: String(l.unit ?? ""),
      quantity: Number(l.ordered_quantity ?? l.quantity ?? 1),
      free_qty: Number(l.free_quantity ?? l.free_qty ?? 0),
      unit_price: Number(l.unit_price ?? 0),
      discount_percent: Number(l.discount_percent ?? 0),
      discount_amount: Number(l.discount_amount ?? 0),
      gst_percent: Number(l.gst_percent ?? 18),
      applied_rate_type: String(l.applied_rate_type || "SR"),
      remarks: String(l.remarks ?? ""),
    };
  });
}

function partyIdFromDetail(detail: Record<string, unknown>): string {
  const p = detail.party;
  if (typeof p === "string") return p.trim();
  if (p && typeof p === "object" && "_id" in p)
    return String((p as { _id: unknown })._id ?? "");
  return "";
}

function toDateInputValue(v: unknown): string {
  if (v == null || v === "") return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function buildPatchItems(lines: LineRow[]): Record<string, unknown>[] {
  return lines
    .filter((l) => l.productId)
    .map((l) => {
      const o: Record<string, unknown> = {
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
      };
      if (isLikelyObjectId(l.key)) o._id = l.key;
      return o;
    });
}

function pickList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Record<string, unknown>[];
    if (Array.isArray(o.data)) return o.data as Record<string, unknown>[];
  }
  return [];
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

export default function EditOrderModal({
  isOpen,
  onClose,
  orderId,
  detail,
  user,
  refetchOrder,
  itemsOnly = false,
  orderStatus = "",
  title,
  description,
}: EditOrderModalProps) {
  const [partyId, setPartyId] = useState("");
  const [priority, setPriority] = useState("normal");
  const [expectedDate, setExpectedDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<LineRow[]>([]);
  const [step, setStep] = useState<1 | 2>(1);

  const {
    isPerformaEnabled,
    isCostSheetEnabled,
    isKycEnabled,
    isPOEnabled,
    isBuyBackEnabled,
    canSalesMapQuantity,
    canSalesMapVolume,
    canSalesMapPrice,
  } = usePortalSettings();

  const showPriceColumn = canSalesMapVolume || canSalesMapPrice;
  const canEditPrice = canSalesMapPrice;
  const showFinancialTotals = canSalesMapVolume;

  useEffect(() => {
    if (!isPerformaEnabled && step === 2) {
      setStep(1);
    }
  }, [isPerformaEnabled, step]);

  const [performaValues, setPerformaValues] = useState<PerformaFormValues>(INITIAL_PERFORMA_VALUES);
  const [modalFiles, setModalFiles] = useState<PerformaAttachmentFiles>({
    po_file: null,
    cost_sheet_file: null,
    aadhaar_file: null,
    pan_file: null,
    gst_file: null,
    kyc_files: [],
  });
  const [billingAddress, setBillingAddress] = useState<OrderAddressData>(emptyOrderAddress);
  const [shippingAddress, setShippingAddress] = useState<OrderAddressData>(emptyOrderAddress);
  const [saveShippingToParty, setSaveShippingToParty] = useState<boolean>(false);

  const { data: performaData } = useGetOrderPerformaQuery(orderId, {
    skip: !isOpen || !orderId || !isPerformaEnabled,
  });
  const [updateOrderPerforma] = useUpdateOrderPerformaMutation();
  const [createAttachment] = useCreateAttachmentMutation();

  const handleModalFileChange = useCallback(
    (field: keyof PerformaAttachmentFiles, file: File | File[] | null) => {
      setModalFiles((prev) => ({ ...prev, [field]: file }));
    },
    [],
  );

  // Initialize fields from order details when modal opens
  useEffect(() => {
    if (isOpen && detail) {
      setStep(1);
      setPartyId(partyIdFromDetail(detail));
      setPriority(typeof detail.priority === "string" ? detail.priority : "normal");
      setExpectedDate(toDateInputValue(detail.expected_delivery_date));
      setRemarks(typeof detail.remarks === "string" ? detail.remarks : "");
      setLines(linesFromDetail(detail.order_items));
      setModalFiles({
        po_file: null,
        cost_sheet_file: null,
        aadhaar_file: null,
        pan_file: null,
        gst_file: null,
        kyc_files: [],
      });

      const orderB = (detail.billing_address || {}) as any;
      const partyB = ((detail.party || detail.customer) as any)?.billing_address || {};
      const finalB = orderB.address_line_1 ? orderB : partyB;
      const parsedB: OrderAddressData = {
        label: finalB.label || "Billing Address",
        recipient_name: finalB.recipient_name || "",
        phone: finalB.phone || "",
        gst_no: finalB.gst_no || "",
        address_line_1: finalB.address_line_1 || "",
        address_line_2: finalB.address_line_2 || "",
        city: finalB.city || "",
        state: finalB.state || "",
        pincode: finalB.pincode || "",
        country: finalB.country || "India",
      };
      setBillingAddress(parsedB);

      const orderS = (detail.shipping_address || {}) as any;
      const partyS = ((detail.party || detail.customer) as any)?.shipping_address || {};
      const finalS = orderS.address_line_1 ? orderS : (partyS.address_line_1 ? partyS : finalB);
      setShippingAddress({
        label: finalS.label || "Shipping Destination",
        recipient_name: finalS.recipient_name || "",
        phone: finalS.phone || "",
        gst_no: finalS.gst_no || "",
        address_line_1: finalS.address_line_1 || "",
        address_line_2: finalS.address_line_2 || "",
        city: finalS.city || "",
        state: finalS.state || "",
        pincode: finalS.pincode || "",
        country: finalS.country || "India",
      });
    }
  }, [isOpen, detail]);

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
    if (isOpen && performaData) {
      setPerformaValues({
        sales_person: performaData.sales_person || "",
        freight_charges: performaData.freight_charges || "",
        orc: performaData.orc || "",
        transport: performaData.transport || "",
        dispatch_date: performaData.dispatch_date ? performaData.dispatch_date.slice(0, 10) : "",
        ship_to_address: performaData.ship_to_address || "",
        payment_terms: performaData.payment_terms || "",
        customer_type: performaData.customer_type || "",
        installation_required: performaData.installation_required || "",
        gst_concession: performaData.gst_concession || "",
        margin_sheet_attached: performaData.margin_sheet_attached || "",
        kyc_status: performaData.kyc_status || "",
        remarks: performaData.remarks || "",
      });
    }
  }, [isOpen, performaData]);

  const partiesQ = useListPartiesQuery({ status: "active" }, { skip: !isOpen });
  const productsQ = useListProductsQuery({}, { skip: !isOpen });

  const [patchOrder, { isLoading: isPatching }] = usePatchOrderMutation();

  const parties = useMemo(() => pickList(partiesQ.data), [partiesQ.data]);
  const products = useMemo(() => pickList(productsQ.data), [productsQ.data]);

  const selectedParty = useMemo(() => {
    return parties.find((p: Record<string, unknown>) => String(p._id ?? p.id ?? "") === String(partyId));
  }, [parties, partyId]);

  const selectedPartyAddress = useMemo(() => {
    if (!selectedParty) return "";
    const p = selectedParty as Record<string, unknown>;
    const addr = (p.address || p.billing_address || "") as any;
    if (typeof addr === "string") return addr;
    if (typeof addr === "object" && addr !== null) {
      return [addr.address_line_1, addr.address_line_2, addr.city, addr.state, addr.pincode]
        .filter(Boolean)
        .join(", ");
    }
    return "";
  }, [selectedParty]);

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

    return { subtotal, discount, taxable, gst, total };
  }, [lines]);

  const lineRateCheckInput = useMemo(() => {
    if (!partyId) return null;
    const items = lines
      .filter((l) => l.productId)
      .map((l) => ({
        product: l.productId,
        applied_rate_type: l.applied_rate_type || "SR",
        product_name: l.product_name,
        sku: l.sku,
        unit_price: l.unit_price,
      }));
    if (!items.length) return null;
    return { party: partyId, items };
  }, [partyId, lines]);

  const rateCheckQ = useCheckPartyLineRatesQuery(lineRateCheckInput!, {
    skip: !isOpen || !lineRateCheckInput,
  });

  const rateItemByLine = useMemo(() => {
    const map = new Map<string, CheckOrderRatesItem>();
    for (const item of rateCheckQ.data?.items ?? []) {
      map.set(rateLookupKey(item.product, item.applied_rate_type), item);
    }
    return map;
  }, [rateCheckQ.data]);

  const resolvePriceForLine = useCallback(
    (
      productId: string,
      rateType: string,
      catalogProduct: Record<string, unknown> | undefined
    ) => {
      const rateItem = productId
        ? rateItemByLine.get(rateLookupKey(productId, rateType))
        : undefined;
      return resolveLineUnitPrice(rateItem, catalogProduct as any, rateType);
    },
    [rateItemByLine]
  );

  useEffect(() => {
    if (!rateCheckQ.data?.items?.length) return;
    setLines((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.productId || row.applied_rate_type === "MANUAL") return row;
        const rateItem = rateItemByLine.get(
          rateLookupKey(row.productId, row.applied_rate_type)
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

  const onRateTypeChange = useCallback(
    (key: string, rateType: string) => {
      setLines((prev) =>
        prev.map((r) => {
          if (r.key !== key) return r;
          const p = products.find(
            (x) =>
              String((x as any)._id ?? (x as any).id ?? "") ===
              String(r.productId)
          );
          const nextPrice = resolvePriceForLine(r.productId, rateType, p);
          return {
            ...r,
            applied_rate_type: rateType,
            ...(rateType !== "MANUAL" && nextPrice > 0
              ? { unit_price: nextPrice }
              : {}),
          };
        })
      );
    },
    [products, resolvePriceForLine]
  );

  const onProductRowChange = useCallback(
    (key: string, productId: string) => {
      const p = products.find(
        (x) =>
          String(
            (x as { _id?: unknown })._id ?? (x as { id?: unknown }).id ?? ""
          ) === String(productId)
      ) as Record<string, unknown> | undefined;
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
          const currentRateType = row.applied_rate_type || "SR";
          const resolvedPrice = resolvePriceForLine(pid, currentRateType, p);
          const defaultPrice =
            resolvedPrice > 0
              ? resolvedPrice
              : Number(p.standard_rate ?? p.price ?? p.unit_price ?? p.mrp ?? 0);
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
        })
      );
    },
    [products, resolvePriceForLine]
  );

  const validateForm = useCallback((): boolean => {
    if (!itemsOnly && !partyId) {
      toast.error("Select a party.");
      return false;
    }
    const prepared = buildPatchItems(lines);
    if (!prepared.length) {
      toast.error("Add at least one line with a product.");
      return false;
    }
    const badQty = prepared.some(
      (l) => !Number.isFinite(Number(l.ordered_quantity)) || Number(l.ordered_quantity) < 1
    );
    if (badQty) {
      toast.error("Each line needs quantity ≥ 1.");
      return false;
    }
    if (itemsOnly) {
      const badDisc = lines.some(
        (l) =>
          l.productId &&
          (!Number.isFinite(l.discount_percent) ||
            l.discount_percent < 0 ||
            l.discount_percent > 100),
      );
      if (badDisc) {
        toast.error("Discount % must be between 0 and 100.");
        return false;
      }
    }
    return true;
  }, [itemsOnly, partyId, lines]);

  const handleSave = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!orderId) return;
      if (!validateForm()) return;
      const patch = itemsOnly
        ? { order_items: buildPatchItems(lines), performa: performaValues }
        : {
            party: partyId,
            order_items: buildPatchItems(lines),
            discount_amount: 0,
            priority,
            remarks: remarks.trim() || "",
            ...(expectedDate
              ? { expected_delivery_date: expectedDate }
              : { expected_delivery_date: null }),
            assigned_sales_user:
              user?._id || user?.id ? String(user?._id || user?.id) : undefined,
            billing_address: billingAddress.address_line_1 ? billingAddress : undefined,
            shipping_address: shippingAddress.address_line_1 ? shippingAddress : undefined,
            save_shipping_to_party: saveShippingToParty,
            performa: performaValues,
          };
      try {
        await patchOrder({ id: orderId, patch }).unwrap();
        if (isPerformaEnabled && !performaData?.is_locked) {
          await updateOrderPerforma({ orderId, data: performaValues }).unwrap().catch(() => {});
        }

        if (isPOEnabled && modalFiles.po_file) {
          const fd = new FormData();
          fd.append("file", modalFiles.po_file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "po");
          fd.append("remarks", "Purchase Order (PO)");
          await createAttachment(fd).unwrap().catch((err) => {
            console.warn("Failed to upload PO attachment:", err);
          });
        }

        if (isCostSheetEnabled && modalFiles.cost_sheet_file) {
          const fd = new FormData();
          fd.append("file", modalFiles.cost_sheet_file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "cost_sheet");
          fd.append("remarks", "Cost Sheet / Margin Sheet");
          await createAttachment(fd).unwrap().catch((err) => {
            console.warn("Failed to upload Cost Sheet attachment:", err);
          });
        }

        if (isKycEnabled && modalFiles.aadhaar_file) {
          const fd = new FormData();
          fd.append("file", modalFiles.aadhaar_file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "kyc_aadhaar");
          fd.append("remarks", "Customer Aadhaar Card");
          await createAttachment(fd).unwrap().catch((err) => {
            console.warn("Failed to upload Aadhaar attachment:", err);
          });

          if (partyId) {
            const pfd = new FormData();
            pfd.append("file", modalFiles.aadhaar_file);
            pfd.append("entity_type", "party");
            pfd.append("entity_id", partyId);
            pfd.append("category", "kyc_aadhaar");
            pfd.append("remarks", "Customer Aadhaar Card from Order");
            await createAttachment(pfd).unwrap().catch(() => {});
          }
        }

        if (isKycEnabled && modalFiles.pan_file) {
          const fd = new FormData();
          fd.append("file", modalFiles.pan_file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "kyc_pan");
          fd.append("remarks", "Customer PAN Card");
          await createAttachment(fd).unwrap().catch((err) => {
            console.warn("Failed to upload PAN attachment:", err);
          });

          if (partyId) {
            const pfd = new FormData();
            pfd.append("file", modalFiles.pan_file);
            pfd.append("entity_type", "party");
            pfd.append("entity_id", partyId);
            pfd.append("category", "kyc_pan");
            pfd.append("remarks", "Customer PAN Card from Order");
            await createAttachment(pfd).unwrap().catch(() => {});
          }
        }

        if (isKycEnabled && modalFiles.gst_file) {
          const fd = new FormData();
          fd.append("file", modalFiles.gst_file);
          fd.append("entity_type", "order");
          fd.append("entity_id", orderId);
          fd.append("category", "kyc_gst");
          fd.append("remarks", "Customer GST Certificate");
          await createAttachment(fd).unwrap().catch((err) => {
            console.warn("Failed to upload GST attachment:", err);
          });

          if (partyId) {
            const pfd = new FormData();
            pfd.append("file", modalFiles.gst_file);
            pfd.append("entity_type", "party");
            pfd.append("entity_id", partyId);
            pfd.append("category", "kyc_gst");
            pfd.append("remarks", "Customer GST Certificate from Order");
            await createAttachment(pfd).unwrap().catch(() => {});
          }
        }

        if (isKycEnabled && modalFiles.kyc_files && modalFiles.kyc_files.length > 0) {
          for (const file of modalFiles.kyc_files) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("entity_type", "order");
            fd.append("entity_id", orderId);
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
        toast.success(mutationSuccessCopy("patchOrder"));
        refetchOrder();
        onClose();
      } catch (rejected) {
        toast.error(mutationRejectedMessage(rejected));
      }
    },
    [
      partyId,
      expectedDate,
      lines,
      orderId,
      patchOrder,
      priority,
      refetchOrder,
      remarks,
      validateForm,
      itemsOnly,
      user,
      onClose,
      performaValues,
      performaData?.is_locked,
      updateOrderPerforma,
      modalFiles,
      createAttachment,
    ]
  );

  const modalTitle = title ?? (itemsOnly ? "Edit Order Items" : "Edit Draft Order");
  const modalDescription =
    description ??
    (itemsOnly
      ? "Amend line items, unit prices, and map negotiated party rates before approval."
      : "Update draft items, delivery requirements, priorities, and remarks.");

  if (!isOpen) return null;

  return (
    <LargeModalPortal>
    <div
      className={
        itemsOnly
          ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-3 backdrop-blur-[2px] sm:p-4 md:p-5"
          : "fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      }
    >
      <div
        className={
          itemsOnly
            ? "flex h-[calc(100vh-150px)] max-h-[calc(100vh-150px)] w-full max-w-[min(100%,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:p-5 md:h-[calc(100vh-160px)] md:max-h-[calc(100vh-160px)] lg:max-w-[calc(100vw-17rem)]"
            : "flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl border border-slate-200/90 bg-white p-5 shadow-xl transition-all dark:border-white/10 dark:bg-slate-900"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {modalTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {modalDescription}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 p-1 cursor-pointer"
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stepper Tabs */}
        {isPerformaEnabled && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1 dark:border-white/10 dark:bg-slate-900/60">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                step === 1
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-blue-400 dark:ring-white/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span
                className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-2xs font-bold ${
                  step === 1
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                1
              </span>
              <span>Step 1: Order Items & Totals</span>
            </button>

            <span className="text-slate-300 dark:text-slate-700">/</span>

            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                step === 2
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-blue-400 dark:ring-white/10"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <span
                className={`flex h-4.5 w-4.5 items-center justify-center rounded-full text-2xs font-bold ${
                  step === 2
                    ? "bg-blue-600 text-white"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                2
              </span>
              <span>Step 2: Performa Invoice</span>
              {performaData?.is_locked && (
                <Lock className="h-3 w-3 text-amber-500 ml-1" />
              )}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 space-y-5">
          {step === 1 && (
          <form onSubmit={handleSave} className="space-y-5">
            {!itemsOnly ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="modal-party" className={labelClass}>
                    Party
                  </label>
                  <select
                    id="modal-party"
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className={inputClass}
                    required
                  >
                    <option value="">— Select —</option>
                    {parties.map((c) => {
                      const id = String(
                        (c as { _id?: unknown })._id ??
                          (c as { id?: unknown }).id ??
                          ""
                      );
                      const name =
                        typeof (c as { party_name?: string }).party_name ===
                        "string"
                          ? (c as { party_name: string }).party_name
                          : id || "Party";
                      const typ =
                        typeof (c as { party_type?: string }).party_type ===
                          "string" && (c as { party_type: string }).party_type
                          ? ` (${(c as { party_type: string }).party_type})`
                          : "";
                      return (
                        <option key={id || name} value={id}>
                          {name}
                          {typ}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="modal-priority" className={labelClass}>
                    Priority
                  </label>
                  <select
                    id="modal-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className={inputClass}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="modal-eta" className={labelClass}>
                    Expected delivery
                  </label>
                  <input
                    id="modal-eta"
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label htmlFor="modal-remarks" className={labelClass}>
                    Remarks
                  </label>
                  <textarea
                    id="modal-remarks"
                    rows={2}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : null}

            {!itemsOnly && Boolean(detail?.party || detail?.customer) && (
              <div className="mb-4">
                <OrderAddressSelector
                  party={(detail?.party || detail?.customer) as any}
                  billingAddress={billingAddress}
                  shippingAddress={shippingAddress}
                  onBillingAddressChange={setBillingAddress}
                  onShippingAddressChange={setShippingAddress}
                  saveShippingToParty={saveShippingToParty}
                  onSaveShippingToPartyChange={setSaveShippingToParty}
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Line items
                </h3>
                <button
                  type="button"
                  className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 cursor-pointer"
                  onClick={() => setLines((prev) => [...prev, newLine()])}
                >
                  + Add line
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((row) => {
                  const productSpan = showPriceColumn
                    ? showFinancialTotals
                      ? "sm:col-span-3"
                      : "sm:col-span-5"
                    : showFinancialTotals
                    ? "sm:col-span-5"
                    : "sm:col-span-7";

                  return (
                    <div
                      key={row.key}
                      className="space-y-3 rounded-lg border border-slate-200/90 p-3 dark:border-white/10 bg-slate-50/[0.3] dark:bg-slate-900/40"
                    >
                      <div className="grid gap-3 sm:grid-cols-12 sm:items-end">
                        <div className={`space-y-1.5 ${productSpan}`}>
                          <span className={labelClass}>Product</span>
                          <select
                            value={row.productId}
                            onChange={(e) =>
                              onProductRowChange(row.key, e.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="">— Select —</option>
                            {products.map((p) => {
                              const id = String(
                                (p as { _id?: unknown })._id ??
                                  (p as { id?: unknown }).id ??
                                  ""
                              );
                              const plab = `${(p as { product_name?: string }).product_name ?? id}${(p as { sku?: string }).sku ? ` · ${(p as { sku: string }).sku}` : ""}`;
                              return (
                                <option key={id || plab} value={id}>
                                  {plab}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                          <span className={labelClass}>Rate Type</span>
                          <select
                            value={row.applied_rate_type || "SR"}
                            onChange={(e) =>
                              onRateTypeChange(row.key, e.target.value)
                            }
                            className={inputClass}
                          >
                            <option value="SR">SR</option>
                            <option value="SRA">SRA</option>
                            <option value="CR">CR</option>
                            <option value="MANUAL">MANUAL</option>
                          </select>
                        </div>

                        <div className="space-y-1.5 sm:col-span-1">
                          <span className={labelClass}>
                            Qty {!canSalesMapQuantity && <span className="text-[10px] text-amber-500 font-normal">(locked)</span>}
                          </span>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            disabled={!canSalesMapQuantity}
                            title={!canSalesMapQuantity ? "Quantity editing is locked for Sales by Super Admin" : undefined}
                            value={row.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? {
                                        ...l,
                                        quantity: Number(e.target.value) || 0,
                                      }
                                    : l
                                )
                              )
                            }
                            className={`${inputClass} ${
                              !canSalesMapQuantity ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""
                            }`}
                          />
                        </div>

                        <div className="space-y-1.5 sm:col-span-1">
                          <span className={labelClass}>Free</span>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={!canSalesMapQuantity}
                            value={row.free_qty}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? {
                                        ...l,
                                        free_qty: Number(e.target.value) || 0,
                                      }
                                    : l
                                )
                              )
                            }
                            className={`${inputClass} ${
                              !canSalesMapQuantity ? "bg-slate-100 cursor-not-allowed text-slate-500 dark:bg-slate-800 dark:text-slate-400" : ""
                            }`}
                          />
                        </div>
                        {showPriceColumn && (
                          <div className="space-y-1.5 sm:col-span-2">
                            <span className={labelClass}>
                              Price (₹) {!canEditPrice && <span className="text-[10px] text-slate-400 font-normal">(read-only)</span>}
                            </span>
                            {canEditPrice ? (
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={row.unit_price}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.key === row.key
                                        ? {
                                            ...l,
                                            unit_price: Number(e.target.value) || 0,
                                          }
                                        : l
                                    )
                                  )
                                }
                                className={inputClass}
                              />
                            ) : (
                              <div className="flex min-h-[38px] items-center rounded-lg border border-slate-200/80 bg-slate-100/80 px-3 text-sm font-semibold tabular-nums text-slate-700 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300">
                                ₹{formatMoney(row.unit_price)}
                              </div>
                            )}
                          </div>
                        )}

                        {showFinancialTotals && (
                          <div className="space-y-1.5 sm:col-span-1">
                            <span className={labelClass}>Disc %</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={row.discount_percent}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === row.key
                                      ? {
                                          ...l,
                                          discount_percent:
                                            Number(e.target.value) || 0,
                                        }
                                      : l
                                  )
                                )
                              }
                              className={inputClass}
                            />
                          </div>
                        )}

                        {showFinancialTotals && (
                          <div className="space-y-1.5 sm:col-span-1">
                            <span className={labelClass}>GST %</span>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={row.gst_percent}
                              onChange={(e) =>
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === row.key
                                      ? {
                                          ...l,
                                          gst_percent:
                                            Number(e.target.value) || 0,
                                        }
                                      : l
                                  )
                                )
                              }
                              className={inputClass}
                            />
                          </div>
                        )}
                        <div className="flex sm:col-span-1 sm:justify-end">
                          <button
                            type="button"
                            className={`${btnSecondaryClass} text-rose-700 dark:text-rose-455 py-1.5 w-full text-center hover:bg-rose-50 dark:hover:bg-rose-950/20`}
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter((l) => l.key !== row.key)
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 border-t border-slate-200/80 pt-3 dark:border-white/10 sm:grid-cols-12 sm:items-end">
                        <div
                          className={`space-y-1.5 ${
                            showFinancialTotals
                              ? "sm:col-span-9"
                              : "sm:col-span-12"
                          }`}
                        >
                          <span className={labelClass}>Line remarks</span>
                          <input
                            type="text"
                            value={row.remarks}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, remarks: e.target.value }
                                    : l
                                )
                              )
                            }
                            className={inputClass}
                            placeholder="Optional notes for this line"
                          />
                        </div>

                        {showFinancialTotals && (
                          <div className="space-y-1.5 sm:col-span-3">
                            <span className={labelClass}>Line total</span>
                            <div className="flex min-h-[38px] items-center rounded-lg border border-slate-200/80 bg-white px-3 text-sm font-semibold tabular-nums text-slate-900 dark:border-white/10 dark:bg-slate-950 dark:text-slate-50">
                              ₹{formatMoney(lineTotal(row))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order Financial Summary */}
              {showFinancialTotals && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/20 p-4 dark:border-blue-900/30 dark:bg-blue-950/10">
                  <div className="grid gap-3 sm:grid-cols-4 font-sans text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Gross Subtotal</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        ₹{formatMoney(liveSummary.subtotal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Total Discount</span>
                      <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        -₹{formatMoney(liveSummary.discount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">Estimated GST</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                        ₹{formatMoney(liveSummary.gst)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block font-semibold text-blue-600 dark:text-blue-400">
                        Grand Total
                      </span>
                      <span className="text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                        ₹{formatMoney(liveSummary.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {performaData?.is_locked && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-500/20">
                  <Lock className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{performaData.lock_reason || "Performa Invoice is locked because dispatch has already been created/submitted."}</span>
                </div>
              )}
              <PerformaInvoiceFields
                values={performaValues}
                onChange={(f, v) => setPerformaValues((prev) => ({ ...prev, [f]: v }))}
                readOnly={Boolean(performaData?.is_locked)}
                billingAddress={selectedPartyAddress}
                attachmentFiles={modalFiles}
                onAttachmentFileChange={handleModalFileChange}
                existingDocuments={{
                  po_document: performaData?.po_document,
                  cost_sheet_document: performaData?.cost_sheet_document,
                  aadhaar_document: performaData?.aadhaar_document,
                  pan_document: performaData?.pan_document,
                  gst_document: performaData?.gst_document,
                  kyc_documents: performaData?.kyc_documents,
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/5">
          <div>
            {step === 1 ? (
              isPerformaEnabled ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                >
                  <span>Edit Performa Invoice</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : null
            ) : (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Order Items</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPatching}
              className={btnSecondaryClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isPatching}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400 cursor-pointer active:scale-[0.98]"
            >
              {isPatching ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </LargeModalPortal>
  );
}
