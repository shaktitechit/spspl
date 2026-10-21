"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Mail,
  Check,
  Plus,
  Users,
  Building2,
  UserCheck,
  Truck,
  FileSpreadsheet,
  DollarSign,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useListUsersQuery, useGetPartyQuery } from "@/store/api";
import { contactsFromParty } from "@/lib/partyContacts";

export type WorkflowEmailScope =
  | "submit"
  | "admin_approve"
  | "admin_reject"
  | "due_sheet"
  | "finance_approve"
  | "finance_reject"
  | "account_approve"
  | "account_reject"
  | "dispatch"
  | "transport"
  | "in_transit"
  | "delivered"
  | "on_hold"
  | "cancelled"
  | "generic";

export type WorkflowEmailOptions = {
  send_email: boolean;
  send_to_party?: boolean;
  recipients: string[];
  custom_note?: string;
};

export interface WorkflowEmailControlsProps {
  order?: any;
  party?: any;
  scope: WorkflowEmailScope;
  value: WorkflowEmailOptions;
  onChange: (next: WorkflowEmailOptions) => void;
  compact?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

type CandidateRecipient = {
  id: string;
  email: string;
  label: string;
  sublabel?: string;
  group: "party" | "stakeholder" | "department" | "custom";
  isParty?: boolean;
  icon?: React.ReactNode;
};

export function WorkflowEmailControls({
  order,
  party,
  scope,
  value,
  onChange,
  compact = false,
  className = "",
  defaultExpanded = true,
}: WorkflowEmailControlsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [customInput, setCustomInput] = useState("");
  const [customEmails, setCustomEmails] = useState<string[]>([]);

  const { data: usersData } = useListUsersQuery();

  // Extract company users by department
  const usersList = useMemo(() => {
    if (!usersData) return [];
    if (Array.isArray(usersData)) return usersData;
    if (typeof usersData === "object") {
      const obj = usersData as Record<string, unknown>;
      if (Array.isArray(obj.data)) return obj.data;
      if (Array.isArray(obj.items)) return obj.items;
      if (Array.isArray(obj.users)) return obj.users;
    }
    return [];
  }, [usersData]);

  // 1. Resolve party ID from props or order
  const partyId = useMemo(() => {
    if (party) {
      if (typeof party === "string" && party.trim()) return party.trim();
      if (typeof party === "object") {
        const id = party._id || party.id;
        if (id) return String(id);
      }
    }
    if (order) {
      if (typeof order.party === "string" && order.party.trim()) {
        return order.party.trim();
      }
      if (order.party && typeof order.party === "object") {
        const id = order.party._id || order.party.id;
        if (id) return String(id);
      }
      if (order.party_id) return String(order.party_id).trim();
      if (order.partyId) return String(order.partyId).trim();
    }
    return null;
  }, [order, party]);

  // 2. Check if a populated party object was already passed in props
  const propPartyObj = useMemo(() => {
    const candidate =
      party && typeof party === "object"
        ? party
        : order?.party && typeof order.party === "object"
          ? order.party
          : null;
    if (
      candidate &&
      (candidate.party_name || candidate.name || candidate.contacts || candidate.email)
    ) {
      return candidate;
    }
    return null;
  }, [party, order]);

  // 3. Query party if not provided as a populated object
  const { data: queriedPartyData, isLoading: isPartyLoading } = useGetPartyQuery(partyId || "", {
    skip: Boolean(propPartyObj) || !partyId,
  });

  // 4. Effective party object
  const effectiveParty = useMemo(() => {
    if (propPartyObj) return propPartyObj;
    if (queriedPartyData && typeof queriedPartyData === "object") {
      const q = queriedPartyData as Record<string, unknown>;
      if (q.data && typeof q.data === "object" && !Array.isArray(q.data)) return q.data;
      if (q.party && typeof q.party === "object" && !Array.isArray(q.party)) return q.party;
      return q;
    }
    return null;
  }, [propPartyObj, queriedPartyData]);

  // Extract party details, supporting all contacts of the party
  const partyInfo = useMemo(() => {
    if (effectiveParty) {
      const p = effectiveParty;
      const partyName =
        p.party_name || p.name || order?.customer_name || "Customer";
      const rawPrimaryEmail =
        typeof p.email === "string" ? p.email.trim().toLowerCase() : "";
      const primaryEmail =
        rawPrimaryEmail && rawPrimaryEmail.includes("@") ? rawPrimaryEmail : "";

      const rawContacts = contactsFromParty(p);
      const allContacts: Array<{
        id: string;
        name: string;
        email: string;
        department?: string;
        phone?: string;
        hasEmail: boolean;
        isPrimary?: boolean;
      }> = [];
      const seenEmails = new Set<string>();

      // If party has a primary email, include it first
      if (primaryEmail) {
        seenEmails.add(primaryEmail);
        allContacts.push({
          id: `party-primary-${primaryEmail}`,
          name: (p.contact_person as string) || partyName,
          email: primaryEmail,
          department: "Primary / Office",
          phone: (p.mobile as string) || "",
          hasEmail: true,
          isPrimary: true,
        });
      }

      // Add each contact from contacts list
      rawContacts.forEach((c, idx) => {
        const em = c.email?.trim().toLowerCase() || "";
        const hasEm = Boolean(em && em.includes("@"));
        if (hasEm && seenEmails.has(em)) {
          return;
        }
        if (hasEm) seenEmails.add(em);
        allContacts.push({
          id: `party-contact-${idx}-${em || c.phone || c.name}`,
          name: c.name || `Contact ${idx + 1}`,
          email: em,
          department: c.department || "",
          phone: c.phone || "",
          hasEmail: hasEm,
          isPrimary: false,
        });
      });

      const contactsWithEmail = allContacts.filter((c) => c.hasEmail && c.email);
      const allPartyEmails = contactsWithEmail.map((c) => c.email);

      return {
        name: partyName,
        primaryEmail,
        allContacts,
        contactsWithEmail,
        allPartyEmails,
        hasEmail: allPartyEmails.length > 0,
      };
    }

    if (order?.customer_email) {
      const email = String(order.customer_email).trim().toLowerCase();
      if (email && email.includes("@")) {
        const single = {
          id: `party-cust-${email}`,
          name: order.customer_name || "Customer",
          email,
          department: "Customer Email",
          phone: "",
          hasEmail: true,
          isPrimary: true,
        };
        return {
          name: order.customer_name || "Customer",
          primaryEmail: email,
          allContacts: [single],
          contactsWithEmail: [single],
          allPartyEmails: [email],
          hasEmail: true,
        };
      }
    }

    return null;
  }, [effectiveParty, order]);

  // Selected party contacts count
  const selectedPartyCount = useMemo(() => {
    if (!partyInfo?.allPartyEmails || !value.recipients) return 0;
    return partyInfo.allPartyEmails.filter((em) =>
      value.recipients.some((r) => r.toLowerCase() === em.toLowerCase())
    ).length;
  }, [partyInfo, value.recipients]);

  // Resolve assigned sales user whose order this is (ONLY sales user associated with this order)
  const assignedSalesUser = useMemo(() => {
    const rawSales = order?.assigned_sales_user;
    if (rawSales && typeof rawSales === "object" && rawSales.email) {
      return rawSales;
    }
    const salesId =
      typeof rawSales === "string"
        ? rawSales
        : rawSales?._id || rawSales?.id || order?.assigned_sales_user_id || null;

    if (salesId) {
      const found = usersList.find((u: any) => String(u._id || u.id) === String(salesId));
      if (found) return found;
    }

    // Fallback: order created_by if created_by is a sales representative
    if (order?.created_by) {
      const createdId =
        typeof order.created_by === "object"
          ? order.created_by._id || order.created_by.id
          : order.created_by;
      if (createdId) {
        const found = usersList.find(
          (u: any) => String(u._id || u.id) === String(createdId) && u?.department === "sales"
        );
        if (found) return found;
      }
    }
    return null;
  }, [order, usersList]);

  // Extract candidate recipients from order, party contacts, and company roster
  const candidateRecipients = useMemo<CandidateRecipient[]>(() => {
    const list: CandidateRecipient[] = [];
    const seen = new Set<string>();

    const addRecipient = (
      email: string,
      label: string,
      sublabel?: string,
      group: CandidateRecipient["group"] = "stakeholder",
      isParty = false,
      icon?: React.ReactNode
    ) => {
      const clean = email?.trim().toLowerCase();
      if (!clean || !clean.includes("@") || seen.has(clean)) return;
      seen.add(clean);
      list.push({
        id: clean,
        email: clean,
        label,
        sublabel,
        group,
        isParty,
        icon,
      });
    };

    // 1. Party / Customer contacts (all contacts with email)
    if (partyInfo?.contactsWithEmail && partyInfo.contactsWithEmail.length > 0) {
      partyInfo.contactsWithEmail.forEach((c) => {
        const sub = [c.department, c.phone].filter(Boolean).join(" • ") || "Party Contact";
        addRecipient(
          c.email,
          `Party: ${c.name}`,
          sub,
          "party",
          true,
          <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        );
      });
    }

    // 2. Assigned Sales User (ONLY the sales user whose order this is)
    if (assignedSalesUser && assignedSalesUser.email) {
      addRecipient(
        assignedSalesUser.email,
        `Sales: ${assignedSalesUser.name || "Order Sales Rep"}`,
        "Order Sales Rep",
        "stakeholder",
        false,
        <UserCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
      );
    }

    // 3. Assigned Finance User
    const finance = order?.assigned_finance_user;
    if (finance && typeof finance === "object" && finance.email) {
      addRecipient(
        finance.email,
        `Finance: ${finance.name || "Assigned"}`,
        "Finance Assignee",
        "stakeholder",
        false,
        <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      );
    }

    // 4. Assigned Accounts User
    const account = order?.assigned_account_user;
    if (account && typeof account === "object" && account.email) {
      addRecipient(
        account.email,
        `Accounts: ${account.name || "Assigned"}`,
        "Accounts Assignee",
        "stakeholder",
        false,
        <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500 shrink-0" />
      );
    }

    // 5. Department users from roster (Admin, Finance, Accounts, Dispatch - NO generic sales roster)
    const adminUsers = usersList.filter(
      (u: any) => u?.department === "admin" || u?.department === "super_admin"
    );
    const financeUsers = usersList.filter((u: any) => u?.department === "finance");
    const accountUsers = usersList.filter((u: any) => u?.department === "account");
    const dispatchUsers = usersList.filter((u: any) => u?.department === "dispatch");

    adminUsers.forEach((u: any) => {
      if (u.email)
        addRecipient(
          u.email,
          `Admin: ${u.name}`,
          "Admin Team",
          "department",
          false,
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        );
    });
    financeUsers.forEach((u: any) => {
      if (u.email)
        addRecipient(
          u.email,
          `Finance: ${u.name}`,
          "Finance Team",
          "department",
          false,
          <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        );
    });
    accountUsers.forEach((u: any) => {
      if (u.email)
        addRecipient(
          u.email,
          `Accounts: ${u.name}`,
          "Accounts Team",
          "department",
          false,
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-500 shrink-0" />
        );
    });
    dispatchUsers.forEach((u: any) => {
      if (u.email)
        addRecipient(
          u.email,
          `Dispatch: ${u.name}`,
          "Dispatch Team",
          "department",
          false,
          <Truck className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
        );
    });

    // 6. Custom emails added by user
    customEmails.forEach((ce) => {
      addRecipient(
        ce,
        ce,
        "Custom Added",
        "custom",
        false,
        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      );
    });

    return list;
  }, [order, usersList, customEmails, partyInfo, assignedSalesUser]);

  // Compute recommended recipients based on workflow scope (STRICTLY INTERNAL ONLY - NO AUTO SEND TO PARTY)
  const recommendedEmails = useMemo<string[]>(() => {
    const list: string[] = [];
    const salesEmail = assignedSalesUser?.email;
    const financeEmail = order?.assigned_finance_user?.email;
    const accountEmail = order?.assigned_account_user?.email;

    const findDeptEmails = (dept: string) =>
      usersList
        .filter((u: any) => u.department === dept && u.email)
        .map((u: any) => u.email.trim().toLowerCase());

    const adminEmails = findDeptEmails("admin").concat(findDeptEmails("super_admin"));
    const allFinanceEmails = findDeptEmails("finance");
    const allAccountEmails = findDeptEmails("account");
    const allDispatchEmails = findDeptEmails("dispatch");

    switch (scope) {
      case "submit":
        if (adminEmails[0]) list.push(adminEmails[0]);
        if (salesEmail) list.push(salesEmail);
        break;

      case "admin_approve":
        if (salesEmail) list.push(salesEmail);
        if (accountEmail) list.push(accountEmail);
        else if (allAccountEmails[0]) list.push(allAccountEmails[0]);
        break;

      case "admin_reject":
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      case "due_sheet":
        if (financeEmail) list.push(financeEmail);
        else if (allFinanceEmails[0]) list.push(allFinanceEmails[0]);
        if (salesEmail) list.push(salesEmail);
        break;

      case "finance_approve":
        if (accountEmail) list.push(accountEmail);
        else if (allAccountEmails[0]) list.push(allAccountEmails[0]);
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      case "finance_reject":
        if (accountEmail) list.push(accountEmail);
        else if (allAccountEmails[0]) list.push(allAccountEmails[0]);
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      case "account_approve":
        if (allDispatchEmails[0]) list.push(allDispatchEmails[0]);
        if (salesEmail) list.push(salesEmail);
        break;

      case "account_reject":
        if (financeEmail) list.push(financeEmail);
        else if (allFinanceEmails[0]) list.push(allFinanceEmails[0]);
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      case "dispatch":
      case "transport":
        if (allDispatchEmails[0]) list.push(allDispatchEmails[0]);
        if (salesEmail) list.push(salesEmail);
        break;

      case "in_transit":
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      case "delivered":
        if (accountEmail) list.push(accountEmail);
        else if (allAccountEmails[0]) list.push(allAccountEmails[0]);
        if (salesEmail) list.push(salesEmail);
        break;

      case "on_hold":
      case "cancelled":
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;

      default:
        if (salesEmail) list.push(salesEmail);
        if (adminEmails[0]) list.push(adminEmails[0]);
        break;
    }

    // Strictly ensure party email is NOT in recommended list
    const partyEmails = partyInfo?.allPartyEmails || [];
    return Array.from(
      new Set(
        list
          .filter(Boolean)
          .map((e) => e.trim().toLowerCase())
          .filter((e) => !partyEmails.includes(e))
      )
    );
  }, [order, usersList, scope, partyInfo, assignedSalesUser]);

  // Initialize recipients with recommended defaults on initial mount
  useEffect(() => {
    if ((!value.recipients || value.recipients.length === 0) && recommendedEmails.length > 0) {
      onChange({
        ...value,
        send_to_party: value.send_to_party ?? false,
        recipients: recommendedEmails,
      });
    }
  }, [recommendedEmails]);

  // When ticking "Send Email Notification", open/expand all options automatically
  const toggleSendEmail = useCallback(
    (checked: boolean) => {
      onChange({
        ...value,
        send_email: checked,
        send_to_party: checked ? (value.send_to_party ?? false) : false,
        recipients:
          checked && (!value.recipients || value.recipients.length === 0)
            ? recommendedEmails
            : value.recipients,
      });
      if (checked) {
        setIsExpanded(true);
      }
    },
    [value, onChange, recommendedEmails]
  );

  const toggleSendToParty = useCallback(
    (checked: boolean) => {
      const currentRecipients = value.recipients || [];
      const partyEmails = partyInfo?.allPartyEmails || [];
      let nextRecipients = [...currentRecipients];

      if (checked) {
        // When opting in, select all party contacts that have an email
        partyEmails.forEach((pEm) => {
          if (!nextRecipients.includes(pEm)) {
            nextRecipients.push(pEm);
          }
        });
      } else {
        // When opting out, remove all party emails
        nextRecipients = nextRecipients.filter((em) => !partyEmails.includes(em.toLowerCase()));
      }

      onChange({
        ...value,
        send_to_party: checked,
        recipients: nextRecipients,
      });
    },
    [value, onChange, partyInfo]
  );

  const togglePartyContactEmail = useCallback(
    (email: string) => {
      const clean = email.trim().toLowerCase();
      const current = value.recipients || [];
      const isCurrentlySelected = current.includes(clean);
      const next = isCurrentlySelected
        ? current.filter((e) => e !== clean)
        : [...current, clean];

      // If at least one party email is selected, send_to_party is true; otherwise false
      const anyPartySelected = next.some((em) => partyInfo?.allPartyEmails?.includes(em));

      onChange({
        ...value,
        send_to_party: anyPartySelected,
        recipients: next,
      });
    },
    [value, onChange, partyInfo]
  );

  const selectAllPartyContacts = useCallback(() => {
    const current = value.recipients || [];
    const partyEmails = partyInfo?.allPartyEmails || [];
    const merged = Array.from(new Set([...current, ...partyEmails]));
    onChange({
      ...value,
      send_to_party: true,
      recipients: merged,
    });
  }, [value, onChange, partyInfo]);

  const clearPartyContacts = useCallback(() => {
    const current = value.recipients || [];
    const partyEmails = partyInfo?.allPartyEmails || [];
    const next = current.filter((em) => !partyEmails.includes(em.toLowerCase()));
    onChange({
      ...value,
      send_to_party: true,
      recipients: next,
    });
  }, [value, onChange, partyInfo]);

  const toggleRecipient = useCallback(
    (email: string) => {
      const clean = email.trim().toLowerCase();
      const current = value.recipients || [];
      const isCurrentlySelected = current.includes(clean);
      const next = isCurrentlySelected
        ? current.filter((e) => e !== clean)
        : [...current, clean];

      // Check if this email belongs to party
      const isParty = partyInfo?.allPartyEmails?.includes(clean);
      let nextSendToParty = value.send_to_party;

      if (isParty) {
        if (!isCurrentlySelected) {
          // User explicitly added party email -> enable send_to_party
          nextSendToParty = true;
        } else {
          // User removed party email -> if no party email left in next, disable send_to_party
          const anyPartyLeft = next.some((em) => partyInfo?.allPartyEmails?.includes(em));
          if (!anyPartyLeft) {
            nextSendToParty = false;
          }
        }
      }

      onChange({
        ...value,
        send_to_party: nextSendToParty,
        recipients: next,
      });
    },
    [value, onChange, partyInfo]
  );

  const handleAddCustomEmail = useCallback(() => {
    const clean = customInput.trim().toLowerCase();
    if (!clean || !clean.includes("@")) return;
    if (!customEmails.includes(clean)) {
      setCustomEmails((prev) => [...prev, clean]);
    }
    if (!value.recipients.includes(clean)) {
      onChange({
        ...value,
        recipients: [...value.recipients, clean],
      });
    }
    setCustomInput("");
  }, [customInput, customEmails, value, onChange]);

  const internalCandidateRecipients = useMemo(
    () => candidateRecipients.filter((c) => !c.isParty),
    [candidateRecipients]
  );

  const selectAll = useCallback(() => {
    const allInternal = candidateRecipients.filter((c) => !c.isParty).map((c) => c.email);
    const currentPartyEmails = (value.recipients || []).filter((em) =>
      partyInfo?.allPartyEmails?.includes(em.toLowerCase())
    );
    onChange({
      ...value,
      recipients: Array.from(new Set([...currentPartyEmails, ...allInternal])),
    });
  }, [candidateRecipients, partyInfo, value, onChange]);

  const selectRecommended = useCallback(() => {
    const currentPartyEmails = (value.recipients || []).filter((em) =>
      partyInfo?.allPartyEmails?.includes(em.toLowerCase())
    );
    onChange({
      ...value,
      recipients: Array.from(new Set([...currentPartyEmails, ...recommendedEmails])),
    });
  }, [recommendedEmails, partyInfo, value, onChange]);

  const clearAll = useCallback(() => {
    const currentPartyEmails = (value.recipients || []).filter((em) =>
      partyInfo?.allPartyEmails?.includes(em.toLowerCase())
    );
    onChange({
      ...value,
      recipients: currentPartyEmails,
    });
  }, [partyInfo, value, onChange]);

  const selectedCount = value.recipients?.length || 0;

  return (
    <div
      className={`rounded-lg border border-slate-200/90 bg-slate-50/60 p-2.5 sm:p-3 dark:border-white/10 dark:bg-slate-900/50 ${className}`}
    >
      {/* Top Toggle Row */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.send_email}
            onChange={(e) => toggleSendEmail(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 dark:border-white/20 dark:bg-slate-800 dark:checked:bg-blue-600 cursor-pointer"
          />
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Send Email Notification
            </span>
          </div>
        </label>

        <div className="flex items-center gap-1.5">
          {value.send_email ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100/90 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Users className="h-2.5 w-2.5" />
              {selectedCount} {selectedCount === 1 ? "recipient" : "recipients"}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 dark:text-slate-550">
              Email disabled
            </span>
          )}

          {value.send_email && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-white/10 transition cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <span>Collapse</span>
                  <ChevronUp className="h-2.5 w-2.5" />
                </>
              ) : (
                <>
                  <span>Expand options</span>
                  <ChevronDown className="h-2.5 w-2.5" />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* When send_email is ticked, options and lists are immediately open and visible */}
      {value.send_email && isExpanded && (
        <div className="mt-2.5 space-y-2 animate-in fade-in-50 duration-150">
          {/* Dedicated Party / Customer Opt-in Option with Contact Selector */}
          <div className="rounded-md border border-slate-200/90 bg-white/90 p-2.5 dark:border-white/5 dark:bg-slate-950/40 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
              <label className="flex items-start sm:items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(value.send_to_party)}
                  disabled={!partyInfo?.hasEmail}
                  onChange={(e) => toggleSendToParty(e.target.checked)}
                  className="mt-0.5 sm:mt-0 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed dark:border-white/20 dark:bg-slate-900 dark:checked:bg-blue-600 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Send Email to Party / Customer</span>
                    {value.send_to_party ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                        Opted-in ({selectedPartyCount} contact{selectedPartyCount === 1 ? "" : "s"} selected)
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-200 px-1.5 py-0.2 text-[9px] font-medium text-slate-600 dark:bg-white/10 dark:text-slate-400">
                        Off (No auto send)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {partyInfo ? (
                      partyInfo.hasEmail ? (
                        <span>
                          Party: <strong className="text-slate-700 dark:text-slate-200">{partyInfo.name}</strong>
                          <span className="ml-1 text-slate-400">
                            • {partyInfo.allContacts.length} contact{partyInfo.allContacts.length === 1 ? "" : "s"} ({partyInfo.contactsWithEmail.length} with email)
                          </span>
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">
                          ⚠️ No email address found on file for this party or its contacts
                        </span>
                      )
                    ) : isPartyLoading ? (
                      <span className="text-slate-400 text-[10px]">Loading party details...</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">No party attached to this order</span>
                    )}
                  </div>
                </div>
              </label>

              <div className="text-[9px] text-slate-400 dark:text-slate-500 italic shrink-0 self-end sm:self-center">
                Never auto-sent to party
              </div>
            </div>

            {/* Contact Selector Grid: open and visible whenever send_email is ticked */}
            {partyInfo?.allContacts && partyInfo.allContacts.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Party Contacts to Receive Email:
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-1 py-0.2 text-[9px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {selectedPartyCount} of {partyInfo.contactsWithEmail.length} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-medium">
                    <button
                      type="button"
                      onClick={selectAllPartyContacts}
                      className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300 dark:text-white/20">•</span>
                    <button
                      type="button"
                      onClick={clearPartyContacts}
                      className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {partyInfo.allContacts.map((contact) => {
                    const isSelected =
                      contact.hasEmail && contact.email
                        ? value.recipients?.some(
                            (r) => r.toLowerCase() === contact.email.toLowerCase()
                          )
                        : false;
                    return (
                      <label
                        key={contact.id}
                        className={`flex items-start gap-1.5 rounded-md border p-1.5 sm:p-2 transition text-left select-none ${
                          !contact.hasEmail
                            ? "border-dashed border-slate-200 bg-slate-50/40 opacity-60 dark:border-white/10 dark:bg-slate-900/20 cursor-not-allowed"
                            : isSelected
                              ? "border-emerald-500/80 bg-emerald-50/70 text-slate-900 shadow-2xs dark:border-emerald-500/70 dark:bg-emerald-950/40 dark:text-slate-100 cursor-pointer"
                              : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-800/60 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!contact.hasEmail}
                          checked={isSelected}
                          onChange={() => {
                            if (contact.email) togglePartyContactEmail(contact.email);
                          }}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20 disabled:opacity-30 dark:border-white/20 dark:bg-slate-800 dark:checked:bg-emerald-600 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate text-[11px]">
                              {contact.name}
                            </p>
                            {contact.isPrimary && (
                              <span className="rounded bg-blue-100 px-1 py-0.2 text-[8px] font-bold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300 shrink-0">
                                Primary
                              </span>
                            )}
                          </div>
                          {contact.department && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                              {contact.department}
                            </p>
                          )}
                          {contact.hasEmail ? (
                            <p className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 truncate mt-0.5">
                              {contact.email}
                            </p>
                          ) : (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 italic mt-0.5">
                              No email on file
                            </p>
                          )}
                          {contact.phone && (
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                              Tel: {contact.phone}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>

                {value.send_to_party && selectedPartyCount === 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium pt-0.5">
                    ⚠️ Party email is enabled, but no party contact is selected. Please select at least one contact above.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Scope Recipients Section */}
          <div className="rounded-md border border-slate-200/90 bg-white/90 p-2.5 dark:border-white/5 dark:bg-slate-950/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Scope Recipients:
              </span>
              <div className="flex items-center gap-1.5 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={selectRecommended}
                  className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Recommended (Internal)
                </button>
                <span className="text-slate-300 dark:text-white/20">•</span>
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                >
                  All Team
                </button>
                <span className="text-slate-300 dark:text-white/20">•</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Recipient Chips Grid */}
            <div className="flex flex-wrap gap-1">
              {internalCandidateRecipients.map((cand) => {
                const isSelected = value.recipients?.some(
                  (r) => r.toLowerCase() === cand.email.toLowerCase()
                );
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => toggleRecipient(cand.email)}
                    title={`${cand.label} (${cand.email})`}
                    className={`group inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] sm:text-[11px] transition border text-left cursor-pointer ${
                      isSelected
                        ? "border-blue-500/80 bg-blue-50 text-blue-900 font-medium dark:border-blue-500 dark:bg-blue-950/70 dark:text-blue-200 shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100/80 dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="shrink-0">{cand.icon}</span>
                    <span className="truncate max-w-[130px] sm:max-w-[180px]">
                      {cand.label}
                    </span>
                    {isSelected ? (
                      <Check className="h-2.5 w-2.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <span className="h-2.5 w-2.5 rounded-full border border-slate-300 dark:border-white/20 shrink-0 group-hover:border-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Email Input */}
            <div className="flex items-center gap-1 pt-1">
              <input
                type="email"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomEmail();
                  }
                }}
                placeholder="Add custom recipient (e.g. manager@domain.com)..."
                className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="button"
                disabled={!customInput.trim() || !customInput.includes("@")}
                onClick={handleAddCustomEmail}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-white/15 dark:hover:bg-white/25 transition shrink-0 cursor-pointer"
              >
                <Plus className="h-2.5 w-2.5" />
                <span>Add</span>
              </button>
            </div>

            {selectedCount === 0 && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ No recipients selected. Please select at least one recipient or uncheck &quot;Send Email Notification&quot;.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowEmailControls;
