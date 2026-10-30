"use client";

import { useState, useMemo, useEffect } from "react";
import { Mail, Plus, X, Users, Building2, Check, UserCheck } from "lucide-react";

export type WorkflowEmailScope =
  | "order_submit"
  | "admin_approval"
  | "due_sheet_upload"
  | "finance_approval"
  | "account_approval"
  | "dispatch_created"
  | "dispatch_submitted"
  | "transport_assigned"
  | "in_transit"
  | "delivered"
  | "on_hold"
  | "cancelled"
  | "rejected";

export type WorkflowEmailOptions = {
  send_email: boolean;
  send_to_party?: boolean;
  recipients: string[];
};

export type EmailSuggestionItem = {
  email: string;
  label: string;
  role: string;
  category: "party" | "sales" | "admin" | "finance" | "account" | "dispatch" | "custom";
};

type Props = {
  scope: WorkflowEmailScope;
  party?: Record<string, any> | null;
  order?: Record<string, any> | null;
  users?: Array<Record<string, any>>;
  value: WorkflowEmailOptions;
  onChange: (next: WorkflowEmailOptions) => void;
  title?: string;
  compact?: boolean;
};

const SCOPE_DESCRIPTIONS: Record<
  WorkflowEmailScope,
  { title: string; subtitle: string; showPartyToggle: boolean; defaultPartyChecked: boolean; targetRoles: string[] }
