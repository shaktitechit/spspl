"use client";

import { useCallback, useEffect, useState } from "react";

import {
  mutationRejectedMessage,
  mutationSuccessCopy,
} from "@/lib/mutationMessages";
import { toast } from "@/lib/toast";
import { PartyContactsEditor } from "@/components/portal/shared/parties/components/PartyContactsEditor";
import {
  contactsEqual,
  contactsFromParty,
  emptyPartyContact,
  sanitizePartyContacts,
  type PartyContact,
} from "@/lib/partyContacts";
import {
  useCreatePartyMutation,
  useGetPartyQuery,
  usePatchPartyMutation,
} from "@/store/api";
import { PartyGeoFields } from "@/components/portal/shared/parties/components/PartyGeoFields";
import { PartyZoneField } from "@/components/portal/shared/parties/components/PartyZoneField";
import { resolvePortalPresentation } from "@/components/portal/shared/shell/portalPresentation";
import { LargeModalPortal } from "@/components/portal/shared/ui/modals/LargeModalPortal";

export type PartyDetailModalProps = {
  partyId: string | null;
  create?: boolean;
  /** When creating, load this party's fields into the form (new record on save). */
  duplicateFromId?: string | null;
  portalHome?: string;
  initialTab?: "details" | "contacts" | "address";
  onClose: () => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-200/95 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-500/25 dark:border-white/15 dark:bg-slate-950 dark:text-slate-50";
const labelClass = "text-xs font-medium text-slate-700 dark:text-slate-300";
const btnSecondaryClass =
  "rounded-lg border border-slate-200/95 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-100 dark:hover:bg-white/5";

const PARTY_TYPE_OPTIONS = [
  "customer",
  "supplier",
  "both",
  "leads",
  "quotation",
  "visits",
] as const;

function stringField(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function valsEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    (a === null || a === undefined || a === "") &&
    (b === null || b === undefined || b === "")
  )
    return true;
  return false;
}

