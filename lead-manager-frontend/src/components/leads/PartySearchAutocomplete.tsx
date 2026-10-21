"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";

export type PartyItem = {
  _id?: string;
  id?: string;
  party_name?: string;
  party_code?: string;
  party_type?: "customer" | "supplier" | "both" | string;
  contact_person?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  contacts?: Array<{
    name?: string;
    department?: string;
    designation?: string;
    phone?: string;
    email?: string;
    alternate_phone?: string;
  }>;
  gst_no?: string;
  billing_address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    country_id?: string;
    state_id?: string;
    city_id?: string;
  };
  district?: string;
  city?: string;
  state?: string;
  country?: string;
  country_id?: string;
  state_id?: string;
  city_id?: string;
  sra?: boolean;
};

export function pickParties(raw: unknown): PartyItem[] {
  if (Array.isArray(raw)) return raw as PartyItem[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as PartyItem[];
    if (Array.isArray(o.data)) return o.data as PartyItem[];
    if (Array.isArray(o.parties)) return o.parties as PartyItem[];
  }
  return [];
}

type Props = {
  parties: PartyItem[];
  selectedPartyId: string;
  onSelect: (party: PartyItem | null) => void;
};

/** Searchable autocomplete over Party Service `/api/parties` list. */
export function PartySearchAutocomplete({ parties, selectedPartyId, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedParty = useMemo(() => {
    if (!selectedPartyId) return null;
    return parties.find((p) => String(p._id ?? p.id ?? "") === String(selectedPartyId)) || null;
  }, [parties, selectedPartyId]);

  const filteredParties = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parties.slice(0, 50);
    return parties
      .filter((p) => {
        const name = String(p.party_name || "").toLowerCase();
        const code = String(p.party_code || "").toLowerCase();
        const person = String(p.contact_person || "").toLowerCase();
        const mobile = String(p.mobile || p.phone || "").toLowerCase();
        const email = String(p.email || "").toLowerCase();
        const city = String(p.billing_address?.city || p.district || "").toLowerCase();
        const gst = String(p.gst_no || "").toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          person.includes(q) ||
          mobile.includes(q) ||
          email.includes(q) ||
          city.includes(q) ||
          gst.includes(q)
        );
      })
      .slice(0, 50);
  }, [parties, search]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (filteredParties.length > 0) {
                onSelect(filteredParties[0]);
                setIsOpen(false);
                setSearch("");
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={
            selectedParty
              ? `Linked: ${selectedParty.party_name} (Search to change party...)`
              : "Search Party Master by party name, contact person, mobile, city, GSTIN..."
          }
          className="w-full rounded-xl border border-primary/30 bg-white py-2 pl-9 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 shadow-2xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-slate-900 dark:text-white"
        />
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-primary">
          <Search className="h-3.5 w-3.5" />
        </div>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-slate-900">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span>Party Master Directory ({filteredParties.length} found)</span>
            <span className="text-[9px] text-slate-400 lowercase">click to select & autofill</span>
          </div>
          {filteredParties.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching parties found for &quot;{search}&quot;
            </div>
          ) : (
            filteredParties.map((p) => {
              const id = String(p._id ?? p.id ?? "");
              const isSelected = id === selectedPartyId;
              const location = [p.billing_address?.city || p.district, p.billing_address?.state || p.state]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`flex w-full flex-col px-3 py-2 text-left text-xs transition border-b border-slate-50 dark:border-white/5 last:border-0 hover:bg-primary/10 cursor-pointer ${
                    isSelected
                      ? "bg-primary/15 font-medium text-primary"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-900 dark:text-white truncate">
                        {p.party_name}
                      </span>
                      {p.party_code && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {p.party_code}
                        </span>
                      )}
                      {p.party_type && (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600 capitalize dark:bg-slate-800 dark:text-slate-300">
                          {p.party_type}
                        </span>
                      )}
                      {p.sra === true && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                          SRA
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {(p.contact_person || (p.contacts && p.contacts[0]?.name)) && (
                      <span>👤 {p.contact_person || p.contacts?.[0]?.name}</span>
                    )}
                    {(p.mobile || p.phone || (p.contacts && p.contacts[0]?.phone)) && (
                      <span>📞 {p.mobile || p.phone || p.contacts?.[0]?.phone}</span>
                    )}
                    {location && <span>📍 {location}</span>}
                    {p.gst_no && <span className="font-mono text-[10px]">GST: {p.gst_no}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