> = {
  order_submit: {
    title: "Order Submission Email",
    subtitle: "Notify Admin team for approval review",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["admin", "super_admin", "sales"],
  },
  admin_approval: {
    title: "Admin Approval Email",
    subtitle: "Notify Sales & Accounts (Due Sheet Pending)",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "account", "finance", "admin"],
  },
  due_sheet_upload: {
    title: "Due Sheet Uploaded Email",
    subtitle: "Notify Finance team that order is ready for Finance Approval",
    showPartyToggle: false,
    defaultPartyChecked: false,
    targetRoles: ["finance", "account", "admin"],
  },
  finance_approval: {
    title: "Finance Decision Email",
    subtitle: "Notify Accounts / Sales team on finance approval or rejection",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["account", "sales", "finance", "admin"],
  },
  account_approval: {
    title: "Account Approval Email",
    subtitle: "Notify Dispatch & Sales team that order is cleared for dispatch",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["dispatch", "sales", "account", "admin"],
  },
  dispatch_created: {
    title: "Dispatch Created Email",
    subtitle: "Notify internal team & customer about dispatch batch creation",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["dispatch", "sales", "account"],
  },
  dispatch_submitted: {
    title: "Dispatch Billed & Submitted Email",
    subtitle: "Send invoice & dispatch confirmation to selected recipients",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "dispatch", "account"],
  },
  transport_assigned: {
    title: "Transport Assigned Email",
    subtitle: "Send LR / carrier & shipment details",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "dispatch"],
  },
  in_transit: {
    title: "Order In-Transit Email",
    subtitle: "Notify recipients that shipment is on the way",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "dispatch"],
  },
  delivered: {
    title: "Order Delivered Email",
    subtitle: "Send delivery confirmation notification",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "account", "admin"],
  },
  on_hold: {
    title: "Order On-Hold Alert",
    subtitle: "Notify Sales & stakeholders that order has been put on hold",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "admin", "finance", "account"],
  },
  cancelled: {
    title: "Order Cancellation Alert",
    subtitle: "Notify stakeholders about order cancellation",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "admin", "finance", "account", "dispatch"],
  },
  rejected: {
    title: "Order Rejection Alert",
    subtitle: "Notify Sales & team about rejection reason",
    showPartyToggle: true,
    defaultPartyChecked: false,
    targetRoles: ["sales", "admin", "finance", "account"],
  },
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function WorkflowEmailControls({
  scope,
  party,
  order,
  users = [],
  value,
  onChange,
  title,
  compact = false,
}: Props) {
  const [customEmail, setCustomEmail] = useState("");
  const meta = SCOPE_DESCRIPTIONS[scope] || SCOPE_DESCRIPTIONS.order_submit;

  // Extract party emails (main email + contacts[] emails)
  const partyEmails = useMemo<EmailSuggestionItem[]>(() => {
    const p = party || (order?.party && typeof order.party === "object" ? order.party : null);
    if (!p) return [];
    const list: EmailSuggestionItem[] = [];
    const seen = new Set<string>();

    const mainEmail = String(p.email ?? "").trim();
    const partyName = String(p.party_name ?? p.name ?? "Customer").trim();
    if (mainEmail && isValidEmail(mainEmail)) {
      seen.add(mainEmail.toLowerCase());
      list.push({
        email: mainEmail,
        label: `${partyName} (Primary)`,
        role: "Customer",
        category: "party",
      });
    }

    if (Array.isArray(p.contacts)) {
      p.contacts.forEach((c: any) => {
        const ce = String(c?.email ?? "").trim();
        if (ce && isValidEmail(ce) && !seen.has(ce.toLowerCase())) {
          seen.add(ce.toLowerCase());
          const cName = String(c?.name ?? "Contact").trim();
          const cDesig = String(c?.designation ?? c?.department ?? "").trim();
          list.push({
            email: ce,
            label: `${cName}${cDesig ? ` · ${cDesig}` : ""}`,
            role: "Party Contact",
            category: "party",
          });
        }
      });
    }

    return list;
  }, [party, order]);

  // Extract relevant internal team emails
  const teamSuggestions = useMemo<EmailSuggestionItem[]>(() => {
    const list: EmailSuggestionItem[] = [];
    const seen = new Set<string>();

    // 1. Assigned sales user from order
    const assignedSales =
      order?.assigned_sales_user && typeof order.assigned_sales_user === "object"
        ? order.assigned_sales_user
        : null;
    if (assignedSales?.email && isValidEmail(String(assignedSales.email))) {
      const em = String(assignedSales.email).trim();
      seen.add(em.toLowerCase());
      list.push({
        email: em,
        label: String(assignedSales.name || assignedSales.username || em),
        role: "Assigned Sales",
        category: "sales",
      });
    }

    // 2. Users from directory matching targetRoles or any active user with email
    users.forEach((u) => {
      if (u.is_active === false) return;
      const em = String(u.email ?? "").trim();
      if (!em || !isValidEmail(em) || seen.has(em.toLowerCase())) return;

      const dept = String(u.department ?? "").toLowerCase();
      seen.add(em.toLowerCase());
      list.push({
        email: em,
        label: String(u.name || u.username || em),
        role: dept ? dept.toUpperCase() : "STAFF",
        category: (["sales", "admin", "finance", "account", "dispatch"].includes(dept)
          ? dept
          : "admin") as EmailSuggestionItem["category"],
      });
    });

    // Sort so targetRoles for this scope appear first
    const prioritySet = new Set(meta.targetRoles);
    return list.sort((a, b) => {
      const aPri = prioritySet.has(a.category) ? 0 : 1;
      const bPri = prioritySet.has(b.category) ? 0 : 1;
      return aPri - bPri;
    });
  }, [order, users, meta.targetRoles]);

  // When send_to_party is toggled ON, auto-add primary party email into recipients if not present
  useEffect(() => {
    if (value.send_to_party && partyEmails.length > 0) {
      const primary = partyEmails[0].email;
      const exists = value.recipients.some((r) => r.toLowerCase() === primary.toLowerCase());
      if (!exists) {
        onChange({
          ...value,
          recipients: [...value.recipients, primary],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.send_to_party]);

  const toggleRecipient = (email: string) => {
    const clean = email.trim();
    const exists = value.recipients.some((r) => r.toLowerCase() === clean.toLowerCase());
    const nextRecipients = exists
      ? value.recipients.filter((r) => r.toLowerCase() !== clean.toLowerCase())
      : [...value.recipients, clean];

    onChange({
      ...value,
      recipients: nextRecipients,
    });
  };

  const handleAddCustomEmail = () => {
    const parts = customEmail
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;

    const validNew: string[] = [];
    for (const p of parts) {
      if (isValidEmail(p)) {
        const already = value.recipients.some((r) => r.toLowerCase() === p.toLowerCase());
        if (!already && !validNew.some((v) => v.toLowerCase() === p.toLowerCase())) {
          validNew.push(p);
        }
      }
    }

    if (validNew.length > 0) {
      onChange({
        ...value,
        send_email: true,
        recipients: [...value.recipients, ...validNew],
      });
      setCustomEmail("");
    }
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        value.send_email
          ? "border-teal-200/90 bg-teal-50/25"
          : "border-slate-200 bg-slate-50/60"
      } ${compact ? "p-3" : "p-4"}`}
    >
      {/* Top Bar: Toggle Send Email */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={value.send_email}
            onChange={(e) =>
              onChange({
                ...value,
                send_email: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <div className="flex items-center gap-2">
            <Mail
              className={`h-4 w-4 ${
                value.send_email ? "text-teal-600" : "text-slate-400"
              }`}
            />
            <div>
              <span className="text-xs font-bold text-slate-900">
                {title || meta.title}
              </span>
              {!compact && (
                <p className="text-[11px] text-slate-500">{meta.subtitle}</p>
              )}
            </div>
          </div>
        </label>

        {/* Send to Customer / Party Toggle */}
        {value.send_email && meta.showPartyToggle && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">
            <input
              type="checkbox"
              checked={Boolean(value.send_to_party)}
              onChange={(e) => {
                const checked = e.target.checked;
                let nextRecips = [...value.recipients];
                if (!checked) {
                  const partySet = new Set(partyEmails.map((pe) => pe.email.toLowerCase()));
                  nextRecips = nextRecips.filter((r) => !partySet.has(r.toLowerCase()));
                }
                onChange({
                  ...value,
                  send_to_party: checked,
                  recipients: nextRecips,
                });
              }}
              className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <Building2 className="h-3.5 w-3.5 text-indigo-600" />
            <span>Also send to Party / Customer</span>
          </label>
        )}
      </div>

      {/* Expanded Controls when send_email is enabled */}
      {value.send_email && (
        <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3">
          {/* Selected Recipients Pills */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Selected Recipients ({value.recipients.length || "Default System Recipients"})
              </span>
              {value.recipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ ...value, recipients: [] })}
                  className="text-[10px] font-semibold text-slate-500 hover:text-red-600"
                >
                  Reset to Default
                </button>
              )}
            </div>

            {value.recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-500">
                No custom override selected — will send to default configured department email(s). Pick below or add any email to customize.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {value.recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-2.5 py-0.5 text-xs font-medium text-teal-900 shadow-2xs"
                  >
                    <Mail className="h-3 w-3 text-teal-600" />
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => toggleRecipient(email)}
                      className="rounded-full p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add Custom Email Input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomEmail();
                }
              }}
              placeholder="Add custom email(s) — comma separated, press Enter..."
              className="h-8 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/15"
            />
            <button
              type="button"
              onClick={handleAddCustomEmail}
              disabled={!customEmail.trim()}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>

          {/* Quick-Pick Suggestions: Party Contacts & Internal Team */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {/* Party / Customer Contacts */}
            {partyEmails.length > 0 && (
              <div className="rounded-lg border border-slate-200/80 bg-white p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                  <Building2 className="h-3 w-3" />
                  Party / Customer Emails
                </div>
                <div className="flex flex-wrap gap-1">
                  {partyEmails.map((item) => {
                    const active = value.recipients.some(
                      (r) => r.toLowerCase() === item.email.toLowerCase()
                    );
                    return (
                      <button
                        key={item.email}
                        type="button"
                        onClick={() => toggleRecipient(item.email)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                          active
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100"
                        }`}
                        title={item.email}
                      >
                        {active && <Check className="h-3 w-3 text-indigo-600" />}
                        <span className="max-w-[160px] ">{item.label}</span>
                        <span className="text-[10px] text-slate-400">({item.email})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Internal Team Suggestions */}
            {teamSuggestions.length > 0 && (
              <div
                className={`rounded-lg border border-slate-200/80 bg-white p-2.5 ${
                  partyEmails.length === 0 ? "sm:col-span-2" : ""
                }`}
              >
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-teal-700">
                  <Users className="h-3 w-3" />
                  Quick-Select Team Members
                </div>
                <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {teamSuggestions.slice(0, 12).map((item) => {
                    const active = value.recipients.some(
                      (r) => r.toLowerCase() === item.email.toLowerCase()
                    );
                    return (
                      <button
                        key={item.email}
                        type="button"
                        onClick={() => toggleRecipient(item.email)}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100"
                        }`}
                        title={`${item.label} (${item.email})`}
                      >
                        {active ? (
                          <Check className="h-3 w-3 text-teal-600" />
                        ) : (
                          <UserCheck className="h-3 w-3 text-slate-400" />
                        )}
                        <span className="max-w-[130px] ">{item.label}</span>
                        <span className="rounded bg-slate-200/70 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                          {item.role}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

