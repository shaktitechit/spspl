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
} from "lucide-react";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";
import { usePatchPartyMutation } from "@/store/api";
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
  initialBillingAddress?: Record<string, unknown>;
  initialShippingAddress?: Record<string, unknown>;
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
  initialBillingAddress,
  initialShippingAddress,
  onSuccess,
}: UpdatePartyAddressModalProps) {
  const [patchParty, { isLoading: isSaving }] = usePatchPartyMutation();

  const [billing, setBilling] = useState<AddressFormState>(emptyAddress);
  const [shipping, setShipping] = useState<AddressFormState>(emptyAddress);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      const b = parseAddress(initialBillingAddress);
      const s = parseAddress(initialShippingAddress);
      setBilling(b);
      setShipping(s);

      // Check if billing and shipping match identically
      const isIdentical =
        b.address_line_1 === s.address_line_1 &&
        b.address_line_2 === s.address_line_2 &&
        b.city === s.city &&
        b.state === s.state &&
        b.pincode === s.pincode &&
        Boolean(b.address_line_1);

      setSameAsBilling(isIdentical);
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
    if (sameAsBilling) {
      setSameAsBilling(false);
    }
  };

  const handleToggleSameAsBilling = (checked: boolean) => {
    setSameAsBilling(checked);
    if (checked) {
      setShipping({ ...billing });
    }
  };

  const handleManualCopy = () => {
    setShipping({ ...billing });
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Party reference missing. Cannot update address.");
      return;
    }

    // Require at least address_line_1 on billing or shipping if filled
    if (!billing.address_line_1.trim() && !shipping.address_line_1.trim()) {
      toast.error("Please provide at least Address Line 1 for Billing or Shipping.");
      return;
    }

    try {
      const shippingToSave = sameAsBilling ? { ...billing } : shipping;

      await patchParty({
        id: partyId,
        patch: {
          billing_address: billing,
          shipping_address: shippingToSave,
          // Sync state & city at top-level if present
          state: billing.state || shippingToSave.state || undefined,
        },
      }).unwrap();

      toast.success("Party billing & shipping addresses updated successfully");
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
        <div className="w-full max-w-4xl rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 transition-all max-h-[90vh] flex flex-col font-sans overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-white/5 bg-slate-50/50 dark:bg-slate-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Update Billing & Shipping Address
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Updating address for{" "}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {partyName || "Party"}
                  </span>
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
                      disabled={isSaving}
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
                      disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                        disabled={isSaving}
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
                      Shipping Address
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleManualCopy}
                    disabled={isSaving}
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
                    id="sameAsBillingCheckbox"
                    checked={sameAsBilling}
                    onChange={(e) =>
                      handleToggleSameAsBilling(e.target.checked)
                    }
                    disabled={isSaving}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                  />
                  <label
                    htmlFor="sameAsBillingCheckbox"
                    className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Same as Billing Address
                  </label>
                </div>

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
                      disabled={isSaving || sameAsBilling}
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
                      disabled={isSaving || sameAsBilling}
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
                        disabled={isSaving || sameAsBilling}
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
                        disabled={isSaving || sameAsBilling}
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
                        disabled={isSaving || sameAsBilling}
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
                        disabled={isSaving || sameAsBilling}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-blue-50/50 p-3 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
              <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
              <span>
                Changes saved here update the customer's master record and will be reflected on future dispatch slips, transport planning, and order invoices.
              </span>
            </div>

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
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isSaving ? "Saving..." : "Update Addresses"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </LargeModalPortal>
  );
}