type PartyState = {
  party_name: string;
  party_type: (typeof PARTY_TYPE_OPTIONS)[number];
  contacts: PartyContact[];
  gst_no: string;
  drug_license_no: string;
  district: string;
  state: string;
  country_id: string;
  state_id: string;
  city_id: string;
  zone_id: string;
  payment_terms: string;
  is_active: boolean;
  is_featured: boolean;
  sra: boolean;
  sra_from_date: string;
  sra_to_date: string;
  billing_address: {
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  shipping_address: {
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
};

const defaultPartyState = (): PartyState => ({
  party_name: "",
  party_type: "customer",
  contacts: [emptyPartyContact()],
  gst_no: "",
  drug_license_no: "",
  district: "",
  state: "",
  country_id: "",
  state_id: "",
  city_id: "",
  zone_id: "",
  payment_terms: "",
  is_active: true,
  is_featured: false,
  sra: false,
  sra_from_date: "",
  sra_to_date: "",
  billing_address: {
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  },
  shipping_address: {
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  },
});

function toDateString(v: unknown): string {
  if (v == null || v === "") return "";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function partyToFormState(p: Record<string, unknown>, opts?: { asCopy?: boolean }): PartyState {
  const bAddr = (p.billing_address || {}) as Record<string, unknown>;
  const sAddr = (p.shipping_address || {}) as Record<string, unknown>;
  const loadedContacts = contactsFromParty(p);
  const baseName = stringField(p.party_name);
  return {
    party_name: opts?.asCopy && baseName ? `${baseName} (Copy)` : baseName,
    party_type: (function () {
      const t = String(p.party_type || "").toLowerCase().trim();
      if (t === "lead") return "leads";
      if (t === "quotations") return "quotation";
      if (t === "visit") return "visits";
      return (PARTY_TYPE_OPTIONS as readonly string[]).includes(t)
        ? (t as PartyState["party_type"])
        : "customer";
    })(),
    contacts: loadedContacts.length > 0 ? loadedContacts : [emptyPartyContact()],
    gst_no: stringField(p.gst_no),
    drug_license_no: stringField(p.drug_license_no),
    district: stringField(p.district),
    state: stringField(p.state),
    country_id: p.country_id != null ? String(p.country_id) : "",
    state_id: p.state_id != null ? String(p.state_id) : "",
    city_id: p.city_id != null ? String(p.city_id) : "",
    zone_id: p.zone_id != null ? String(p.zone_id) : "",
    payment_terms: stringField(p.payment_terms),
    is_active: p.is_active !== false,
    is_featured: p.is_featured === true,
    sra: p.sra === true,
    sra_from_date: toDateString(p.sra_from_date),
    sra_to_date: toDateString(p.sra_to_date),
    billing_address: {
      address_line_1: stringField(bAddr.address_line_1),
      address_line_2: stringField(bAddr.address_line_2),
      city: stringField(bAddr.city),
      state: stringField(bAddr.state),
      pincode: stringField(bAddr.pincode),
      country: stringField(bAddr.country) || "India",
    },
    shipping_address: {
      address_line_1: stringField(sAddr.address_line_1),
      address_line_2: stringField(sAddr.address_line_2),
      city: stringField(sAddr.city),
      state: stringField(sAddr.state),
      pincode: stringField(sAddr.pincode),
      country: stringField(sAddr.country) || "India",
    },
  };
}

export function PartyDetailModal({
  partyId,
  create = false,
  duplicateFromId = null,
  portalHome,
  initialTab = "details",
  onClose,
}: PartyDetailModalProps) {
  const isEditing = !create && partyId != null && partyId !== "";
  const isDuplicating = create && !!duplicateFromId;
  const show = create || isEditing;
  const sourcePartyId = isEditing ? (partyId ?? "") : isDuplicating ? (duplicateFromId ?? "") : "";
  const portal = portalHome?.replace("/", "") ?? "";
  const { portalName } = resolvePortalPresentation(portal || "admin");

  // Queries — edit loads partyId; duplicate create loads the source party for prefills
  const { data: rawParty, isFetching } = useGetPartyQuery(sourcePartyId, {
    skip: !sourcePartyId,
  });

  const [createParty, { isLoading: isCreating }] = useCreatePartyMutation();
  const [patchParty, { isLoading: isPatching }] = usePatchPartyMutation();
  const isSaving = isCreating || isPatching;

  // Local Form state
  const [form, setForm] = useState<PartyState>(defaultPartyState());
  const [activeTab, setActiveTab] = useState<"details" | "contacts" | "address">(initialTab);
  const filledContactCount = sanitizePartyContacts(form.contacts).length;

  const syncGeoToBilling = useCallback(
    (names: { country?: string; state?: string; city?: string }) => {
      setForm((f) => ({
        ...f,
        billing_address: {
          ...f.billing_address,
          ...(names.country !== undefined ? { country: names.country || f.billing_address.country } : {}),
          ...(names.state !== undefined ? { state: names.state || f.billing_address.state } : {}),
          ...(names.city !== undefined ? { city: names.city || f.billing_address.city } : {}),
        },
      }));
    },
    []
  );

  // Sync loaded party into form (edit or duplicate-create)
  useEffect(() => {
    if (rawParty && typeof rawParty === "object" && sourcePartyId) {
      setForm(
        partyToFormState(rawParty as Record<string, unknown>, {
          asCopy: isDuplicating,
        }),
      );
    } else if (create && !isDuplicating) {
      setForm(defaultPartyState());
    }
  }, [rawParty, create, isDuplicating, sourcePartyId]);

  // Clean form when modal closes
  useEffect(() => {
    if (!show) {
      setForm(defaultPartyState());
      setActiveTab("details");
    } else {
      setActiveTab(initialTab);
    }
  }, [show, initialTab]);

  // Keyboard shortcut (Escape to close)
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [show, isSaving, onClose]);

  // Submit Handler
  const handleSave = useCallback(async () => {
    if (!form.party_name.trim()) {
      toast.error("Party Name is required");
      return;
    }

    const contacts = sanitizePartyContacts(form.contacts);
    if (!contacts.some((c) => c.phone)) {
      toast.error("At least one contact must have a phone number");
      return;
    }

    const payload = {
      ...form,
      contacts,
      contact_person: contacts[0]?.name ?? "",
      mobile: contacts[0]?.phone ?? "",
      email: contacts[0]?.email ?? "",
      country_id: form.country_id || null,
      state_id: form.state_id || null,
      city_id: form.city_id || null,
      zone_id: form.zone_id || null,
      sra_from_date: form.sra ? (form.sra_from_date || null) : null,
      sra_to_date: form.sra ? (form.sra_to_date || null) : null,
    };

    try {
      if (create) {
        await createParty(payload as any).unwrap();
        toast.success(mutationSuccessCopy("createParty"));
        onClose();
      } else if (partyId) {
        // Calculate minimal diff payload
        const patch: Record<string, any> = {};
        const pObj = rawParty as any;
        const bAddr = pObj.billing_address || {};
        const sAddr = pObj.shipping_address || {};

        if (!valsEqual(form.party_name, pObj.party_name)) patch.party_name = form.party_name;
        if (!valsEqual(form.party_type, pObj.party_type)) patch.party_type = form.party_type;
        if (!contactsEqual(contacts, contactsFromParty(pObj))) {
          patch.contacts = contacts;
          patch.contact_person = contacts[0]?.name ?? "";
          patch.mobile = contacts[0]?.phone ?? "";
          patch.email = contacts[0]?.email ?? "";
        }
        if (!valsEqual(form.gst_no, pObj.gst_no)) patch.gst_no = form.gst_no;
        if (!valsEqual(form.drug_license_no, pObj.drug_license_no)) patch.drug_license_no = form.drug_license_no;
        if (!valsEqual(form.district, pObj.district)) patch.district = form.district;
        if (!valsEqual(form.state, pObj.state)) patch.state = form.state;
        if (!valsEqual(form.country_id || null, pObj.country_id ? String(pObj.country_id) : null)) {
          patch.country_id = form.country_id || null;
        }
        if (!valsEqual(form.state_id || null, pObj.state_id ? String(pObj.state_id) : null)) {
          patch.state_id = form.state_id || null;
        }
        if (!valsEqual(form.city_id || null, pObj.city_id ? String(pObj.city_id) : null)) {
          patch.city_id = form.city_id || null;
        }
        if (!valsEqual(form.zone_id || null, pObj.zone_id ? String(pObj.zone_id) : null)) {
          patch.zone_id = form.zone_id || null;
        }
        if (!valsEqual(form.payment_terms, pObj.payment_terms)) patch.payment_terms = form.payment_terms;
        if (form.is_active !== (pObj.is_active !== false)) patch.is_active = form.is_active;
        if (form.is_featured !== (pObj.is_featured === true)) patch.is_featured = form.is_featured;
        if (form.sra !== pObj.sra) patch.sra = form.sra;
        const nextFromDate = form.sra ? (form.sra_from_date || null) : null;
        if (!valsEqual(nextFromDate, pObj.sra_from_date ? toDateString(pObj.sra_from_date) : null)) {
          patch.sra_from_date = nextFromDate;
        }
        const nextToDate = form.sra ? (form.sra_to_date || null) : null;
        if (!valsEqual(nextToDate, pObj.sra_to_date ? toDateString(pObj.sra_to_date) : null)) {
          patch.sra_to_date = nextToDate;
        }

        // Address diff
        const billingDiff: Record<string, any> = {};
        for (const [k, v] of Object.entries(form.billing_address)) {
          if (!valsEqual(v, bAddr[k])) billingDiff[k] = v;
        }
        if (Object.keys(billingDiff).length > 0) {
          patch.billing_address = { ...bAddr, ...billingDiff };
        }

        const shippingDiff: Record<string, any> = {};
        for (const [k, v] of Object.entries(form.shipping_address)) {
          if (!valsEqual(v, sAddr[k])) shippingDiff[k] = v;
        }
        if (Object.keys(shippingDiff).length > 0) {
          patch.shipping_address = { ...sAddr, ...shippingDiff };
        }

        if (Object.keys(patch).length === 0) {
          toast.info("No modifications detected");
          onClose();
          return;
        }

        await patchParty({ id: partyId, patch }).unwrap();
        toast.success(mutationSuccessCopy("patchParty"));
        onClose();
      }
    } catch (rejected) {
      toast.error(mutationRejectedMessage(rejected));
    }
  }, [form, create, partyId, rawParty, createParty, patchParty, onClose]);

  const copyBillingToShipping = () => {
    setForm((f) => ({
      ...f,
      shipping_address: { ...f.billing_address },
    }));
    toast.success("Billing address copied to shipping!");
  };

  if (!show) return null;

  return (
    <LargeModalPortal>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={() => !isSaving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(90dvh,750px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-4 dark:border-white/10">
          <div>
            {portalHome ? (
              <span className="mb-1 inline-flex rounded bg-slate-900 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-white dark:bg-white dark:text-slate-900">
                {portalName}
              </span>
            ) : null}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {create
                ? isDuplicating
                  ? isFetching
                    ? "Loading…"
                    : "Duplicate Party"
                  : "Add Party"
                : isFetching
                  ? "Loading Details..."
                  : form.party_name || "Party Detail"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {create
                ? isDuplicating
                  ? "Review the copied details, then save as a new party"
                  : "Create customer or supplier profile"
                : "View or edit contact and location records"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200/90 px-5 dark:border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab("details")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "details"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Basic Info & Licenses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("contacts")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "contacts"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Contacts
            {filledContactCount > 0 ? (
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-2xs font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {filledContactCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("address")}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === "address"
                ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            Addresses
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 min-h-0">
          {isFetching && !create ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading profile data...</p>
          ) : activeTab === "contacts" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Add department contacts with phone, email, and alternate numbers. The first contact is used as the primary contact across the directory.
              </p>
              <PartyContactsEditor
                contacts={form.contacts}
                onChange={(contacts) => setForm((f) => ({ ...f, contacts }))}
                disabled={isSaving}
              />
            </div>
          ) : activeTab === "details" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className={labelClass}>Party Name *</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Apollo Pharmacy / Cipla Ltd"
                  value={form.party_name}
                  onChange={(e) => setForm((f) => ({ ...f, party_name: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Party Type</label>
                <select
                  className={inputClass}
                  value={form.party_type}
                  onChange={(e) => setForm((f) => ({ ...f, party_type: e.target.value as any }))}
                  disabled={isSaving}
                >
                  <option value="customer">Customer (Hospital / Retailer)</option>
                  <option value="supplier">Supplier (Distributor / Manufacturer)</option>
                  <option value="both">Both (Customer & Supplier)</option>
                  <option value="leads">Leads</option>
                  <option value="quotation">Quotation</option>
                  <option value="visits">Visits</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className={labelClass}>GSTIN</label>
                <input
                  type="text"
                  className={`${inputClass} uppercase`}
                  placeholder="e.g. 07AAAAA1111A1Z1"
                  value={form.gst_no}
                  onChange={(e) => setForm((f) => ({ ...f, gst_no: e.target.value.toUpperCase() }))}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1">
                <label className={labelClass}>Drug License No</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. DL-12345/6789"
                  value={form.drug_license_no}
                  onChange={(e) => setForm((f) => ({ ...f, drug_license_no: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <PartyGeoFields
                value={{
                  country_id: form.country_id,
                  state_id: form.state_id,
                  city_id: form.city_id,
                  state: form.state,
                  district: form.district,
                }}
                onChange={(geo) =>
                  setForm((f) => ({
                    ...f,
                    country_id: geo.country_id,
                    state_id: geo.state_id,
                    city_id: geo.city_id,
                    state: geo.state,
                    district: geo.district ?? f.district,
                  }))
                }
                onSyncAddressNames={syncGeoToBilling}
                inputClass={inputClass}
                labelClass={labelClass}
                disabled={isSaving}
              />

              <PartyZoneField
                zoneId={form.zone_id}
                onChange={(zone_id) => setForm((f) => ({ ...f, zone_id }))}
                inputClass={inputClass}
                labelClass={labelClass}
                disabled={isSaving}
              />

              <div className="space-y-1">
                <label className={labelClass}>Payment Terms (Days / Type)</label>
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Net 30, Cash on Delivery"
                  value={form.payment_terms}
                  onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
                  disabled={isSaving}
                />
              </div>

              <div className="flex flex-wrap items-center gap-6 mt-7 md:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="party-active"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-950 cursor-pointer"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    disabled={isSaving}
                  />
                  <label htmlFor="party-active" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Is Active Profile
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="party-featured"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-950 cursor-pointer"
                    checked={form.is_featured}
                    onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                    disabled={isSaving}
                  />
                  <label htmlFor="party-featured" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Featured Party
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="party-sra"
                    className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 dark:border-white/10 dark:bg-slate-950 cursor-pointer"
                    checked={form.sra}
                    onChange={(e) => setForm((f) => ({ ...f, sra: e.target.checked }))}
                    disabled={isSaving}
                  />
                  <label htmlFor="party-sra" className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                    SRA (Special Rate Approval)
                  </label>
                </div>
              </div>

              {form.sra && (
                <div className="grid grid-cols-2 gap-4 w-full md:col-span-2 pt-3 border-t border-slate-100 dark:border-white/5">
                  <div className="space-y-1">
                    <label className={labelClass}>SRA From Date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.sra_from_date}
                      onChange={(e) => setForm((f) => ({ ...f, sra_from_date: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>SRA To Date</label>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.sra_to_date}
                      onChange={(e) => setForm((f) => ({ ...f, sra_to_date: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-4 rounded-xl border border-slate-200/90 p-4 dark:border-white/10 dark:bg-slate-950/20">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Geography</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PartyGeoFields
                    value={{
                      country_id: form.country_id,
                      state_id: form.state_id,
                      city_id: form.city_id,
                      state: form.state,
                      district: form.district,
                    }}
                    onChange={(geo) =>
                      setForm((f) => ({
                        ...f,
                        country_id: geo.country_id,
                        state_id: geo.state_id,
                        city_id: geo.city_id,
                        state: geo.state,
                        district: geo.district ?? f.district,
                      }))
                    }
                    onSyncAddressNames={(names) => {
                      setForm((f) => ({
                        ...f,
                        billing_address: {
                          ...f.billing_address,
                          ...(names.country !== undefined ? { country: names.country || f.billing_address.country } : {}),
                          ...(names.state !== undefined ? { state: names.state || f.billing_address.state } : {}),
                          ...(names.city !== undefined ? { city: names.city || f.billing_address.city } : {}),
                        },
                        shipping_address: {
                          ...f.shipping_address,
                          ...(names.country !== undefined ? { country: names.country || f.shipping_address.country } : {}),
                          ...(names.state !== undefined ? { state: names.state || f.shipping_address.state } : {}),
                          ...(names.city !== undefined ? { city: names.city || f.shipping_address.city } : {}),
                        },
                      }));
                    }}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    disabled={isSaving}
                  />
                  <PartyZoneField
                    zoneId={form.zone_id}
                    onChange={(zone_id) => setForm((f) => ({ ...f, zone_id }))}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    disabled={isSaving}
                  />
                </div>
              </div>
              {/* Billing address */}
              <div className="space-y-4 rounded-xl border border-slate-200/90 p-4 dark:border-white/10 dark:bg-slate-950/20">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Billing Address</h3>
                <p className="text-2xs text-slate-500">City, state, and country follow geography selections above.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClass}>Address Line 1</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.billing_address.address_line_1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billing_address: { ...f.billing_address, address_line_1: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.billing_address.address_line_2}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billing_address: { ...f.billing_address, address_line_2: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>City</label>
                    <input type="text" className={inputClass} value={form.billing_address.city} readOnly disabled />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>State</label>
                    <input type="text" className={inputClass} value={form.billing_address.state} readOnly disabled />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Pincode</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.billing_address.pincode}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          billing_address: { ...f.billing_address, pincode: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Country</label>
                    <input type="text" className={inputClass} value={form.billing_address.country} readOnly disabled />
                  </div>
                </div>
              </div>

              {/* Action trigger copy */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={copyBillingToShipping}
                  className="rounded bg-blue-50/50 border border-blue-200 text-blue-700 px-3 py-1.5 text-xs font-semibold hover:bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400"
                >
                  Copy to Shipping Address ↓
                </button>
              </div>

              {/* Shipping address */}
              <div className="space-y-4 rounded-xl border border-slate-200/90 p-4 dark:border-white/10 dark:bg-slate-950/20">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Shipping Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClass}>Address Line 1</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.address_line_1}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, address_line_1: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClass}>Address Line 2</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.address_line_2}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, address_line_2: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>City</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.city}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, city: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>State</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.state}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, state: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Pincode</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.pincode}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, pincode: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Country</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={form.shipping_address.country}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          shipping_address: { ...f.shipping_address, country: e.target.value },
                        }))
                      }
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-slate-200/90 px-5 py-3.5 dark:border-white/10">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className={btnSecondaryClass}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || (isDuplicating && isFetching)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {isSaving
              ? "Saving..."
              : create
                ? isDuplicating
                  ? "Create Duplicate"
                  : "Add Party"
                : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
    </LargeModalPortal>
  );
}
