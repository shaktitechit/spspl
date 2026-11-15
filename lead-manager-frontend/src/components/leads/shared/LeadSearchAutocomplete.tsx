"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { LeadRecord } from "@/store/api";

type Props = {
  leads: LeadRecord[];
  selectedLeadId: string;
  onSelect: (leadId: string) => void;
};

/** Searchable autocomplete for linking a quotation to an existing lead. */
export function LeadSearchAutocomplete({ leads, selectedLeadId, onSelect }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLead = useMemo(() => {
    if (!selectedLeadId) return null;
    return leads.find((l) => String(l._id) === String(selectedLeadId)) || null;
  }, [leads, selectedLeadId]);

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return leads.slice(0, 50);
    return leads
      .filter((l) => {
        const no = String(l.lead_no || "").toLowerCase();
        const name = String(l.name || "").toLowerCase();
        const company = String(l.company_name || (l as { organization_name?: string }).organization_name || "").toLowerCase();
        const phone = String(l.phone || "").toLowerCase();
        const email = String(l.email || "").toLowerCase();
        const req = String(l.requirement || "").toLowerCase();
        const city = String(l.billing_address?.city || "").toLowerCase();
        return (
          no.includes(q) ||
          name.includes(q) ||
          company.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          req.includes(q) ||
          city.includes(q)
        );
      })
      .slice(0, 50);
  }, [leads, search]);

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
              if (filteredLeads.length > 0) {
                onSelect(filteredLeads[0]._id);
                setIsOpen(false);
                setSearch("");
              }
            } else if (e.key === "Escape") {
              setIsOpen(false);
            }
          }}
          placeholder={
            selectedLead
              ? `Linked Lead: ${selectedLead.company_name || selectedLead.name} (${selectedLead.lead_no || "Active"}) - Search to change...`
              : "Search active leads by lead #, company name, contact person, mobile, email, requirement..."
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
            <span>Lead Directory ({filteredLeads.length} found)</span>
            <span className="text-[9px] text-slate-400 lowercase">click to select lead</span>
          </div>

          <button
            type="button"
            onClick={() => {
              onSelect("");
              setIsOpen(false);
              setSearch("");
            }}
            className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${
              !selectedLeadId ? "bg-primary/10 font-bold text-primary" : "text-slate-700 dark:text-slate-300"
            }`}
          >
            <div>
              <span className="font-bold">-- Direct Quotation (Standalone Proposal) --</span>
              <p className="text-[10px] text-slate-400 font-normal">Generate quotation directly without linking to a lead</p>
            </div>
            {!selectedLeadId && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </button>

          {filteredLeads.length === 0 ? (
            <div className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching leads found for &quot;{search}&quot;
            </div>
          ) : (
            filteredLeads.map((l) => {
              const isSelected = l._id === selectedLeadId;
              const org = l.company_name || (l as { organization_name?: string }).organization_name || l.name;
              return (
                <button
                  key={l._id}
                  type="button"
                  onClick={() => {
                    onSelect(l._id);
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
                      <span className="font-bold text-slate-900 dark:text-white truncate">{org}</span>
                      {l.lead_no && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {l.lead_no}
                        </span>
                      )}
                      {l.status && (
                        <span className="rounded-full bg-blue-50 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 capitalize dark:bg-blue-950 dark:text-blue-300">
                          {l.status}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {l.name && <span>👤 {l.name}</span>}
                    {l.phone && <span>📞 {l.phone}</span>}
                    {l.requirement && <span className="truncate max-w-[200px]">📋 {l.requirement}</span>}
                    {l.billing_address?.city && <span>📍 {l.billing_address.city}</span>}
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
