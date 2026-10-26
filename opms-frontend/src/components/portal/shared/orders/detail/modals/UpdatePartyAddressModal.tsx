"use client";

import { useEffect, useState } from "react";
import {
  MapPin,
  Building2,
  Truck,
  Copy,
  Check,
  X,
  Loader2,
  AlertCircle,
  BookmarkCheck,
  Plus,
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import {
  usePatchPartyMutation,
  usePatchOrderMutation,
  type PartyShippingAddress,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";

export interface AddressFormState {
  address_line_1: string;
  address_line_2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  [key: string]: unknown;
}

const emptyAddress: AddressFormState = {
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
};

export interface UpdatePartyAddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyId: string;
  partyName: string;
  orderId?: string;
  isLocked?: boolean;
  initialBillingAddress?: Record<string, unknown>;
  initialShippingAddress?: Record<string, unknown>;
  shippingAddresses?: PartyShippingAddress[];
  onSuccess?: () => void;
}

function parseAddress(addr?: Record<string, unknown>): AddressFormState {
  if (!addr || typeof addr !== "object") return { ...emptyAddress };
  return {
    address_line_1: String(addr.address_line_1 || ""),
    address_line_2: String(addr.address_line_2 || ""),
    city: String(addr.city || ""),
    state: String(addr.state || ""),
    pincode: String(addr.pincode || ""),
    country: String(addr.country || "India"),
  };
}

export default function UpdatePartyAddressModal({
  isOpen,
  onClose,
  partyId,
  partyName,
  orderId,
  isLocked = false,
  initialBillingAddress,
  initialShippingAddress,
  shippingAddresses = [],
  onSuccess,
}: UpdatePartyAddressModalProps) {
  const [patchParty, { isLoading: isPatchingParty }] = usePatchPartyMutation();
  const [patchOrder, { isLoading: isPatchingOrder }] = usePatchOrderMutation();
  const isSaving = isPatchingParty || isPatchingOrder;

  const [billing, setBilling] = useState<AddressFormState>(emptyAddress);
  const [shipping, setShipping] = useState<AddressFormState>(emptyAddress);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string>("custom");

  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [syncToParty, setSyncToParty] = useState(false);
  const [saveAsNewPartyLocation, setSaveAsNewPartyLocation] = useState(false);
  const [newLocationLabel, setNewLocationLabel] = useState("");
  const [justCopied, setJustCopied] = useState(false);

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      const b = parseAddress(initialBillingAddress);
      const s = parseAddress(initialShippingAddress);
      setBilling(b);
      setShipping(s);
      setRecipientName(String(initialShippingAddress?.recipient_name || ""));
      setRecipientPhone(String(initialShippingAddress?.phone || ""));
      setGstNo(String(initialShippingAddress?.gst_no || ""));

      // Check if billing and shipping match identically
      const isIdentical =
        b.address_line_1 === s.address_line_1 &&
        b.address_line_2 === s.address_line_2 &&
        b.city === s.city &&
        b.state === s.state &&
        b.pincode === s.pincode &&
        Boolean(b.address_line_1);

      setSameAsBilling(isIdentical);
      setSelectedSavedId("custom");
      setSyncToParty(false);
      setSaveAsNewPartyLocation(false);
      setNewLocationLabel("");
      setJustCopied(false);
    }
  }, [isOpen, initialBillingAddress, initialShippingAddress]);

  if (!isOpen) return null;

  const handleBillingChange = (field: keyof AddressFormState, value: string) => {
    const updated = { ...billing, [field]: value };
    setBilling(updated);
    if (sameAsBilling) {
      setShipping(updated);
    }
  };

  const handleShippingChange = (field: keyof AddressFormState, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
    setSelectedSavedId("custom");
    if (sameAsBilling) {
      setSameAsBilling(false);
    }
  };

  const handleToggleSameAsBilling = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setShipping({ ...billing });
      setSelectedSavedId("custom");
    }
  };

  const handleSelectSavedLocation = (addrId: string) => {
    setSelectedSavedId(addrId);
    if (addrId === "custom") return;

    const found = shippingAddresses.find(
      (a) => String(a._id || a.id) === addrId,
    );
    if (found) {
      setShipping({
        address_line_1: found.address_line_1 || "",
        address_line_2: found.address_line_2 || "",
        city: found.city || "",
        state: found.state || "",
        pincode: found.pincode || "",
        country: found.country || "India",
      });
      setRecipientName(found.recipient_name || "");
      setRecipientPhone(found.phone || "");
      setGstNo(found.gst_no || "");
      setSameAsBilling(false);
    }
  };

  const handleManualCopy = () => {
    setShipping({ ...billing });
    setSelectedSavedId("custom");
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      toast.error("This order is locked from modifications.");
      return;
    }
    if (!partyId && !orderId) {
      toast.error("Missing party or order reference.");
      return;
    }

    if (!billing.address_line_1.trim() && !shipping.address_line_1.trim()) {
      toast.error("Please provide at least Address Line 1 for Billing or Shipping.");
      return;
    }

    try {
      const shippingToSave = sameAsBilling
        ? { ...billing }
        : {
            ...shipping,
            recipient_name: recipientName.trim() || undefined,
            phone: recipientPhone.trim() || undefined,
            gst_no: gstNo.trim() || undefined,
          };

      // 1. If orderId is present, patch the order snapshot
      if (orderId) {
        await patchOrder({
          id: orderId,
          patch: {
            billing_address: billing,
            shipping_address: shippingToSave,
          },
        }).unwrap();
      }

      // 2. If no orderId OR user requested sync to party profile
      if (!orderId || syncToParty || saveAsNewPartyLocation) {
        if (partyId) {
          const partyPatch: Record<string, unknown> = {};

          if (!orderId || syncToParty) {
            partyPatch.billing_address = billing;
            partyPatch.shipping_address = shippingToSave;
            if (billing.state || shippingToSave.state) {
              partyPatch.state = billing.state || shippingToSave.state;
            }
          }

          if (saveAsNewPartyLocation && !sameAsBilling && shippingToSave.address_line_1) {
            const newEntry: PartyShippingAddress = {
              label: newLocationLabel.trim() || `Delivery - ${shippingToSave.city || "Location"}`,
              recipient_name: recipientName.trim() || undefined,
              phone: recipientPhone.trim() || undefined,
              gst_no: gstNo.trim() || undefined,
              address_line_1: shippingToSave.address_line_1,
              address_line_2: shippingToSave.address_line_2,
              city: shippingToSave.city,
              state: shippingToSave.state,
              pincode: shippingToSave.pincode,
              country: shippingToSave.country,
              is_default: false,
            };
            partyPatch.shipping_addresses = [...shippingAddresses, newEntry];
          }

          if (Object.keys(partyPatch).length > 0) {
            await patchParty({
              id: partyId,
              patch: partyPatch,
            }).unwrap();
          }
        }
      }

      toast.success(
        orderId
          ? "Order addresses updated successfully"
          : "Party addresses updated successfully",
      );
      onSuccess?.();
      onClose();
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:disabled:bg-slate-900/50";
  const labelClass =
    "block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1";

  return (
    <LargeModalPortal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]">
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[92vh] flex flex-col font-sans overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {orderId ? "Update Order Delivery & Billing Address" : "Update Master Party Address"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {orderId ? (
                    <>
                      Order delivery for{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {partyName || "Party"}
                      </span>
                    </>
                  ) : (
                    <>
                      Updating default address for{" "}
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {partyName || "Party"}
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200 cursor-pointer disabled:opacity-50"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Content */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ── Billing Address Section ── */}
              <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/30 p-4.5 dark:border-white/10 dark:bg-slate-950/20">
                <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2.5 dark:border-white/10">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                    Billing Address
                  </h4>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className={labelClass}>
                      Address Line 1 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Flat / Building / Street address"
                      className={inputClass}
                      value={billing.address_line_1}
                      onChange={(e) =>
                        handleBillingChange("address_line_1", e.target.value)
                      }
                      disabled={isSaving || isLocked}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      type="text"
                      placeholder="Area / Sector / Landmark"
                      className={inputClass}
                      value={billing.address_line_2}
                      onChange={(e) =>
                        handleBillingChange("address_line_2", e.target.value)
                      }
                      disabled={isSaving || isLocked}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        type="text"
                        placeholder="City"
                        className={inputClass}
                        value={billing.city}
                        onChange={(e) =>
                          handleBillingChange("city", e.target.value)
                        }
                        disabled={isSaving || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        type="text"
                        placeholder="State"
                        className={inputClass}
                        value={billing.state}
                        onChange={(e) =>
                          handleBillingChange("state", e.target.value)
                        }
                        disabled={isSaving || isLocked}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Pincode / ZIP</label>
                      <input
                        type="text"
                        placeholder="e.g. 110001"
                        className={inputClass}
                        value={billing.pincode}
                        onChange={(e) =>
                          handleBillingChange("pincode", e.target.value)
                        }
                        disabled={isSaving || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Country</label>
                      <input
                        type="text"
                        placeholder="Country"
                        className={inputClass}
                        value={billing.country}
                        onChange={(e) =>
                          handleBillingChange("country", e.target.value)
                        }
                        disabled={isSaving || isLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Shipping Address Section ── */}
              <div className="space-y-4 rounded-xl border border-slate-200/90 bg-slate-50/30 p-4.5 dark:border-white/10 dark:bg-slate-950/20">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                      Shipping / Delivery Address
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualCopy}
                    disabled={isSaving || isLocked}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition cursor-pointer"
                    title="Copy all billing address fields to shipping"
                  >
                    {justCopied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Billing</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Same as billing toggle */}
                <div className="flex items-center gap-2 rounded-lg bg-white p-2.5 border border-slate-200/70 dark:border-white/5 dark:bg-slate-900/60">
                  <input
                    type="checkbox"
                    id="sameAsBillingModalCheckbox"
                    checked={sameAsBilling}
                    onChange={(e) =>
                      handleToggleSameAsBilling(e.target.checked)
                    }
                    disabled={isSaving || isLocked}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <label
                    htmlFor="sameAsBillingModalCheckbox"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Same as Billing Address
                  </label>
                </div>

                {/* Saved party locations picker */}
                {!sameAsBilling && shippingAddresses.length > 0 && (
                  <div className="rounded-lg bg-blue-50/40 p-2.5 border border-blue-100 dark:border-blue-900/30 dark:bg-blue-950/20 space-y-1.5">
                    <label className="block text-2xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      Load from Party's Saved Delivery Locations ({shippingAddresses.length})
                    </label>
                    <select
                      value={selectedSavedId}
                      onChange={(e) => handleSelectSavedLocation(e.target.value)}
                      disabled={isSaving || isLocked}
                      className={inputClass}
                    >
                      <option value="custom">-- Custom / Unlinked Address --</option>
                      {shippingAddresses.map((a, idx) => {
                        const id = String(a._id || a.id || idx);
                        const label = a.label || `Location #${idx + 1}`;
                        const locSummary = [a.city, a.state].filter(Boolean).join(", ");
                        return (
                          <option key={id} value={id}>
                            {label} {locSummary ? `(${locSummary})` : ""} {a.is_default ? "★ Default" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div>
                    <label className={labelClass}>
                      Address Line 1 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Delivery location / Warehouse / Clinic"
                      className={inputClass}
                      value={shipping.address_line_1}
                      onChange={(e) =>
                        handleShippingChange("address_line_1", e.target.value)
                      }
                      disabled={isSaving || sameAsBilling || isLocked}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      type="text"
                      placeholder="Area / Sector / Landmark"
                      className={inputClass}
                      value={shipping.address_line_2}
                      onChange={(e) =>
                        handleShippingChange("address_line_2", e.target.value)
                      }
                      disabled={isSaving || sameAsBilling || isLocked}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>City</label>
                      <input
                        type="text"
                        placeholder="City"
                        className={inputClass}
                        value={shipping.city}
                        onChange={(e) =>
                          handleShippingChange("city", e.target.value)
                        }
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>State</label>
                      <input
                        type="text"
                        placeholder="State"
                        className={inputClass}
                        value={shipping.state}
                        onChange={(e) =>
                          handleShippingChange("state", e.target.value)
                        }
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Pincode / ZIP</label>
                      <input
                        type="text"
                        placeholder="e.g. 110001"
                        className={inputClass}
                        value={shipping.pincode}
                        onChange={(e) =>
                          handleShippingChange("pincode", e.target.value)
                        }
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Country</label>
                      <input
                        type="text"
                        placeholder="Country"
                        className={inputClass}
                        value={shipping.country}
                        onChange={(e) =>
                          handleShippingChange("country", e.target.value)
                        }
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                  </div>

                  {/* Optional Recipient info for shipping */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className={labelClass}>Recipient Contact</label>
                      <input
                        type="text"
                        placeholder="Contact person"
                        className={inputClass}
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Recipient Phone</label>
                      <input
                        type="text"
                        placeholder="Phone number"
                        className={inputClass}
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Location GSTIN</label>
                      <input
                        type="text"
                        placeholder="State GSTIN"
                        className={inputClass}
                        value={gstNo}
                        onChange={(e) => setGstNo(e.target.value.toUpperCase())}
                        disabled={isSaving || sameAsBilling || isLocked}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync to Master Profile controls when updating an Order */}
            {orderId && (
              <div className="space-y-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-slate-950/40 text-xs">
                <div className="flex items-start gap-2">
                  <BookmarkCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Order Snapshot Independence
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Changes here are saved directly to this specific order's transport & billing snapshot. Other existing or future orders will remain unaffected.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={syncToParty}
                          onChange={(e) => setSyncToParty(e.target.checked)}
                          disabled={isSaving || isLocked}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium">
                          Also update customer's default master addresses
                        </span>
                      </label>

                      {!sameAsBilling && selectedSavedId === "custom" && (
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={saveAsNewPartyLocation}
                            onChange={(e) => setSaveAsNewPartyLocation(e.target.checked)}
                            disabled={isSaving || isLocked}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                          />
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            Save as a new delivery location on party profile
                          </span>
                        </label>
                      )}
                    </div>

                    {saveAsNewPartyLocation && (
                      <div className="pt-2 max-w-sm">
                        <label className={labelClass}>Delivery Location Label</label>
                        <input
                          type="text"
                          placeholder="e.g. South Delhi Clinic / Central Warehouse"
                          value={newLocationLabel}
                          onChange={(e) => setNewLocationLabel(e.target.value)}
                          className={inputClass}
                          disabled={isSaving || isLocked}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!orderId && (
              <div className="flex items-center gap-2 rounded-xl bg-blue-50/50 p-3 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span>
                  Changes saved here update the customer's master record and will be reflected on future orders and dispatch planning.
                </span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5 cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isLocked}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {isSaving
                    ? "Saving..."
                    : orderId
                      ? "Update Order Addresses"
                      : "Update Addresses"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}
