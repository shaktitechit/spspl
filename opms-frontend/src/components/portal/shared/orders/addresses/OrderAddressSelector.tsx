"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MapPin,
  Building2,
  Truck,
  Plus,
  Check,
  ChevronDown,
  Edit2,
  Save,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  useGetPartyQuery,
  usePatchPartyMutation,
  type PartyShippingAddress,
} from "@/store/api/slices/partiesApi";
import { toast } from "@/lib/toast";

export interface OrderAddressData {
  label?: string;
  recipient_name?: string;
  phone?: string;
  gst_no?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
}

export const emptyOrderAddress: OrderAddressData = {
  label: "",
  recipient_name: "",
  phone: "",
  gst_no: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

export function formatAddressOneLine(addr?: Partial<OrderAddressData> | null): string {
  if (!addr) return "No address specified";
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No address specified";
}

export interface OrderAddressSelectorProps {
  party: Record<string, unknown> | null;
  billingAddress: OrderAddressData;
  shippingAddress: OrderAddressData;
  onBillingAddressChange: (addr: OrderAddressData) => void;
  onShippingAddressChange: (addr: OrderAddressData) => void;
  saveShippingToParty?: boolean;
  onSaveShippingToPartyChange?: (save: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function OrderAddressSelector({
  party,
  billingAddress,
  shippingAddress,
  onBillingAddressChange,
  onShippingAddressChange,
  saveShippingToParty = false,
  onSaveShippingToPartyChange,
  disabled = false,
  readOnly = false,
}: OrderAddressSelectorProps) {
  const partyId = String(party?._id || party?.id || "");

  // Real-time query to get fresh party data (e.g. newly added shipping addresses)
  const { data: freshParty, refetch: refetchParty } = useGetPartyQuery(partyId, {
    skip: !partyId,
  });
  const [patchParty] = usePatchPartyMutation();

  const effectiveParty = (freshParty || party) as Record<string, any> | null;

  // Extract party billing address
  const partyBilling = useMemo<OrderAddressData>(() => {
    if (!effectiveParty) return emptyOrderAddress;
    const b = (effectiveParty.billing_address || effectiveParty.address || {}) as any;
    return {
      label: "Billing Address",
      recipient_name: String(b.recipient_name || effectiveParty.contact_person || ""),
      phone: String(b.phone || effectiveParty.mobile || ""),
      gst_no: String(b.gst_no || effectiveParty.gst_no || ""),
      address_line_1: String(b.address_line_1 || ""),
      address_line_2: String(b.address_line_2 || ""),
      city: String(b.city || ""),
      state: String(b.state || ""),
      pincode: String(b.pincode || ""),
      country: String(b.country || "India"),
    };
  }, [effectiveParty]);

  // Extract all shipping addresses for this party
  const partyShippingAddresses = useMemo<PartyShippingAddress[]>(() => {
    if (!effectiveParty) return [];
    const list: PartyShippingAddress[] = Array.isArray(effectiveParty.shipping_addresses)
      ? (effectiveParty.shipping_addresses as PartyShippingAddress[])
      : [];

    const defaultSingle = effectiveParty.shipping_address as any;
    if (defaultSingle && (defaultSingle.address_line_1 || defaultSingle.city)) {
      const alreadyInList = list.some(
        (item) =>
          item.address_line_1 === defaultSingle.address_line_1 &&
          item.city === defaultSingle.city,
      );
      if (!alreadyInList) {
        return [
          {
            _id: "default-single",
            label: defaultSingle.label || "Primary Shipping",
            recipient_name: defaultSingle.recipient_name || effectiveParty.contact_person,
            phone: defaultSingle.phone || effectiveParty.mobile,
            gst_no: defaultSingle.gst_no || effectiveParty.gst_no,
            address_line_1: defaultSingle.address_line_1,
            address_line_2: defaultSingle.address_line_2,
            city: defaultSingle.city,
            state: defaultSingle.state,
            pincode: defaultSingle.pincode,
            country: defaultSingle.country || "India",
            is_default: true,
          },
          ...list,
        ];
      }
    }
    return list;
  }, [effectiveParty]);

  // Mode: "same_as_billing" | "saved" | "custom"
  const [shippingMode, setShippingMode] = useState<"same_as_billing" | "saved" | "custom">("same_as_billing");
  const [selectedSavedId, setSelectedSavedId] = useState<string>("");
  const [isCustomizingBilling, setIsCustomizingBilling] = useState<boolean>(false);
  const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);

  // Preserve user-typed custom address draft so switching tabs does not wipe their typing
  const [customDraft, setCustomDraft] = useState<OrderAddressData>(emptyOrderAddress);

  // Track the last party ID to only initialize the mode when party changes, NEVER on keystroke!
  const lastInitializedPartyIdRef = useRef<string>("");

  useEffect(() => {
    if (!partyId) {
      lastInitializedPartyIdRef.current = "";
      return;
    }

    // Only run initialization when selecting a different party
    if (lastInitializedPartyIdRef.current !== partyId) {
      lastInitializedPartyIdRef.current = partyId;

      // Check if party has a saved shipping address
      const defaultLoc =
        partyShippingAddresses.find((a) => a.is_default) ||
        (partyShippingAddresses.length > 0 ? partyShippingAddresses[0] : null);

      if (defaultLoc && defaultLoc._id !== "default-single") {
        setShippingMode("saved");
        setSelectedSavedId(String(defaultLoc._id || defaultLoc.id || ""));
      } else {
        setShippingMode("same_as_billing");
      }
    }
  }, [partyId, partyShippingAddresses]);

  // Tab switching handler
  const handleModeChange = (mode: "same_as_billing" | "saved" | "custom") => {
    setShippingMode(mode);

    if (mode === "same_as_billing") {
      onShippingAddressChange({
        ...billingAddress,
        label: "Same as Billing",
      });
    } else if (mode === "saved") {
      const target =
        partyShippingAddresses.find((a) => String(a._id || a.id) === selectedSavedId) ||
        partyShippingAddresses.find((a) => a.is_default) ||
        partyShippingAddresses[0];

      if (target) {
        setSelectedSavedId(String(target._id || target.id || ""));
        onShippingAddressChange({
          label: target.label || "Saved Location",
          recipient_name: target.recipient_name || "",
          phone: target.phone || "",
          gst_no: target.gst_no || "",
          address_line_1: target.address_line_1 || "",
          address_line_2: target.address_line_2 || "",
          city: target.city || "",
          state: target.state || "",
          pincode: target.pincode || "",
          country: target.country || "India",
        });
      }
    } else if (mode === "custom") {
      // If we have a draft with address_line_1, use it, otherwise initialize clean form
      const draftToUse = customDraft.address_line_1
        ? customDraft
        : {
            ...emptyOrderAddress,
            label: "New Delivery Location",
            recipient_name: shippingAddress.recipient_name || effectiveParty?.contact_person || "",
            phone: shippingAddress.phone || effectiveParty?.mobile || "",
            country: "India",
          };
      setCustomDraft(draftToUse);
      onShippingAddressChange(draftToUse);
    }
  };

  const handleSavedSelect = (id: string) => {
    setSelectedSavedId(id);
    const target = partyShippingAddresses.find((a) => String(a._id || a.id) === id);
    if (target) {
      onShippingAddressChange({
        label: target.label || "Saved Location",
        recipient_name: target.recipient_name || "",
        phone: target.phone || "",
        gst_no: target.gst_no || "",
        address_line_1: target.address_line_1 || "",
        address_line_2: target.address_line_2 || "",
        city: target.city || "",
        state: target.state || "",
        pincode: target.pincode || "",
        country: target.country || "India",
      });
    }
  };

  const handleBillingFieldChange = (field: keyof OrderAddressData, val: string) => {
    const updated = { ...billingAddress, [field]: val };
    onBillingAddressChange(updated);
    if (shippingMode === "same_as_billing") {
      onShippingAddressChange(updated);
    }
  };

  const handleShippingFieldChange = (field: keyof OrderAddressData, val: string) => {
    const updated = { ...shippingAddress, [field]: val };
    setCustomDraft(updated);
    onShippingAddressChange(updated);
  };

  // Immediate Save to Customer Profile feature
  const handleSaveLocationToCustomerNow = async () => {
    if (!partyId) {
      toast.error("Please select a customer first.");
      return;
    }
    if (!shippingAddress.address_line_1?.trim()) {
      toast.error("Address Line 1 is required to save location.");
      return;
    }
    if (!shippingAddress.city?.trim()) {
      toast.error("City is required to save location.");
      return;
    }

    setIsDirectSaving(true);
    try {
      const existingList = Array.isArray(effectiveParty?.shipping_addresses)
        ? [...effectiveParty.shipping_addresses]
        : [];

      const newLocation: PartyShippingAddress = {
        label: shippingAddress.label?.trim() || `Location #${existingList.length + 1}`,
        recipient_name: shippingAddress.recipient_name?.trim() || "",
        phone: shippingAddress.phone?.trim() || "",
        gst_no: shippingAddress.gst_no?.trim() || "",
        address_line_1: shippingAddress.address_line_1.trim(),
        address_line_2: shippingAddress.address_line_2?.trim() || "",
        city: shippingAddress.city.trim(),
        state: shippingAddress.state?.trim() || "",
        pincode: shippingAddress.pincode?.trim() || "",
        country: shippingAddress.country?.trim() || "India",
        is_default: existingList.length === 0,
      };

      const updatedList = [...existingList, newLocation];

      await patchParty({
        id: partyId,
        patch: {
          shipping_addresses: updatedList,
        },
      }).unwrap();

      toast.success(`Saved "${newLocation.label}" to customer profile!`);
      const refreshed = await refetchParty();

      // Find the newly saved location and switch mode to "saved"
      const refreshedList = (refreshed.data as any)?.shipping_addresses || updatedList;
      const createdItem = refreshedList[refreshedList.length - 1];
      if (createdItem) {
        setSelectedSavedId(String(createdItem._id || createdItem.id || ""));
      }
      setShippingMode("saved");
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to save location to customer");
    } finally {
      setIsDirectSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-blue-600 focus:ring-1 focus:ring-blue-500/20 disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-slate-900/30">
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 dark:border-white/10">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Order Invoicing & Delivery Destination
          </h4>
        </div>
        <span className="text-2xs text-slate-500 dark:text-slate-400">
          Independent snapshot saved with this order
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Billing Address Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Billing Address
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setIsCustomizingBilling(!isCustomizingBilling)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                >
                  <Edit2 className="h-3 w-3" />
                  <span>{isCustomizingBilling ? "Done" : "Customize"}</span>
                </button>
              )}
            </div>

            {isCustomizingBilling && !readOnly ? (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                <div>
                  <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">Address Line 1</label>
                  <input
                    type="text"
                    value={billingAddress.address_line_1 || ""}
                    onChange={(e) => handleBillingFieldChange("address_line_1", e.target.value)}
                    placeholder="Street address, building, premises"
                    disabled={disabled}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">Address Line 2</label>
                  <input
                    type="text"
                    value={billingAddress.address_line_2 || ""}
                    onChange={(e) => handleBillingFieldChange("address_line_2", e.target.value)}
                    placeholder="Floor, suite, landmark (optional)"
                    disabled={disabled}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">City</label>
                    <input
                      type="text"
                      value={billingAddress.city || ""}
                      onChange={(e) => handleBillingFieldChange("city", e.target.value)}
                      placeholder="City"
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">State</label>
                    <input
                      type="text"
                      value={billingAddress.state || ""}
                      onChange={(e) => handleBillingFieldChange("state", e.target.value)}
                      placeholder="State"
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">PIN Code</label>
                    <input
                      type="text"
                      value={billingAddress.pincode || ""}
                      onChange={(e) => handleBillingFieldChange("pincode", e.target.value)}
                      placeholder="Pincode"
                      disabled={disabled}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onBillingAddressChange(partyBilling);
                      if (shippingMode === "same_as_billing") {
                        onShippingAddressChange(partyBilling);
                      }
                    }}
                    className="text-2xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline cursor-pointer"
                  >
                    Reset to Party Default
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {billingAddress.address_line_1 || "No billing address set"}
                </p>
                {billingAddress.address_line_2 && <p>{billingAddress.address_line_2}</p>}
                <p>
                  {[billingAddress.city, billingAddress.state, billingAddress.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {billingAddress.gst_no && (
                  <p className="text-2xs font-semibold text-slate-500 dark:text-slate-400 pt-1">
                    GSTIN: {billingAddress.gst_no}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Shipping Address Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-white/5 mb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Shipping Destination
                </span>
              </div>
              <span className="rounded bg-purple-50 px-2 py-0.5 text-2xs font-semibold text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                {shippingMode === "same_as_billing"
                  ? "Same as Billing"
                  : shippingMode === "saved"
                  ? "Saved Location"
                  : "Custom Location"}
              </span>
            </div>

            {/* Mode Selector Tabs (only when editable) */}
            {!readOnly && (
              <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-2xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => handleModeChange("same_as_billing")}
                  disabled={disabled}
                  className={`flex-1 rounded-md py-1.5 transition cursor-pointer ${
                    shippingMode === "same_as_billing"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Same as Billing
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("saved")}
                  disabled={disabled}
                  className={`flex-1 rounded-md py-1.5 transition cursor-pointer ${
                    shippingMode === "saved"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Saved ({partyShippingAddresses.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("custom")}
                  disabled={disabled}
                  className={`flex-1 rounded-md py-1.5 transition cursor-pointer ${
                    shippingMode === "custom"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                      : "hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  + New Location
                </button>
              </div>
            )}

            {/* Mode 1: Same as billing */}
            {shippingMode === "same_as_billing" && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-slate-800/40 dark:text-slate-400">
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  Shipping goods directly to Billing Address:
                </p>
                <p className="mt-1">
                  {formatAddressOneLine(billingAddress)}
                </p>
              </div>
            )}

            {/* Mode 2: Select from Saved Party Locations */}
            {shippingMode === "saved" && (
              <div>
                {partyShippingAddresses.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-xs dark:border-white/10 dark:bg-slate-800/40">
                    <p className="font-medium text-slate-700 dark:text-slate-300">
                      No saved delivery locations for this customer yet.
                    </p>
                    <p className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
                      You can enter a delivery location or save one to the customer's profile.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleModeChange("custom")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-2xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add New Location
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                        Select Delivery Branch / Warehouse
                      </label>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleModeChange("custom")}
                          disabled={disabled}
                          className="inline-flex items-center gap-1 text-2xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" /> Add Another
                        </button>
                      )}
                    </div>
                    <select
                      value={selectedSavedId}
                      onChange={(e) => handleSavedSelect(e.target.value)}
                      disabled={disabled || readOnly}
                      className={inputClass}
                    >
                      {partyShippingAddresses.map((a) => {
                        const id = String(a._id || a.id || "");
                        return (
                          <option key={id} value={id}>
                            {a.label ? `${a.label} — ` : ""}
                            {a.city || "Site"}, {a.state || ""} {a.is_default ? "(Default)" : ""}
                          </option>
                        );
                      })}
                    </select>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 text-xs dark:border-white/5 dark:bg-slate-800/30">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {shippingAddress.label || "Saved Delivery Location"}
                        </span>
                        {shippingAddress.gst_no && (
                          <span className="text-2xs font-mono text-purple-600 dark:text-purple-400">
                            GST: {shippingAddress.gst_no}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">
                        {shippingAddress.address_line_1}
                        {shippingAddress.address_line_2 ? `, ${shippingAddress.address_line_2}` : ""}
                      </p>
                      <p className="text-slate-600 dark:text-slate-400">
                        {[shippingAddress.city, shippingAddress.state, shippingAddress.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      {(shippingAddress.recipient_name || shippingAddress.phone) && (
                        <p className="mt-1 text-2xs text-slate-500 dark:text-slate-400">
                          Attn: {shippingAddress.recipient_name || "Recipient"}{" "}
                          {shippingAddress.phone ? `(${shippingAddress.phone})` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode 3: Custom / New Shipping Location */}
            {shippingMode === "custom" && (
              <div className="space-y-2.5 animate-in fade-in duration-150">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      Location Label
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.label || ""}
                      onChange={(e) => handleShippingFieldChange("label", e.target.value)}
                      placeholder="e.g. South Depot, Hospital Wing B"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      State GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.gst_no || ""}
                      onChange={(e) => handleShippingFieldChange("gst_no", e.target.value.toUpperCase())}
                      placeholder="Branch GSTIN if distinct"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                    Address Line 1 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.address_line_1 || ""}
                    onChange={(e) => handleShippingFieldChange("address_line_1", e.target.value)}
                    placeholder="Delivery street, gate, building"
                    disabled={disabled || readOnly}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.address_line_2 || ""}
                    onChange={(e) => handleShippingFieldChange("address_line_2", e.target.value)}
                    placeholder="Floor, landmark (optional)"
                    disabled={disabled || readOnly}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      City <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.city || ""}
                      onChange={(e) => handleShippingFieldChange("city", e.target.value)}
                      placeholder="City"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      State
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.state || ""}
                      onChange={(e) => handleShippingFieldChange("state", e.target.value)}
                      placeholder="State"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.pincode || ""}
                      onChange={(e) => handleShippingFieldChange("pincode", e.target.value)}
                      placeholder="PIN"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      Site Contact Person
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.recipient_name || ""}
                      onChange={(e) => handleShippingFieldChange("recipient_name", e.target.value)}
                      placeholder="Name"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-2xs font-medium text-slate-500 dark:text-slate-400">
                      Site Contact Phone
                    </label>
                    <input
                      type="text"
                      value={shippingAddress.phone || ""}
                      onChange={(e) => handleShippingFieldChange("phone", e.target.value)}
                      placeholder="Mobile / Phone"
                      disabled={disabled || readOnly}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
                  {onSaveShippingToPartyChange && !readOnly && (
                    <label className="flex items-center gap-2 cursor-pointer text-2xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={saveShippingToParty}
                        onChange={(e) => onSaveShippingToPartyChange(e.target.checked)}
                        disabled={disabled}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-white/20 dark:bg-slate-900"
                      />
                      <span>Save to customer profile on order create</span>
                    </label>
                  )}

                  {!readOnly && partyId && (
                    <button
                      type="button"
                      onClick={handleSaveLocationToCustomerNow}
                      disabled={disabled || isDirectSaving || !shippingAddress.address_line_1?.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-2xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isDirectSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>{isDirectSaving ? "Saving…" : "Save to Customer Profile Now"}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
