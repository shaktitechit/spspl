"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Star,
  X,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useResolveHelpTicketMutation } from "@/store/api/helpDeskApiSlice";
import type { HelpTicketRecord } from "@/types/helpDesk";

interface ResolveHelpTicketModalProps {
  open: boolean;
  ticket: HelpTicketRecord;
  onClose: () => void;
  onResolved?: () => void;
}

export function ResolveHelpTicketModal({
  open,
  ticket,
  onClose,
  onResolved,
}: ResolveHelpTicketModalProps) {
  const [resolveTicketMut, { isLoading }] = useResolveHelpTicketMutation();

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const ticketId = ticket._id || ticket.id || "";
  const ticketNum = ticket.ticket_number || "HD-TICKET";

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await resolveTicketMut({
        ticketId,
        body: {
          satisfaction_rating: rating,
          resolution_notes: notes.trim() || "Requirement verified and confirmed resolved.",
        },
      }).unwrap();

      toast.success(`Ticket #${ticketNum} marked as Resolved!`);
      onClose();
      if (onResolved) onResolved();
    } catch (err: any) {
      toast.error(err?.data?.message || err?.message || "Failed to resolve ticket");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-ticket-title"
        className="w-full sm:max-w-md max-h-[92vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl border border-emerald-500/30 bg-card shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-emerald-500/10 px-4 sm:px-5 py-3.5 sm:py-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="resolve-ticket-title" className="text-sm sm:text-base font-bold text-foreground truncate">
                Confirm &amp; Resolve Ticket
              </h2>
              <p className="text-[11px] sm:text-xs text-muted truncate">
                Ticket #{ticketNum} &bull; {ticket.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleResolve} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-3.5 text-xs text-foreground leading-relaxed">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Creator Verification
            </p>
            As the ticket creator, your confirmation will officially close this ticket and notify all tagged collaborators.
          </div>

          {/* Satisfaction Rating Stars */}
          <div className="rounded-xl border border-border/80 bg-surface-muted/40 p-3 sm:p-4 text-center space-y-2">
            <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted block">
              Satisfaction Rating
            </label>
            <div className="flex items-center justify-center gap-1.5 sm:gap-3 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (hoverRating !== null ? hoverRating : rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    onClick={() => setRating(star)}
                    className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl hover:bg-amber-500/10 active:scale-90 transition cursor-pointer"
                    title={`${star} Star${star > 1 ? "s" : ""}`}
                    aria-label={`${star} star rating`}
                  >
                    <Star
                      className={`h-7 w-7 sm:h-8 sm:w-8 transition-transform ${
                        isFilled
                          ? "fill-amber-400 text-amber-400 scale-110"
                          : "text-muted/40 stroke-muted scale-95"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <div className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {rating === 5 && "⭐ Excellent Support"}
              {rating === 4 && "👍 Great Resolution"}
              {rating === 3 && "👌 Satisfactory"}
              {rating === 2 && "⚠️ Needs Improvement"}
              {rating === 1 && "❌ Poor"}
            </div>
          </div>

          {/* Closing Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-muted block">
              Closing Remarks / Appreciation Note (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Thanks for the quick approval and delivery, requirements fulfilled perfectly."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted p-3 text-xs font-medium text-foreground placeholder:text-muted outline-none focus:border-emerald-500 resize-none leading-relaxed"
            />
          </div>

          {/* Modal Footer / Sticky on mobile */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              disabled={isLoading}
              onClick={onClose}
              className="w-full sm:w-auto rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted active:scale-[0.98] transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 active:scale-[0.98] transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Confirming...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Confirm &amp; Resolve
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResolveHelpTicketModal;
