/**
 * @fileoverview 2-Step Modal to convert a Quotation directly into a Customer (Party) and submitted Order.
 * Step 1: Customer Verification / Linking (prefilled from quotation customer details)
 * Step 2: Order Generation with line items, rate types, discounts, and order notes
 * @module components/portal/shared/quotations/ConvertQuotationModal
 */
"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Users,
  ShoppingCart,
  X,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  FileText,
  SendHorizontal,
  DollarSign,
  Truck,
  Building2,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/LargeModalPortal";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useConvertQuotationMutation,
  useListPartiesQuery,
  useListProductsQuery,
  useListUsersQuery,
  type LeadQuotationRecord,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import {
  sanitizePartyContacts,
  type PartyContact,
} from "@/lib/partyContacts";
import { formatCurrencyINR, isSalesDepartmentUser } from "./quotationUtils";

type Props = {
  quotation: LeadQuotationRecord;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type RateType = "SR" | "SRA" | "CR";

type LineRow = {
  key: string;
  productId: string;
  product_name: string;
  sku: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_percent: number;
  applied_rate_type: RateType;
  remarks: string;
};

type ProductLike = Record<string, unknown>;

function newLine(overrides?: Partial<LineRow>): LineRow {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `line-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: "",
    product_name: "",
    sku: "",
    unit: "pcs",
    quantity: 1,
    unit_price: 0,
    discount_percent: 0,
    discount_amount: 0,
    gst_percent: 18,
    applied_rate_type: "SR",
    remarks: "",
    ...overrides,
  };
}

function resolveProductId(product: unknown): string {
  if (!product) return "";
  if (typeof product === "string") return product;
  if (typeof product === "object") {
    const obj = product as { _id?: string; id?: string };
    return String(obj._id || obj.id || "");
  }
  return "";
}

function catalogUnitPrice(prod: ProductLike | undefined | null, rateType: RateType): number {
  if (!prod) return 0;
  if (rateType === "SRA") return Number(prod.minimum_sale_rate || prod.base_price || 0) || 0;
  if (rateType === "CR") return Number(prod.mrp || prod.base_price || 0) || 0;
  return Number(prod.base_price || 0) || 0;
}

function catalogGstPercent(prod: ProductLike | undefined | null): number {
  if (!prod) return 18;
  const g = Number(prod.gst_percent ?? prod.default_gst_rate ?? prod.gst_rate ?? 18);
  return Number.isFinite(g) && g >= 0 ? g : 18;
}

function lineGross(row: LineRow): number {
  return Math.max(0, Number(row.quantity || 0) * Number(row.unit_price || 0));
}

function lineDiscount(row: LineRow): number {
  const gross = lineGross(row);
  const discPct = Number(row.discount_percent || 0);
  const discAmt = Number(row.discount_amount || 0);
  if (discPct > 0) {
    return Math.min(gross, Math.round(((gross * discPct) / 100) * 100) / 100);
  }
  if (discAmt > 0) {
    return Math.min(gross, Math.round(discAmt * 100) / 100);
  }
  return 0;
}

function lineTaxable(row: LineRow): number {
  return Math.max(0, Math.round((lineGross(row) - lineDiscount(row)) * 100) / 100);
}

function lineGst(row: LineRow): number {
  return Math.round(((lineTaxable(row) * Number(row.gst_percent || 0)) / 100) * 100) / 100;
}

function lineTotal(row: LineRow): number {
  return Math.round((lineTaxable(row) + lineGst(row)) * 100) / 100;
}

function linesFromQuotation(q: LeadQuotationRecord): LineRow[] {
  if (!Array.isArray(q.items) || q.items.length === 0) return [newLine()];
  return q.items.map((it) => {
    const qty = Math.max(1, Number(it.quantity || 1));
    const rate = Number(it.rate || 0) || 0;
    const gross = qty * rate;
    let discPct = Number(it.discount_percent || 0);
    let discAmt = Number(it.discount_amount || 0);
    if (discPct > 0) {
      discAmt = Math.round(((gross * discPct) / 100) * 100) / 100;
    } else if (discAmt > 0 && gross > 0) {
      discPct = Math.round(((discAmt / gross) * 100) * 100) / 100;
    }
    return newLine({
      productId: resolveProductId(it.product),
      product_name: it.product_name || "",
      unit: it.unit || "pcs",
      quantity: qty,
      unit_price: rate,
      discount_percent: discPct,
      discount_amount: discAmt,
      gst_percent: Number(it.gst_rate ?? 18) || 0,
      applied_rate_type: "SR",
      remarks: it.description || "",
    });
  });
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-800 dark:text-white";
const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-300";

export function ConvertQuotationModal({
  quotation,
  open,
  onClose,
  onSuccess,
}: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // -------------------------------------------------------------
  // Step 1: Customer & Party Linking State
  // -------------------------------------------------------------
  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    typeof quotation.party_id === "object" && quotation.party_id !== null
      ? (quotation.party_id as any)._id || ""
      : typeof quotation.party_id === "string"
      ? quotation.party_id
      : ""
  );

  const pDetails = quotation.proforma_details || {};

  // New customer fields
  const [partyName, setPartyName] = useState<string>(quotation.customer_name || "");
  const [gstNo, setGstNo] = useState<string>(quotation.gstin || "");
  const [drugLicenseNo, setDrugLicenseNo] = useState<string>("");
  const [paymentTerms, setPaymentTerms] = useState<string>(
    pDetails.payment_terms || quotation.payment_terms || "Net 30"
  );

  const [contacts, setContacts] = useState<PartyContact[]>(() => [
    {
      name: quotation.kind_attn || quotation.customer_name || "Primary Contact",
      phone: quotation.phone || quotation.cell || "",
      email: quotation.email || "",
      department: "",
      alternate_phone: quotation.cell || "",
    },
  ]);

  // Addresses
  const [billingAddress, setBillingAddress] = useState({
    address_line_1: quotation.address?.address_line_1 || "",
    address_line_2: "",
    city: quotation.address?.city || "",
    state: quotation.address?.state || "",
    pincode: quotation.address?.pincode || "",
    country: quotation.address?.country || "India",
  });

  const hasCustomShipAddress =
    Boolean(pDetails.ship_to_address) &&
    pDetails.ship_to_address?.toLowerCase() !== "same as billing" &&
    pDetails.ship_to_address?.toLowerCase() !== "same";

  const [sameAsBilling, setSameAsBilling] = useState(!hasCustomShipAddress);
  const [shippingAddress, setShippingAddress] = useState({
    address_line_1: hasCustomShipAddress ? pDetails.ship_to_address || "" : "",
    address_line_2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });

  // -------------------------------------------------------------
  // Step 2: Order State (Prefilled from Quotation items)
  // -------------------------------------------------------------
  const [orderItems, setOrderItems] = useState<LineRow[]>(() => linesFromQuotation(quotation));

  const [orderDate, setOrderDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [deliveryDate, setDeliveryDate] = useState<string>(
    pDetails.dispatch_date
      ? new Date(pDetails.dispatch_date).toISOString().split("T")[0]
      : quotation.valid_until
      ? new Date(quotation.valid_until).toISOString().split("T")[0]
      : ""
  );
  const [customerPoNumber, setCustomerPoNumber] = useState<string>(
    pDetails.customer_po_number || quotation.customer_po_number || ""
  );
  const [customerPoDate, setCustomerPoDate] = useState<string>(
    pDetails.customer_po_date
      ? new Date(pDetails.customer_po_date).toISOString().split("T")[0]
      : quotation.customer_po_date
      ? new Date(quotation.customer_po_date).toISOString().split("T")[0]
      : ""
  );
  const [advanceAmount, setAdvanceAmount] = useState<number>(
    quotation.advance_amount || 0
  );
  const [paymentMode, setPaymentMode] = useState<string>(
    quotation.payment_mode || "NEFT / RTGS"
  );
  const [paymentReference, setPaymentReference] = useState<string>(
    quotation.payment_reference || ""
  );
  const [orderRemarks, setOrderRemarks] = useState<string>(
    pDetails.remarks || quotation.subject || (pDetails.proforma_no ? `Proforma #${pDetails.proforma_no}` : `Converted from Quotation #${quotation.quotation_no}`)
  );
  const [assignedSalesUser, setAssignedSalesUser] = useState<string>("");

  // -------------------------------------------------------------
  // API Queries & Mutations
  // -------------------------------------------------------------
  const { data: partiesData, isLoading: loadingParties } = useListPartiesQuery({
    limit: "150",
  });
  const { data: productsData } = useListProductsQuery({
    limit: "200",
  });
  const { data: usersData } = useListUsersQuery(undefined, { skip: !open });
  const [convertQuotation, { isLoading }] = useConvertQuotationMutation();

  const usersList = useMemo(() => {
    return (
      Array.isArray(usersData)
        ? usersData
        : (usersData as { items?: unknown[] })?.items || (usersData as { data?: unknown[] })?.data || []
    ) as Array<{ _id: string; name?: string; email?: string; phone?: string; department?: string; is_active?: boolean }>;
  }, [usersData]);

  const salesUsers = useMemo(() => {
    return usersList.filter((u: any) => isSalesDepartmentUser(u));
  }, [usersList]);

  const partiesList = useMemo(() => {
    if (Array.isArray(partiesData)) return partiesData;
    if (partiesData && typeof partiesData === "object" && "items" in partiesData) {
      return (partiesData as { items: Array<Record<string, unknown>> }).items || [];
    }
    return [];
  }, [partiesData]);

  const productsList = useMemo(() => {
    if (Array.isArray(productsData)) return productsData;
    if (productsData && typeof productsData === "object" && "items" in productsData) {
      return (productsData as { items: Array<Record<string, unknown>> }).items || [];
    }
    return [];
  }, [productsData]);

  const selectedExistingParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return partiesList.find((p) => String(p._id || p.id) === String(selectedPartyId)) || null;
  }, [partiesList, selectedPartyId]);

  const handlePartyChange = (partyId: string) => {
    setSelectedPartyId(partyId);
    if (!partyId) {
      // Reset to quotation's prefilled customer details
      setPartyName(quotation.customer_name || "");
      setGstNo(quotation.gstin || "");
      setDrugLicenseNo("");
      setPaymentTerms(pDetails.payment_terms || quotation.payment_terms || "Net 30");
      setContacts([
        {
          name: quotation.kind_attn || quotation.customer_name || "Primary Contact",
          phone: quotation.phone || quotation.cell || "",
          email: quotation.email || "",
          department: "",
          alternate_phone: quotation.cell || "",
        },
      ]);
      setBillingAddress({
        address_line_1: quotation.address?.address_line_1 || "",
        address_line_2: "",
        city: quotation.address?.city || "",
        state: quotation.address?.state || "",
        pincode: quotation.address?.pincode || "",
        country: quotation.address?.country || "India",
      });
      setSameAsBilling(!hasCustomShipAddress);
      setShippingAddress({
        address_line_1: hasCustomShipAddress ? pDetails.ship_to_address || "" : "",
        address_line_2: "",
        city: quotation.address?.city || "",
        state: quotation.address?.state || "",
        pincode: quotation.address?.pincode || "",
        country: quotation.address?.country || "India",
      });
      return;
    }

    const matched = partiesList.find((p) => String(p._id || p.id) === partyId);
    if (matched) {
      setPartyName(String(matched.party_name || ""));
      setGstNo(String(matched.gst_no || ""));
      setDrugLicenseNo(String(matched.drug_license_no || ""));
      if (matched.payment_terms) {
        setPaymentTerms(String(matched.payment_terms));
      }

      if (Array.isArray(matched.contacts) && matched.contacts.length > 0) {
        setContacts(
          matched.contacts.map((c: any) => ({
            name: c.name || "Contact",
            phone: c.phone || "",
            email: c.email || "",
            department: c.department || "",
            alternate_phone: c.alternate_phone || "",
          }))
        );
      } else {
        setContacts([
          {
            name: String(matched.contact_person || matched.party_name || "Primary Contact"),
            phone: String(matched.mobile || ""),
            email: String(matched.email || ""),
            department: "",
            alternate_phone: "",
          },
        ]);
      }

      if (matched.billing_address && typeof matched.billing_address === "object") {
        const b = matched.billing_address as any;
        setBillingAddress({
          address_line_1: b.address_line_1 || "",
          address_line_2: b.address_line_2 || "",
          city: b.city || matched.district || "",
          state: b.state || matched.state || "",
          pincode: b.pincode || "",
          country: b.country || "India",
        });
      }

      if (matched.shipping_address && typeof matched.shipping_address === "object") {
        const s = matched.shipping_address as any;
        if (s.address_line_1) {
          setShippingAddress({
            address_line_1: s.address_line_1 || "",
            address_line_2: s.address_line_2 || "",
            city: s.city || "",
            state: s.state || "",
            pincode: s.pincode || "",
            country: s.country || "India",
          });
          setSameAsBilling(false);
        }
      }
    }
  };

  // Sync quotation details when opened
  useEffect(() => {
    if (!open) return;
    setCurrentStep(1);
    setOrderItems(linesFromQuotation(quotation));
    setPartyName(quotation.customer_name || "");
    setGstNo(quotation.gstin || "");
    setContacts([
      {
        name: quotation.kind_attn || quotation.customer_name || "Primary Contact",
        phone: quotation.phone || quotation.cell || "",
        email: quotation.email || "",
        department: "",
        alternate_phone: quotation.cell || "",
      },
    ]);
    setBillingAddress({
      address_line_1: quotation.address?.address_line_1 || "",
      address_line_2: "",
      city: quotation.address?.city || "",
      state: quotation.address?.state || "",
      pincode: quotation.address?.pincode || "",
      country: quotation.address?.country || "India",
    });
    const pDetails = quotation.proforma_details || {};
    setPaymentTerms(pDetails.payment_terms || quotation.payment_terms || "Net 30");
    const hasCustomShip =
      Boolean(pDetails.ship_to_address) &&
      pDetails.ship_to_address?.toLowerCase() !== "same as billing" &&
      pDetails.ship_to_address?.toLowerCase() !== "same";
    setSameAsBilling(!hasCustomShip);
    if (hasCustomShip) {
      setShippingAddress({
        address_line_1: pDetails.ship_to_address || "",
        address_line_2: "",
        city: quotation.address?.city || "",
        state: quotation.address?.state || "",
        pincode: quotation.address?.pincode || "",
        country: quotation.address?.country || "India",
      });
    }
    setCustomerPoNumber(pDetails.customer_po_number || quotation.customer_po_number || "");
    setCustomerPoDate(
      pDetails.customer_po_date
        ? new Date(pDetails.customer_po_date).toISOString().split("T")[0]
        : quotation.customer_po_date
          ? new Date(quotation.customer_po_date).toISOString().split("T")[0]
          : ""
    );
    if (pDetails.dispatch_date) {
      setDeliveryDate(new Date(pDetails.dispatch_date).toISOString().split("T")[0]);
    } else if (quotation.valid_until) {
      setDeliveryDate(new Date(quotation.valid_until).toISOString().split("T")[0]);
    }
    setAdvanceAmount(quotation.advance_amount || 0);
    setPaymentMode(quotation.payment_mode || "NEFT / RTGS");
    setPaymentReference(quotation.payment_reference || "");
    setOrderRemarks(
      pDetails.remarks || quotation.subject || (pDetails.proforma_no ? `Proforma #${pDetails.proforma_no}` : `Converted from Quotation #${quotation.quotation_no}`)
    );
    let initialSalesUser =
      typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null
        ? (quotation.sales_person_user as any)?._id || ""
        : typeof quotation.sales_person_user === "string"
        ? quotation.sales_person_user
        : "";

    const candidateName = (
      quotation.sales_person_name ||
      pDetails.sales_person ||
      (typeof quotation.created_by === "object" && quotation.created_by !== null
        ? quotation.created_by.name || ""
        : "")
    ).trim().toLowerCase();

    if (!initialSalesUser && candidateName && usersList.length > 0) {
      const match =
        salesUsers.find(
          (u) =>
            (u.name || "").toLowerCase() === candidateName ||
            (u.email || "").toLowerCase() === candidateName
        ) ||
        usersList.find(
          (u) =>
            (u.name || "").toLowerCase() === candidateName ||
            (u.email || "").toLowerCase() === candidateName
        );
      if (match) {
        initialSalesUser = match._id;
      }
    }
    setAssignedSalesUser(initialSalesUser);
  }, [open, quotation, usersList, salesUsers]);

  // Secondary effect to resolve sales user when async user list finishes loading
  useEffect(() => {
    if (!open || assignedSalesUser || salesUsers.length === 0) return;
    let initialSalesUser =
      typeof quotation.sales_person_user === "object" && quotation.sales_person_user !== null
        ? (quotation.sales_person_user as any)?._id || ""
        : typeof quotation.sales_person_user === "string"
        ? quotation.sales_person_user
        : "";

    const candidateName = (
      quotation.sales_person_name ||
      quotation.proforma_details?.sales_person ||
      (typeof quotation.created_by === "object" && quotation.created_by !== null
        ? quotation.created_by.name || ""
        : "")
    ).trim().toLowerCase();

    if (!initialSalesUser && candidateName) {
      const match =
        salesUsers.find(
          (u) =>
            (u.name || "").toLowerCase() === candidateName ||
            (u.email || "").toLowerCase() === candidateName
        ) ||
        usersList.find(
          (u) =>
            (u.name || "").toLowerCase() === candidateName ||
            (u.email || "").toLowerCase() === candidateName
        );
      if (match) {
        initialSalesUser = match._id;
      }
    }
    if (initialSalesUser) {
      setAssignedSalesUser(initialSalesUser);
    }
  }, [open, salesUsers, usersList, quotation, assignedSalesUser]);

  // Line item helpers
  const handleProductSelect = (index: number, pId: string) => {
    const prod = productsList.find((x) => String(x._id || x.id) === pId) || null;
    setOrderItems((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const rateType = current?.applied_rate_type || "SR";
      const uPrice = catalogUnitPrice(prod, rateType);
      const gstP = catalogGstPercent(prod);
      copy[index] = {
        ...current,
        productId: pId,
        product_name: prod ? String(prod.product_name || "") : current.product_name,
        sku: prod ? String(prod.sku || "") : current.sku,
        unit: prod ? String(prod.unit || "pcs") : current.unit,
        unit_price: uPrice,
        gst_percent: gstP,
      };
      return copy;
    });
  };

  const handleRateTypeChange = (index: number, newRateType: RateType) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      const current = copy[index];
      const prod = productsList.find((x) => String(x._id || x.id) === current.productId) || null;
      const uPrice = catalogUnitPrice(prod, newRateType);
      copy[index] = {
        ...current,
        applied_rate_type: newRateType,
        unit_price: uPrice > 0 ? uPrice : current.unit_price,
      };
      return copy;
    });
  };

  const updateLine = (index: number, patch: Partial<LineRow>) => {
    setOrderItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const removeLine = (index: number) => {
    setOrderItems((prev) => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.length > 0 ? copy : [newLine()];
    });
  };

  const addLine = () => {
    setOrderItems((prev) => [...prev, newLine()]);
  };

  // Order summary calculations
  const orderGrossSubtotal = useMemo(
    () => orderItems.reduce((acc, row) => acc + lineGross(row), 0),
    [orderItems]
  );
  const orderTotalDiscount = useMemo(
    () => orderItems.reduce((acc, row) => acc + lineDiscount(row), 0),
    [orderItems]
  );
  const orderTaxableAmount = useMemo(
    () => orderItems.reduce((acc, row) => acc + lineTaxable(row), 0),
    [orderItems]
  );
  const orderGstAmount = useMemo(
    () => orderItems.reduce((acc, row) => acc + lineGst(row), 0),
    [orderItems]
  );
  const orderGrandTotal = useMemo(
    () => orderItems.reduce((acc, row) => acc + lineTotal(row), 0),
    [orderItems]
  );

  // Step 1 Validation
  const validateStep1 = (): boolean => {
    if (quotation.status !== "accepted") {
      toast.error("Quotation must be accepted by the client before converting to an order");
      return false;
    }

    if (!partyName.trim()) {
      toast.error("Customer / Company name is required");
      return false;
    }

    const cleanContacts = sanitizePartyContacts(contacts);
    if (cleanContacts.length === 0) {
      toast.error("At least one contact with a valid name is required");
      return false;
    }

    return true;
  };

  // Step 2 Validation
  const validateStep2 = (): boolean => {
    const validLines = orderItems.filter((l) => l.product_name.trim().length > 0);
    if (validLines.length === 0) {
      toast.error("Please add at least one line item with a valid product");
      return false;
    }

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      if (!line.quantity || line.quantity <= 0) {
        toast.error(`Line #${i + 1} (${line.product_name}) must have a quantity > 0`);
        return false;
      }
      if (line.unit_price < 0) {
        toast.error(`Line #${i + 1} (${line.product_name}) unit price cannot be negative`);
        return false;
      }
    }

    return true;
  };

  // Submission handler
  const handleFinalSubmit = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      return;
    }

    try {
      const cleanContacts = sanitizePartyContacts(contacts);
      const effectiveShippingAddress = sameAsBilling ? billingAddress : shippingAddress;

      const orderLinesPayload = orderItems
        .filter((l) => l.product_name.trim().length > 0)
        .map((l) => ({
          product: l.productId || undefined,
          productId: l.productId || undefined,
          product_name: l.product_name.trim(),
          sku: l.sku || undefined,
          unit: l.unit || "pcs",
          quantity: Number(l.quantity || 1),
          unit_price: Number(l.unit_price || 0),
          applied_rate_type: l.applied_rate_type,
          discount_percent: Number(l.discount_percent || 0),
          discount_amount: Number(l.discount_amount || 0),
          gst_percent: Number(l.gst_percent || 18),
          remarks: l.remarks || undefined,
        }));

      const isExisting = Boolean(selectedPartyId);
      const body = {
        conversion_type: isExisting ? ("existing_customer" as const) : ("new_customer" as const),
        party_id: isExisting ? selectedPartyId : undefined,
        party_name: partyName.trim(),
        gst_no: gstNo.trim() || undefined,
        drug_license_no: drugLicenseNo.trim() || undefined,
        payment_terms: paymentTerms,
        billing_address: billingAddress,
        shipping_address: effectiveShippingAddress,
        party_data: {
          party_type: "customer",
          party_name: partyName.trim(),
          gst_no: gstNo.trim() || undefined,
          drug_license_no: drugLicenseNo.trim() || undefined,
          payment_terms: paymentTerms,
          contacts: cleanContacts,
          billing_address: billingAddress,
          shipping_address: effectiveShippingAddress,
        },
        order_data: {
          order_date: orderDate || new Date().toISOString().split("T")[0],
          delivery_date: deliveryDate || undefined,
          customer_po_number: customerPoNumber.trim() || undefined,
          customer_po_date: customerPoDate || undefined,
          advance_amount: Number(advanceAmount) || 0,
          payment_mode: paymentMode || undefined,
          payment_reference: paymentReference.trim() || undefined,
          remarks: orderRemarks || undefined,
          assigned_sales_user: assignedSalesUser || undefined,
        },
        assigned_sales_user: assignedSalesUser || undefined,
        customer_po_number: customerPoNumber.trim() || undefined,
        customer_po_date: customerPoDate || undefined,
        advance_amount: Number(advanceAmount) || 0,
        payment_mode: paymentMode || undefined,
        payment_reference: paymentReference.trim() || undefined,
        order_items: orderLinesPayload,
        notes: `Converted directly from Quotation #${quotation.quotation_no}`,
      };

      const leadId =
        typeof quotation.lead === "object" && quotation.lead !== null
          ? quotation.lead._id
          : (quotation.lead as string);

      const res = await convertQuotation({
        quotationId: quotation._id,
        leadId: leadId || undefined,
        body,
      }).unwrap();

      const createdOrderNo = res.order?.order_no ? ` #${res.order.order_no}` : "";
      toast.success(`Quotation ${quotation.quotation_no} converted to Order${createdOrderNo}!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(mutationRejectedMessage(err) || "Failed to convert quotation to order");
    }
  };

  if (!open) return null;

  return (
    <LargeModalPortal>
      <ModalOverlay onClick={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 transition-all animate-in fade-in-50 zoom-in-95"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-white/5 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-md shadow-primary/20">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  Convert Quotation to Confirmed Order
                  <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                    {quotation.ref_no || quotation.quotation_no}
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Step {currentStep} of 2 •{" "}
                  {currentStep === 1
                    ? "Customer Verification & Party Linking"
                    : "Order Details, Rates & Discount Review"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="border-b border-slate-100 bg-white px-6 py-3 dark:border-white/5 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              {/* Step 1 Button */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`flex flex-1 items-center gap-2 rounded-xl p-2 text-left transition-all ${
                  currentStep === 1
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                    currentStep === 1
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  }`}
                >
                  1
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold">1. Customer &amp; Billing</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {partyName || "Customer Details"}
                  </div>
                </div>
              </button>

              <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />

              {/* Step 2 Button */}
              <button
                type="button"
                onClick={() => {
                  if (validateStep1()) setCurrentStep(2);
                }}
                className={`flex flex-1 items-center gap-2 rounded-xl p-2 text-left transition-all ${
                  currentStep === 2
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${
                    currentStep === 2
                      ? "bg-primary text-white shadow-xs"
                      : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                  }`}
                >
                  2
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold">2. Order Generation</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {orderItems.length} items • {formatCurrencyINR(orderGrandTotal)}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Proforma Invoice Reference Banner (if proforma details exist) */}
            {(pDetails.proforma_no || pDetails.sales_person || pDetails.customer_po_number || pDetails.freight_charges) && (
              <div className="rounded-2xl border border-teal-200/80 bg-teal-50/50 p-4 dark:border-teal-900/40 dark:bg-teal-950/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-teal-900 dark:text-teal-200">
                      Proforma Invoice Reference Attached
                    </span>
                    {pDetails.proforma_no && (
                      <span className="rounded-md bg-teal-200/80 px-2 py-0.5 text-[11px] font-black text-teal-950 dark:bg-teal-900/60 dark:text-teal-200">
                        #{pDetails.proforma_no}
                      </span>
                    )}
                  </div>
                  {pDetails.invoice_date && (
                    <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                      Invoice Date: {new Date(pDetails.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-xs">
                  {pDetails.sales_person && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Sales Person</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate" title={pDetails.sales_person}>
                        {pDetails.sales_person}
                      </div>
                    </div>
                  )}
                  {pDetails.customer_po_number && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">PO Number</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {pDetails.customer_po_number}
                      </div>
                    </div>
                  )}
                  {pDetails.payment_terms && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Payment Terms</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pDetails.payment_terms}</div>
                    </div>
                  )}
                  {pDetails.dispatch_date && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Dispatch Date</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {new Date(pDetails.dispatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  )}
                  {pDetails.transport && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Transport</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pDetails.transport}</div>
                    </div>
                  )}
                  {pDetails.freight_charges && (
                    <div className="rounded-xl bg-white/90 p-2 border border-teal-100 dark:bg-slate-800/90 dark:border-teal-900/30">
                      <div className="text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400">Freight</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">{pDetails.freight_charges}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* STEP 1: CUSTOMER & BILLING DETAILS                                 */}
            {/* ==================================================================== */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Customer Selection / Linking Selector Header */}
                <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-800/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary" />
                        Customer Party Linking
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Pre-filled from quotation. Optionally select an existing party from your directory.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 min-w-[280px] md:w-84">
                      <select
                        value={selectedPartyId}
                        onChange={(e) => handlePartyChange(e.target.value)}
                        className={`w-full font-medium ${inputClass}`}
                      >
                        <option value="">-- Use Quotation Customer (Auto-Link) --</option>
                        {partiesList.map((p) => {
                          const pId = String(p._id || p.id);
                          const pName = String(p.party_name || "Unnamed Party");
                          const pCity =
                            p.district ||
                            (typeof p.billing_address === "object" && (p.billing_address as any)?.city) ||
                            "";
                          return (
                            <option key={pId} value={pId}>
                              {pName} {pCity ? `(${pCity})` : ""}
                            </option>
                          );
                        })}
                      </select>
                      {selectedPartyId && (
                        <button
                          type="button"
                          onClick={() => handlePartyChange("")}
                          title="Reset to quotation customer details"
                          className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedPartyId && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                      <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>
                        Linked to registered party: <strong>{partyName}</strong>
                      </span>
                    </div>
                  )}
                </div>

                {/* Section 1: Customer Profile & Primary Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Company Info */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-white/10 dark:bg-slate-900 space-y-3.5 shadow-xs">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-primary" />
                      Company Information
                    </span>

                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Customer / Company Name *</label>
                        <input
                          type="text"
                          value={partyName}
                          onChange={(e) => setPartyName(e.target.value)}
                          placeholder="e.g. Acme Diagnostics"
                          className={`mt-1 ${inputClass} font-semibold`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>GST Number (GSTIN)</label>
                          <input
                            type="text"
                            value={gstNo}
                            onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                            placeholder="e.g. 03BEQPK0882R1ZT"
                            maxLength={15}
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Payment Terms</label>
                          <select
                            value={paymentTerms}
                            onChange={(e) => setPaymentTerms(e.target.value)}
                            className={`mt-1 ${inputClass}`}
                          >
                            <option value="On Delivery">On Delivery</option>
                            <option value="Advance">100% Advance</option>
                            <option value="50% Advance, 50% on Delivery">50% Advance, 50% on Delivery</option>
                            <option value="Net 15">Net 15 Days</option>
                            <option value="Net 30">Net 30 Days</option>
                            <option value="Net 45">Net 45 Days</option>
                            <option value="Net 60">Net 60 Days</option>
                            <option value="Against LC">Letter of Credit (LC)</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Drug License / Registration No</label>
                        <input
                          type="text"
                          value={drugLicenseNo}
                          onChange={(e) => setDrugLicenseNo(e.target.value)}
                          placeholder="e.g. DL-20B-12345 (Optional)"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Primary Contact Details */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-white/10 dark:bg-slate-900 space-y-3.5 shadow-xs">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-indigo-600" />
                      Primary Contact Details
                    </span>

                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Contact Person Name *</label>
                        <input
                          type="text"
                          value={contacts[0]?.name || ""}
                          onChange={(e) => {
                            const updated = [...contacts];
                            const current = updated[0] || { name: "", phone: "", email: "", department: "", alternate_phone: "" };
                            updated[0] = { ...current, name: e.target.value };
                            setContacts(updated);
                          }}
                          placeholder="e.g. Shammi Anand"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Phone / Mobile *</label>
                          <input
                            type="text"
                            value={contacts[0]?.phone || ""}
                            onChange={(e) => {
                              const updated = [...contacts];
                              const current = updated[0] || { name: "Contact", phone: "", email: "", department: "", alternate_phone: "" };
                              updated[0] = { ...current, phone: e.target.value };
                              setContacts(updated);
                            }}
                            placeholder="e.g. 9855691527"
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Email Address</label>
                          <input
                            type="email"
                            value={contacts[0]?.email || ""}
                            onChange={(e) => {
                              const updated = [...contacts];
                              const current = updated[0] || { name: "Contact", phone: "", email: "", department: "", alternate_phone: "" };
                              updated[0] = { ...current, email: e.target.value };
                              setContacts(updated);
                            }}
                            placeholder="e.g. contact@domain.com"
                            className={`mt-1 ${inputClass}`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>Alternate Phone / Cell</label>
                        <input
                          type="text"
                          value={contacts[0]?.alternate_phone || ""}
                          onChange={(e) => {
                            const updated = [...contacts];
                            const current = updated[0] || { name: "Contact", phone: "", email: "", department: "", alternate_phone: "" };
                            updated[0] = { ...current, alternate_phone: e.target.value };
                            setContacts(updated);
                          }}
                          placeholder="e.g. 9876543210 (Optional)"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Addresses */}
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 dark:border-white/10 dark:bg-slate-900 space-y-4 shadow-xs">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-emerald-600" />
                    Billing &amp; Shipping Address
                  </span>

                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2">
                        <label className={labelClass}>Billing Street Address</label>
                        <input
                          type="text"
                          value={billingAddress.address_line_1}
                          onChange={(e) =>
                            setBillingAddress({ ...billingAddress, address_line_1: e.target.value })
                          }
                          placeholder="Premises, street name, area"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>City / District</label>
                        <input
                          type="text"
                          value={billingAddress.city}
                          onChange={(e) =>
                            setBillingAddress({ ...billingAddress, city: e.target.value })
                          }
                          placeholder="e.g. Amritsar"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>State</label>
                        <input
                          type="text"
                          value={billingAddress.state}
                          onChange={(e) =>
                            setBillingAddress({ ...billingAddress, state: e.target.value })
                          }
                          placeholder="e.g. Punjab"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Pincode</label>
                        <input
                          type="text"
                          value={billingAddress.pincode}
                          onChange={(e) =>
                            setBillingAddress({ ...billingAddress, pincode: e.target.value })
                          }
                          placeholder="6-digit pincode"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Country</label>
                        <input
                          type="text"
                          value={billingAddress.country}
                          onChange={(e) =>
                            setBillingAddress({ ...billingAddress, country: e.target.value })
                          }
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                    </div>

                    {/* Shipping Address Toggle & Collapsible Section */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={sameAsBilling}
                          onChange={(e) => setSameAsBilling(e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        Shipping address is identical to Billing Address
                      </label>

                      {!sameAsBilling && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-xl bg-slate-50/70 p-3.5 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 animate-in fade-in-50">
                          <div className="md:col-span-2">
                            <label className={labelClass}>Shipping Street Address</label>
                            <input
                              type="text"
                              value={shippingAddress.address_line_1}
                              onChange={(e) =>
                                setShippingAddress({
                                  ...shippingAddress,
                                  address_line_1: e.target.value,
                                })
                              }
                              placeholder="Shipping address / Delivery site"
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>City</label>
                            <input
                              type="text"
                              value={shippingAddress.city}
                              onChange={(e) =>
                                setShippingAddress({ ...shippingAddress, city: e.target.value })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>State</label>
                            <input
                              type="text"
                              value={shippingAddress.state}
                              onChange={(e) =>
                                setShippingAddress({ ...shippingAddress, state: e.target.value })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Pincode</label>
                            <input
                              type="text"
                              value={shippingAddress.pincode}
                              onChange={(e) =>
                                setShippingAddress({
                                  ...shippingAddress,
                                  pincode: e.target.value,
                                })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Country</label>
                            <input
                              type="text"
                              value={shippingAddress.country}
                              onChange={(e) =>
                                setShippingAddress({
                                  ...shippingAddress,
                                  country: e.target.value,
                                })
                              }
                              className={`mt-1 ${inputClass}`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================================================================== */}
            {/* STEP 2: ORDER LINE ITEMS, RATES, DISCOUNTS & TOTALS                  */}
            {/* ==================================================================== */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Header order dates & notes */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5">
                  <div>
                    <label className={labelClass}>Order Date *</label>
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Expected Delivery Date</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Assigned Sales Person</label>
                    <select
                      value={assignedSalesUser}
                      onChange={(e) => setAssignedSalesUser(e.target.value)}
                      className={`mt-1 ${inputClass} font-medium`}
                    >
                      <option value="">-- Select Sales Person --</option>
                      {salesUsers.map((u) => {
                        const deptLabel = u.department ? `[${u.department.toUpperCase()}]` : "";
                        return (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email} {deptLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Order Remarks / Reference</label>
                    <input
                      type="text"
                      value={orderRemarks}
                      onChange={(e) => setOrderRemarks(e.target.value)}
                      placeholder="e.g. Urgent Hospital Requirement"
                      className={`mt-1 ${inputClass}`}
                    />
                  </div>
                </div>

                {/* Customer PO & Advance Payment Details Card */}
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 dark:border-indigo-900/30 dark:bg-indigo-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      Customer PO & Advance Payment Details (Optional)
                    </span>
                    <span className="text-[10px] font-semibold text-indigo-600/80 dark:text-indigo-400/80">
                      Auto-attached to generated Order
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Customer PO Number</label>
                      <input
                        type="text"
                        value={customerPoNumber}
                        onChange={(e) => setCustomerPoNumber(e.target.value)}
                        placeholder="e.g. PO-2026-9876"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Customer PO Date</label>
                      <input
                        type="date"
                        value={customerPoDate}
                        onChange={(e) => setCustomerPoDate(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Advance Amount (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step="1"
                        value={advanceAmount || ""}
                        onChange={(e) => setAdvanceAmount(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="e.g. 50000"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className={`mt-1 ${inputClass}`}
                      >
                        <option value="NEFT / RTGS">NEFT / RTGS (Bank Transfer)</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI / QR">UPI / QR</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Cash">Cash</option>
                        <option value="Letter of Credit / Credit">Letter of Credit / Credit Terms</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Payment Reference / UTR No.</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. UTR123456789 or Cheque #887654"
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Order Line Items ({orderItems.length})
                    </h3>
                    <button
                      type="button"
                      onClick={addLine}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Product Item
                    </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900 shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-slate-800/60 dark:text-slate-400">
                        <tr>
                          <th className="py-3 px-3 min-w-[200px]">Product / Item</th>
                          <th className="py-3 px-2 w-24 text-center">Rate Type</th>
                          <th className="py-3 px-2 w-20 text-center">Qty</th>
                          <th className="py-3 px-2 w-28 text-right">Unit Rate (₹)</th>
                          <th className="py-3 px-2 w-28 text-right">Discount</th>
                          <th className="py-3 px-2 w-20 text-center">GST %</th>
                          <th className="py-3 px-3 w-28 text-right">Total (₹)</th>
                          <th className="py-3 px-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {orderItems.map((row, idx) => {
                          const gross = lineGross(row);
                          const disc = lineDiscount(row);
                          const tot = lineTotal(row);

                          return (
                            <tr
                              key={row.key}
                              className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                            >
                              {/* Product selection or direct text */}
                              <td className="py-2.5 px-3">
                                <div className="space-y-1">
                                  {productsList.length > 0 ? (
                                    <select
                                      value={row.productId}
                                      onChange={(e) => handleProductSelect(idx, e.target.value)}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                    >
                                      <option value="">Select from catalog or enter below...</option>
                                      {productsList.map((p) => (
                                        <option key={String(p._id || p.id)} value={String(p._id || p.id)}>
                                          {String(p.product_name)} ({String(p.sku || "No SKU")})
                                        </option>
                                      ))}
                                    </select>
                                  ) : null}

                                  <input
                                    type="text"
                                    value={row.product_name}
                                    onChange={(e) => updateLine(idx, { product_name: e.target.value })}
                                    placeholder="Product description / item name"
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                  />
                                </div>
                              </td>

                              {/* Applied Rate Type (SR / SRA / CR) */}
                              <td className="py-2.5 px-2 text-center">
                                <select
                                  value={row.applied_rate_type}
                                  onChange={(e) => handleRateTypeChange(idx, e.target.value as RateType)}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                >
                                  <option value="SR">SR (Base)</option>
                                  <option value="SRA">SRA (Min)</option>
                                  <option value="CR">CR (MRP)</option>
                                </select>
                              </td>

                              {/* Quantity */}
                              <td className="py-2.5 px-2 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  value={row.quantity}
                                  onChange={(e) =>
                                    updateLine(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })
                                  }
                                  className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs font-semibold text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                />
                              </td>

                              {/* Unit Price */}
                              <td className="py-2.5 px-2 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={row.unit_price}
                                  onChange={(e) =>
                                    updateLine(idx, { unit_price: Math.max(0, Number(e.target.value) || 0) })
                                  }
                                  className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-xs font-semibold text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                />
                              </td>

                              {/* Discount (Percent or Amount) */}
                              <td className="py-2.5 px-2 text-right">
                                <div className="flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    value={row.discount_percent || ""}
                                    onChange={(e) => {
                                      const p = Number(e.target.value) || 0;
                                      updateLine(idx, {
                                        discount_percent: p,
                                        discount_amount: Math.round(((gross * p) / 100) * 100) / 100,
                                      });
                                    }}
                                    placeholder="%"
                                    title="Discount %"
                                    className="w-12 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-right text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                  />
                                  <span className="text-[10px] text-slate-400">%</span>
                                </div>
                                {disc > 0 && (
                                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    -{formatCurrencyINR(disc)}
                                  </div>
                                )}
                              </td>

                              {/* GST % */}
                              <td className="py-2.5 px-2 text-center">
                                <select
                                  value={row.gst_percent}
                                  onChange={(e) =>
                                    updateLine(idx, { gst_percent: Number(e.target.value) || 0 })
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-primary focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={12}>12%</option>
                                  <option value={18}>18%</option>
                                  <option value={28}>28%</option>
                                </select>
                              </td>

                              {/* Row Total */}
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                                {formatCurrencyINR(tot)}
                              </td>

                              {/* Remove Line Action */}
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => removeLine(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                  title="Delete item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Financial Summary Calculation Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/5 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold text-slate-500">Gross Subtotal</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      {formatCurrencyINR(orderGrossSubtotal)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/60 p-3.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Total Discounts</span>
                    <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mt-1">
                      -{formatCurrencyINR(orderTotalDiscount)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/5 dark:bg-slate-800/40">
                    <span className="text-[11px] font-semibold text-slate-500">GST Tax (SGST + CGST)</span>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      +{formatCurrencyINR(orderGstAmount)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3.5 dark:border-primary/40 dark:bg-primary/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Grand Total</span>
                    <div className="text-base font-black text-primary mt-1">
                      {formatCurrencyINR(orderGrandTotal)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-white/5 dark:bg-slate-800/50">
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Back to Customer
              </button>
            )}

            <div className="flex items-center gap-3">
              {currentStep === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setCurrentStep(2);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 hover:bg-primary-hover transition-all cursor-pointer"
                >
                  Proceed to Order Review <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleFinalSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <span>Converting &amp; Generating Order...</span>
                  ) : (
                    <>
                      <SendHorizontal className="h-4 w-4" />
                      Convert &amp; Submit Order ({formatCurrencyINR(orderGrandTotal)})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </ModalOverlay>
    </LargeModalPortal>
  );
}
