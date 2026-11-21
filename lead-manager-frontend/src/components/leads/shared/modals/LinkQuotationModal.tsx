/**
 * @fileoverview Modal dialog to link an existing or directly created quotation to a lead.
 * @module components/leads/shared/modals/LinkQuotationModal
 */
"use client";

import React, { useState, useMemo } from "react";
import {
  Link2,
  X,
  Search,
  CheckCircle2,
  FileText,
  AlertCircle,
  Building2,
  Calendar,
  Sparkles,
  Loader2,
  DollarSign,
  Layers,
} from "lucide-react";
import { ModalOverlay } from "@/components/portal/shared/ModalOverlay";
import {
  useListQuotationsQuery,
  useLinkQuotationToLeadMutation,
  type LeadRecord,
  type QuotationRecord,
} from "@/store/api";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { formatCurrencyINR, formatLeadDate } from "../../leadUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadRecord;
  portalHome?: string;
  onSuccess?: () => void;
};

type FilterMode = "unlinked" | "matching" | "all";

export function LinkQuotationModal({
  isOpen,
  onClose,
  lead,
  portalHome = "/dashboard",
  onSuccess,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("unlinked");
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  const { data: quotations = [], isLoading: isLoadingQuotations } = useListQuotationsQuery({
    limit: "all",
  });

  const [linkQuotationToLead, { isLoading: isLinking }] = useLinkQuotationToLeadMutation();

  // Clean customer/company names for matching
  const leadCompanyName = (lead.company_name || "").toLowerCase().trim();
  const leadContactName = (lead.name || "").toLowerCase().trim();
  const leadPhone = (lead.phone || "").replace(/\D/g, "");
  const leadEmail = (lead.email || "").toLowerCase().trim();
  const leadPartyId =
    typeof lead.party_id === "object" && lead.party_id !== null
      ? (lead.party_id as any)._id
      : String(lead.party_id || "");

  // Helper to determine if a quotation is linked to ANY lead
  const getQuotationLeadId = (q: QuotationRecord): string | null => {
    if (!q.lead) return null;
    if (typeof q.lead === "object" && q.lead !== null) {
      return (q.lead as any)._id || null;
    }
    return String(q.lead);
  };

  const getQuotationLeadNo = (q: QuotationRecord): string | null => {
    if (!q.lead) return null;
    if (typeof q.lead === "object" && q.lead !== null) {
      return (q.lead as any).lead_no || null;
    }
    return null;
  };

  // Filter quotations
  const filteredQuotations = useMemo(() => {
    const list: QuotationRecord[] = Array.isArray(quotations)
      ? quotations
      : (quotations as any)?.quotations || (quotations as any)?.items || [];
    return list.filter((q) => {
      const qLeadId = getQuotationLeadId(q);
      const isCurrentlyLinkedToThisLead = qLeadId === String(lead._id);
      const isUnlinked = !qLeadId;

      // Filter Mode filter
      if (filterMode === "unlinked") {
        if (!isUnlinked) return false;
      } else if (filterMode === "matching") {
        const qCust = (q.customer_name || "").toLowerCase();
        const qAttn = (q.kind_attn || "").toLowerCase();
        const qPhone = (q.phone || q.cell || "").replace(/\D/g, "");
        const qEmail = (q.email || "").toLowerCase();
        const qParty = q.party_id ? String(q.party_id) : "";

        const nameMatch =
          (leadCompanyName && qCust.includes(leadCompanyName)) ||
          (leadCompanyName && leadCompanyName.includes(qCust)) ||
          (leadContactName && qAttn.includes(leadContactName));
        const phoneMatch = leadPhone && qPhone && (qPhone.includes(leadPhone) || leadPhone.includes(qPhone));
        const emailMatch = leadEmail && qEmail && qEmail === leadEmail;
        const partyMatch = leadPartyId && qParty && qParty === leadPartyId;

        const isMatch = Boolean(nameMatch || phoneMatch || emailMatch || partyMatch);
        if (!isMatch) return false;
      }

      // Search Query filter
      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const qNo = (q.quotation_no || "").toLowerCase();
        const refNo = (q.ref_no || "").toLowerCase();
        const cust = (q.customer_name || "").toLowerCase();
        const subj = (q.subject || "").toLowerCase();

        const matchesSearch =
          qNo.includes(query) || refNo.includes(query) || cust.includes(query) || subj.includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [quotations, filterMode, search, lead, leadCompanyName, leadContactName, leadPhone, leadEmail, leadPartyId]);

  // Matching unlinked count for badge
  const matchingCount = useMemo(() => {
    return quotations.filter((q) => {
      const qCust = (q.customer_name || "").toLowerCase();
      const qAttn = (q.kind_attn || "").toLowerCase();
      const qPhone = (q.phone || q.cell || "").replace(/\D/g, "");
      const qEmail = (q.email || "").toLowerCase();
      const qParty = q.party_id ? String(q.party_id) : "";

      const nameMatch =
        (leadCompanyName && qCust.includes(leadCompanyName)) ||
        (leadCompanyName && leadCompanyName.includes(qCust)) ||
        (leadContactName && qAttn.includes(leadContactName));
      const phoneMatch = leadPhone && qPhone && (qPhone.includes(leadPhone) || leadPhone.includes(qPhone));
      const emailMatch = leadEmail && qEmail && qEmail === leadEmail;
      const partyMatch = leadPartyId && qParty && qParty === leadPartyId;

      return Boolean(nameMatch || phoneMatch || emailMatch || partyMatch);
    }).length;
  }, [quotations, leadCompanyName, leadContactName, leadPhone, leadEmail, leadPartyId]);

  const unlinkedCount = useMemo(() => {
    return quotations.filter((q) => !getQuotationLeadId(q)).length;
  }, [quotations]);

  const selectedQuotation = useMemo(() => {
    return quotations.find((q) => q._id === selectedQuotationId) || null;
  }, [quotations, selectedQuotationId]);

  if (!isOpen) return null;

  const handleLink = async () => {
    if (!selectedQuotationId) {
      toast.error("Please select a quotation to link");
      return;
    }

    try {
      await linkQuotationToLead({
        quotationId: selectedQuotationId,
        leadId: lead._id,
      }).unwrap();

      const qNo = selectedQuotation?.quotation_no || "Quotation";
      toast.success(`${qNo} linked to Lead #${lead.lead_no} successfully!`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(mutationRejectedMessage(err) || "Failed to link quotation");
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-border bg-card shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground truncate">
                  Link Quotation to Lead
                </h3>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20 shrink-0">
                  #{lead.lead_no}
                </span>
              </div>
              <p className="text-xs text-muted truncate">
                Attach an existing or directly created quotation to {lead.name}
                {lead.company_name ? ` (${lead.company_name})` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="space-y-3 border-b border-border/60 bg-surface-muted/20 px-6 py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 p-0.5 bg-surface-muted rounded-xl border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setFilterMode("unlinked")}
                className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                  filterMode === "unlinked"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Unlinked ({unlinkedCount})
              </button>
              {matchingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode("matching")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                    filterMode === "matching"
                      ? "bg-card text-foreground shadow-2xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>Matching ({matchingCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMode("all")}
                className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                  filterMode === "all"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted hover:text-foreground"
                }`}
              >
                All Quotes ({quotations.length})
              </button>
            </div>

            {selectedQuotation && (
              <span className="text-xs font-semibold text-primary">
                1 quotation selected
              </span>
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by quotation number, ref, subject, customer name..."
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quotations List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 min-h-[260px] max-h-[380px]">
          {isLoadingQuotations ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted space-y-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs">Loading available quotations...</p>
            </div>
          ) : filteredQuotations.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-muted">
                <FileText className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">
                No quotations found
              </p>
              <p className="text-[11px] text-muted max-w-sm mx-auto">
                {filterMode === "unlinked"
                  ? "There are no unlinked quotations available. If the quotation is linked to another lead, switch to 'All Quotes' above to find and re-link it."
                  : filterMode === "matching"
                  ? "No unlinked quotations found matching this lead's customer name, phone, or email."
                  : "No quotation matched your search query."}
              </p>
            </div>
          ) : (
            filteredQuotations.map((q) => {
              const isSelected = selectedQuotationId === q._id;
              const qLeadId = getQuotationLeadId(q);
              const isAlreadyLinkedHere = qLeadId === String(lead._id);
              const linkedLeadNo = getQuotationLeadNo(q);

              return (
                <div
                  key={q._id}
                  onClick={() => {
                    if (isAlreadyLinkedHere) return;
                    setSelectedQuotationId(isSelected ? null : q._id);
                  }}
                  className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 text-xs transition cursor-pointer ${
                    isAlreadyLinkedHere
                      ? "border-border/40 bg-surface-muted/20 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs"
                      : "border-border bg-card hover:border-primary/40 hover:bg-surface-muted/30"
                  }`}
                >
                  {/* Left: Indicator & Quotation info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-border/80 bg-card group-hover:border-primary/60"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-foreground">
                          {q.quotation_no || q.ref_no || "Quotation"}
                        </span>
                        {q.ref_no && q.ref_no !== q.quotation_no && (
                          <span className="text-[10px] text-muted font-mono">
                            Ref: {q.ref_no}
                          </span>
                        )}
                        <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                          v{q.version || 1}
                        </span>
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 dark:text-purple-300">
                          {q.status}
                        </span>
                        {isAlreadyLinkedHere && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Already linked to this lead
                          </span>
                        )}
                        {!isAlreadyLinkedHere && qLeadId && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                            Linked to Lead #{linkedLeadNo || qLeadId.slice(-6)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                        {q.customer_name && (
                          <span className="font-medium text-foreground/80 flex items-center gap-1">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{q.customer_name}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>{formatLeadDate(q.quotation_date)}</span>
                        </span>
                        {q.items && q.items.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{q.items.length} item{q.items.length > 1 ? "s" : ""}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-7 sm:pl-0 shrink-0">
                    <span className="text-xs font-bold text-foreground">
                      {formatCurrencyINR(q.grand_total || 0)}
                    </span>
                    {q.valid_until && (
                      <span className="text-[10px] text-muted">
                        Valid: {formatLeadDate(q.valid_until)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Quotation Impact Notice */}
        {selectedQuotation && (
          <div className="border-t border-border/80 bg-primary/5 px-6 py-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Ready to link {selectedQuotation.quotation_no || "Quotation"}</span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Linking will associate this quotation with Lead #{lead.lead_no}, advance lead pipeline to{" "}
              <strong className="text-foreground">Quotation</strong> stage (if open), and sync the estimated value to{" "}
              <strong className="text-foreground">{formatCurrencyINR(selectedQuotation.grand_total || 0)}</strong>.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-card rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleLink}
            disabled={!selectedQuotationId || isLinking}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
          >
            {isLinking ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Linking...</span>
              </>
            ) : (
              <>
                <Link2 className="h-3.5 w-3.5" />
                <span>Link Quotation</span>
              </>
            )}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
