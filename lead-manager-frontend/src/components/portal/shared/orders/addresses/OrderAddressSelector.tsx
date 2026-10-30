"use client";

import { useState, useMemo, useEffect } from "react";
import {
  MapPin,
  Building2,
  Truck,
  Plus,
  Check,
  Edit3,
  Copy,
  RotateCcw,
  BookmarkPlus,
  Loader2,
  Save,
} from "lucide-react";
import { usePatchPartyMutation, type PartyShippingAddress } from "@/store/api";
import { toast } from "sonner";

export type OrderAddressRecord = {
  label?: string;
  recipient_name?: string;
  phone?: string;
  gst_no?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

type Props = {
  selectedParty: Record<string, any> | undefined;
  billingAddress: OrderAddressRecord | null;
  onChangeBillingAddress: (addr: OrderAddressRecord | null) => void;
  shippingAddress: OrderAddressRecord | null;
  onChangeShippingAddress: (addr: OrderAddressRecord | null) => void;
  saveShippingToParty: boolean;
  onChangeSaveShippingToParty: (save: boolean) => void;
};

function cleanPartyAddress(
  raw: Record<string, any> | undefined,
  fallbackParty?: Record<string, any>,
  label = "Default"
): OrderAddressRecord {
  if (!raw || typeof raw !== "object") {
    return {
      label,
      recipient_name: String(fallbackParty?.party_name ?? fallbackParty?.name ?? ""),
      phone: String(fallbackParty?.mobile ?? ""),
      gst_no: String(fallbackParty?.gst_no ?? ""),
      address_line_1: "",
      address_line_2: "",
      city: String(fallbackParty?.district ?? ""),
      state: String(fallbackParty?.state ?? ""),
      pincode: "",
      country: "India",
    };
  }
  return {
    label: String(raw.label ?? label),
    recipient_name: String(
      raw.recipient_name ?? fallbackParty?.party_name ?? fallbackParty?.name ?? ""
    ),
    phone: String(raw.phone ?? fallbackParty?.mobile ?? ""),
    gst_no: String(raw.gst_no ?? fallbackParty?.gst_no ?? ""),
    address_line_1: String(raw.address_line_1 ?? raw.line1 ?? raw.street ?? ""),
    address_line_2: String(raw.address_line_2 ?? raw.line2 ?? ""),
    city: String(raw.city ?? fallbackParty?.district ?? ""),
    state: String(raw.state ?? fallbackParty?.state ?? ""),
    pincode: String(raw.pincode ?? raw.pin ?? raw.zip ?? ""),
    country: String(raw.country ?? "India"),
  };
}

function formatOneLine(addr: OrderAddressRecord | null | undefined): string {
  if (!addr) return "Not specified";
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.pincode ? `- ${addr.pincode}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No street address provided";
}

export function OrderAddressSelector({
  selectedParty,
  billingAddress,
  onChangeBillingAddress,
  shippingAddress,
  onChangeShippingAddress,
  saveShippingToParty,
  onChangeSaveShippingToParty,
}: Props) {
  const [editingBilling, setEditingBilling] = useState(false);
  const [shippingMode, setShippingMode] = useState<"same_as_billing" | "saved" | "custom">(
    "same_as_billing"
  );
  const [selectedSavedIndex, setSelectedSavedIndex] = useState<number>(0);

  const [patchParty, { isLoading: savingToParty }] = usePatchPartyMutation();

  const partyDefaultBilling = useMemo(() => {
    if (!selectedParty) return null;
    return cleanPartyAddress(
      selectedParty.billing_address as Record<string, any> | undefined,
      selectedParty,
      "Primary Billing"
    );
  }, [selectedParty]);

  const savedShippingAddresses = useMemo<OrderAddressRecord[]>(() => {
    if (!selectedParty) return [];
    const list: OrderAddressRecord[] = [];

    const multi = selectedParty.shipping_addresses;
    if (Array.isArray(multi) && multi.length > 0) {
      multi.forEach((item: any, idx: number) => {
        list.push(cleanPartyAddress(item, selectedParty, item?.label || `Location #${idx + 1}`));
      });
    } else if (
      selectedParty.shipping_address &&
      typeof selectedParty.shipping_address === "object" &&
      (selectedParty.shipping_address.address_line_1 || selectedParty.shipping_address.city)
    ) {
      list.push(
        cleanPartyAddress(selectedParty.shipping_address, selectedParty, "Default Shipping")
      );
    }

    return list;
  }, [selectedParty]);

  // Initialize addresses when party changes
  const partyId = String(selectedParty?._id ?? selectedParty?.id ?? "");
  useEffect(() => {
    if (!selectedParty) {
      onChangeBillingAddress(null);
      onChangeShippingAddress(null);
      setEditingBilling(false);
      setShippingMode("same_as_billing");
      onChangeSaveShippingToParty(false);
      return;
    }

    const defaultBill = cleanPartyAddress(
      selectedParty.billing_address,
      selectedParty,
      "Primary Billing"
    );
    onChangeBillingAddress(defaultBill);

    if (savedShippingAddresses.length > 0) {
      setShippingMode("saved");
      setSelectedSavedIndex(0);
      onChangeShippingAddress(savedShippingAddresses[0]);
    } else {
      setShippingMode("same_as_billing");
      onChangeShippingAddress(defaultBill);
    }
    onChangeSaveShippingToParty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  // Keep shipping synced when mode is same_as_billing
  useEffect(() => {
    if (shippingMode === "same_as_billing" && billingAddress) {
      onChangeShippingAddress({ ...billingAddress, label: "Same as Billing" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingMode, billingAddress]);

  const handleSaveCustomShippingNow = async () => {
    if (!partyId || !shippingAddress?.address_line_1?.trim()) {
      toast.error("Please enter at least Address Line 1 before saving to party.");
      return;
    }

    try {
      const existingList: PartyShippingAddress[] = Array.isArray(
        selectedParty?.shipping_addresses
      )
        ? [...selectedParty.shipping_addresses]
        : [];

      const newEntry: PartyShippingAddress = {
        label: shippingAddress.label || `Branch / Site #${existingList.length + 1}`,
        recipient_name: shippingAddress.recipient_name || "",
        phone: shippingAddress.phone || "",
        gst_no: shippingAddress.gst_no || "",
        address_line_1: shippingAddress.address_line_1 || "",
        address_line_2: shippingAddress.address_line_2 || "",
        city: shippingAddress.city || "",
        state: shippingAddress.state || "",
        pincode: shippingAddress.pincode || "",
        country: shippingAddress.country || "India",
        is_default: existingList.length === 0,
      };

      const nextAddresses = [...existingList, newEntry];
      await patchParty({
        id: partyId,
        patch: {
          shipping_addresses: nextAddresses,
          ...(existingList.length === 0 ? { shipping_address: newEntry } : {}),
        },
      }).unwrap();

      toast.success("Shipping address saved to customer profile!");
      onChangeSaveShippingToParty(false);
    } catch (e: any) {
      toast.error(e?.data?.message || "Failed to save shipping address to party.");
    }
  };

  if (!selectedParty) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-semibold text-slate-900">
            Billing & Shipping Addresses
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-500">
          Customize per-order delivery or select from saved locations
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ================= BILLING ADDRESS ================= */}
        <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-600">
                <Building2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Billing Address
                </h3>
                <p className="text-[11px] text-slate-500">Invoice & tax registration address</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {editingBilling && partyDefaultBilling && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeBillingAddress(partyDefaultBilling);
                    setEditingBilling(false);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  title="Reset to Party Default"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditingBilling((v) => !v)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  editingBilling
                    ? "bg-indigo-600 text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <Edit3 className="h-3 w-3" />
                {editingBilling ? "Done" : "Customize"}
              </button>
            </div>
          </div>

          {!editingBilling ? (
            <div className="flex-1 rounded-md border border-slate-200/80 bg-white p-3 text-xs">
              <div className="font-semibold text-slate-900">
                {billingAddress?.recipient_name || selectedParty.party_name}
              </div>
              <p className="mt-1 leading-relaxed text-slate-600">
                {formatOneLine(billingAddress)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                {billingAddress?.gst_no && (
                  <span>
                    GSTIN: <strong className="font-mono text-slate-700">{billingAddress.gst_no}</strong>
                  </span>
                )}
                {billingAddress?.phone && (
                  <span>
                    Ph: <strong className="text-slate-700">{billingAddress.phone}</strong>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 rounded-md border border-indigo-200 bg-white p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  Billing Name / Entity
                </label>
                <input
                  type="text"
                  value={billingAddress?.recipient_name ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({ ...billingAddress, recipient_name: e.target.value })
                  }
                  placeholder="Company / Hospital Name"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={billingAddress?.gst_no ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({
                      ...billingAddress,
                      gst_no: e.target.value.toUpperCase(),
                    })
                  }
                  placeholder="27AAAAA0000A1Z5"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 font-mono text-xs uppercase focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={billingAddress?.phone ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({ ...billingAddress, phone: e.target.value })
                  }
                  placeholder="Phone number"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  Address Line 1
                </label>
                <input
                  type="text"
                  value={billingAddress?.address_line_1 ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({ ...billingAddress, address_line_1: e.target.value })
                  }
                  placeholder="Building, Street, Area"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={billingAddress?.address_line_2 ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({ ...billingAddress, address_line_2: e.target.value })
                  }
                  placeholder="Landmark, Industrial Estate"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                  City / District
                </label>
                <input
                  type="text"
                  value={billingAddress?.city ?? ""}
                  onChange={(e) =>
                    onChangeBillingAddress({ ...billingAddress, city: e.target.value })
                  }
                  placeholder="City"
                  className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    State
                  </label>
                  <input
                    type="text"
                    value={billingAddress?.state ?? ""}
                    onChange={(e) =>
                      onChangeBillingAddress({ ...billingAddress, state: e.target.value })
                    }
                    placeholder="State"
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={billingAddress?.pincode ?? ""}
                    onChange={(e) =>
                      onChangeBillingAddress({ ...billingAddress, pincode: e.target.value })
                    }
                    placeholder="PIN"
                    className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= SHIPPING ADDRESS ================= */}
        <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-50 text-teal-600">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Shipping Destination
                </h3>
                <p className="text-[11px] text-slate-500">Consignee / goods delivery location</p>
              </div>
            </div>

            {/* Mode selector pills */}
            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => {
                  setShippingMode("same_as_billing");
                  if (billingAddress) {
                    onChangeShippingAddress({ ...billingAddress, label: "Same as Billing" });
                  }
                  onChangeSaveShippingToParty(false);
                }}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                  shippingMode === "same_as_billing"
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Copy className="h-3 w-3" />
                Same as Billing
              </button>

              {savedShippingAddresses.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShippingMode("saved");
                    const idx = Math.min(selectedSavedIndex, savedShippingAddresses.length - 1);
                    setSelectedSavedIndex(idx);
                    onChangeShippingAddress(savedShippingAddresses[idx]);
                    onChangeSaveShippingToParty(false);
                  }}
                  className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                    shippingMode === "saved"
                      ? "bg-teal-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Saved ({savedShippingAddresses.length})
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setShippingMode("custom");
                  onChangeShippingAddress({
                    label: `Site #${savedShippingAddresses.length + 1}`,
                    recipient_name: String(selectedParty?.party_name ?? ""),
                    phone: String(selectedParty?.mobile ?? ""),
                    gst_no: String(selectedParty?.gst_no ?? ""),
                    address_line_1: "",
                    address_line_2: "",
                    city: "",
                    state: String(selectedParty?.state ?? ""),
                    pincode: "",
                    country: "India",
                  });
                }}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                  shippingMode === "custom"
                    ? "bg-teal-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Plus className="h-3 w-3" />
                New Location
              </button>
            </div>
          </div>

          {/* MODE 1: SAME AS BILLING */}
          {shippingMode === "same_as_billing" && (
            <div className="flex-1 rounded-md border border-slate-200/80 bg-white p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  {shippingAddress?.recipient_name || selectedParty.party_name}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                  <Check className="h-3 w-3" /> Mirrors Billing Address
                </span>
              </div>
              <p className="mt-1 leading-relaxed text-slate-600">
                {formatOneLine(shippingAddress)}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                <span>
                  Ph: <strong className="text-slate-700">{shippingAddress?.phone || "—"}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShippingMode("custom")}
                  className="font-semibold text-teal-600 hover:text-teal-700 hover:underline"
                >
                  Ship to a different location instead →
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: SAVED SHIPPING ADDRESSES */}
          {shippingMode === "saved" && savedShippingAddresses.length > 0 && (
            <div className="flex flex-1 flex-col gap-2">
              {savedShippingAddresses.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {savedShippingAddresses.map((addr, idx) => {
                    const active = idx === selectedSavedIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedSavedIndex(idx);
                          onChangeShippingAddress(addr);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <MapPin className={`h-3 w-3 ${active ? "text-teal-600" : "text-slate-400"}`} />
                        <span>{addr.label || `Location #${idx + 1}`}</span>
                        {addr.city ? (
                          <span className="text-[10px] text-slate-500">({addr.city})</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex-1 rounded-md border border-slate-200/80 bg-white p-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-900">
                    {shippingAddress?.recipient_name || selectedParty.party_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {shippingAddress?.label || "Saved Destination"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShippingMode("custom")}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-600 hover:text-teal-700"
                    >
                      <Edit3 className="h-3 w-3" /> Edit
                    </button>
                  </div>
                </div>
                <p className="mt-1 leading-relaxed text-slate-600">
                  {formatOneLine(shippingAddress)}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                  {shippingAddress?.phone && (
                    <span>
                      Consignee Ph: <strong className="text-slate-700">{shippingAddress.phone}</strong>
                    </span>
                  )}
                  {shippingAddress?.gst_no && (
                    <span>
                      Branch GST: <strong className="font-mono text-slate-700">{shippingAddress.gst_no}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: CUSTOM / NEW SHIPPING LOCATION */}
          {shippingMode === "custom" && (
            <div className="space-y-3 rounded-md border border-teal-200 bg-white p-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Location Label (e.g. Warehouse 2, Pune Branch)
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.label ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({ ...shippingAddress, label: e.target.value })
                    }
                    placeholder="e.g. Unit-2 / Central Store"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Consignee / Receiver Name
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.recipient_name ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({
                        ...shippingAddress,
                        recipient_name: e.target.value,
                      })
                    }
                    placeholder="Receiver / Branch Name"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Site Contact Phone
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.phone ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({ ...shippingAddress, phone: e.target.value })
                    }
                    placeholder="Receiver mobile"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Branch GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.gst_no ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({
                        ...shippingAddress,
                        gst_no: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Optional site GSTIN"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 font-mono text-xs uppercase focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Delivery Address Line 1 *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.address_line_1 ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({
                        ...shippingAddress,
                        address_line_1: e.target.value,
                      })
                    }
                    placeholder="Plot No, Building, Street, Area"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    Delivery Address Line 2 (Optional)
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.address_line_2 ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({
                        ...shippingAddress,
                        address_line_2: e.target.value,
                      })
                    }
                    placeholder="Landmark, Gate No."
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                    City / District *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress?.city ?? ""}
                    onChange={(e) =>
                      onChangeShippingAddress({ ...shippingAddress, city: e.target.value })
                    }
                    placeholder="City"
                    className="h-8 w-full rounded border border-slate-300 px-2.5 text-xs focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                      State
                    </label>
                    <input
                      type="text"
                      value={shippingAddress?.state ?? ""}
                      onChange={(e) =>
                        onChangeShippingAddress({ ...shippingAddress, state: e.target.value })
                      }
                      placeholder="State"
                      className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase text-slate-500">
                      Pincode
                    </label>
                    <input
                      type="text"
                      value={shippingAddress?.pincode ?? ""}
                      onChange={(e) =>
                        onChangeShippingAddress({ ...shippingAddress, pincode: e.target.value })
                      }
                      placeholder="PIN"
                      className="h-8 w-full rounded border border-slate-300 px-2 text-xs focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Save to party controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-teal-100 bg-teal-50/60 px-3 py-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-teal-900">
                  <input
                    type="checkbox"
                    checked={saveShippingToParty}
                    onChange={(e) => onChangeSaveShippingToParty(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                  />
                  <BookmarkPlus className="h-3.5 w-3.5 text-teal-600" />
                  <span>Also save this location to customer profile on order create</span>
                </label>

                <button
                  type="button"
                  disabled={savingToParty || !shippingAddress?.address_line_1?.trim()}
                  onClick={handleSaveCustomShippingNow}
                  className="inline-flex items-center gap-1 rounded bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingToParty ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save to Customer Profile Now
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

