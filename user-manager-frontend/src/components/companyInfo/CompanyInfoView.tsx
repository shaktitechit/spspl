"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2,
  CreditCard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Copy,
  Sparkles,
  Landmark,
  MapPin,
  ChevronLeft,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { API_BASE, getAuthHeaders } from "@/utils/apiHelpers";
import { BranchesManager } from "./BranchesManager";
import { GeneralLegalSection } from "./GeneralLegalSection";
import { BrandingThemeSection } from "./BrandingThemeSection";
import { TaxationComplianceSection } from "./TaxationComplianceSection";
import { AddressLocalizationSection } from "./AddressLocalizationSection";
import { BankingPaymentsSection } from "./BankingPaymentsSection";

export type CompanyInfoTabType = "general" | "branding" | "branches" | "taxation" | "address" | "banking";

export const COMPANY_INFO_TABS: { id: CompanyInfoTabType; label: string; icon: any; description: string }[] = [
  { id: "general", label: "General & Legal", icon: Landmark, description: "Entity details & official contacts" },
  { id: "branding", label: "Branding & Theme", icon: Sparkles, description: "Logo, favicon & theme palette" },
  { id: "branches", label: "Branches & Locations", icon: GitBranch, description: "Multi-branch tax, address & banking" },
  { id: "taxation", label: "Taxation & Compliance", icon: ShieldCheck, description: "GSTIN, PAN, CIN & licenses" },
  { id: "address", label: "Address & Localization", icon: MapPin, description: "Office address, currency & fiscal year" },
  { id: "banking", label: "Banking & Payments", icon: CreditCard, description: "Bank credentials & payout accounts" },
];

export function CompanyInfoView({
  token,
  onCompanyInfoUpdated,
}: {
  token: string;
  onCompanyInfoUpdated?: (info: any) => void;
}) {
  const [formData, setFormData] = useState<any>({
    legal_name: "",
    trade_name: "",
    gstin: "",
    cin: "",
    pan: "",
    drug_license: "",
    fssai_license: "",
    email: "",
    billing_email: "",
    phone: "",
    website: "",
    logo_url: "",
    favicon_url: "",
    primary_color: "#636ccb",
    secondary_color: "#6e8cfb",
    theme_palette: "default",
    address: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    currency: "INR",
    timezone: "Asia/Kolkata",
    financial_year: "April - March",
    invoice_footer_note: "",
    bank_name: "",
    account_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "Current Account",
    upi_id: "",
    swift_code: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CompanyInfoTabType>("general");

  const currentTabIndex = COMPANY_INFO_TABS.findIndex((t) => t.id === activeTab);
  const prevTab = currentTabIndex > 0 ? COMPANY_INFO_TABS[currentTabIndex - 1] : null;
  const nextTab = currentTabIndex < COMPANY_INFO_TABS.length - 1 ? COMPANY_INFO_TABS[currentTabIndex + 1] : null;

  const fetchCompanyInfo = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let res = await fetch(`${API_BASE}/api/company-info`, {
        headers: getAuthHeaders(token),
      });

      if (!res.ok) {
        // Fallback to local Next.js proxy route
        res = await fetch("/api/company-info", {
          headers: getAuthHeaders(token),
        });
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch company information (Status ${res.status})`);
      }

      const data = await res.json();
      if (data?.data) {
        setFormData((prev: any) => ({
          ...prev,
          ...data.data,
        }));
        if (onCompanyInfoUpdated) {
          onCompanyInfoUpdated(data.data);
        }
      }
    } catch (err: any) {
      setError(err?.message ?? "Error fetching company info.");
    } finally {
      setIsLoading(false);
    }
  }, [token, onCompanyInfoUpdated]);

  useEffect(() => {
    fetchCompanyInfo();
  }, [fetchCompanyInfo]);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  /**
   * Save handler called by each section independently.
   * Sends only the partial section data (or merged update) to the API.
   */
  const handleSaveSection = async (partialData: Record<string, any>) => {
    const updatedFullData = {
      ...formData,
      ...partialData,
    };

    let res = await fetch(`${API_BASE}/api/company-info`, {
      method: "PUT",
      headers: {
        ...getAuthHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(partialData),
    });

    if (!res.ok) {
      // Fallback to local Next.js proxy route
      res = await fetch("/api/company-info", {
        method: "PUT",
        headers: {
          ...getAuthHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(partialData),
      });
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `Failed to update section (Status ${res.status})`);
    }

    const merged = data?.data ? { ...updatedFullData, ...data.data } : updatedFullData;
    setFormData(merged);
    if (onCompanyInfoUpdated) {
      onCompanyInfoUpdated(merged);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted">Loading Company Information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Top Organization Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-primary" />
            Super Admin Organization & Company Profile
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Central management for organization identity, branding, taxation, multi-branch network, and bank credentials
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchCompanyInfo}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Sync & Refresh
          </button>
        </div>
      </div>

      {/* Hero Organization Banner */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/20 border border-primary/30 text-primary shadow-md">
              {formData.logo_url ? (
                <img src={formData.logo_url} alt="Logo" className="h-full w-full object-contain p-1 rounded-xl" />
              ) : (
                <Building2 className="h-7 w-7" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-foreground">
                  {formData.legal_name || "Parent Company & Organization Root"}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/30 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  <ShieldCheck className="h-3 w-3" /> Parent Entity
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Trade Brand: <strong className="font-semibold text-foreground">{formData.trade_name || "Not configured"}</strong> | Central parent entity for all system domains
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopy(JSON.stringify(formData, null, 2), "Full Company JSON")}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <Copy className="h-3.5 w-3.5 text-muted" />
              {copiedKey === "Full Company JSON" ? "Copied JSON!" : "Export JSON"}
            </button>
          </div>
        </div>
      </div>

      {/* Error alert if initial load failed */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-semibold text-rose-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl border border-border bg-card shadow-xs">
        {COMPANY_INFO_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition shrink-0 ${
                isActive
                  ? "bg-primary text-white shadow-sm ring-2 ring-primary/20"
                  : "text-muted hover:text-foreground hover:bg-surface-muted"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-muted"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content: Each section deals with save & edit separately */}
      {activeTab === "general" && (
        <GeneralLegalSection
          initialData={formData}
          onSave={handleSaveSection}
        />
      )}

      {activeTab === "branding" && (
        <BrandingThemeSection
          initialData={formData}
          onSave={handleSaveSection}
          onPreviewChange={(previewData) => setFormData((prev: any) => ({ ...prev, ...previewData }))}
        />
      )}

      {activeTab === "branches" && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <BranchesManager companyData={formData} token={token} />
        </div>
      )}

      {activeTab === "taxation" && (
        <TaxationComplianceSection
          initialData={formData}
          onSave={handleSaveSection}
        />
      )}

      {activeTab === "address" && (
        <AddressLocalizationSection
          initialData={formData}
          onSave={handleSaveSection}
        />
      )}

      {activeTab === "banking" && (
        <BankingPaymentsSection
          initialData={formData}
          onSave={handleSaveSection}
        />
      )}

      {/* Tab Navigation Footer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          {prevTab && (
            <button
              type="button"
              onClick={() => setActiveTab(prevTab.id)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back: {prevTab.label}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 sm:ml-auto">
          {nextTab && (
            <button
              type="button"
              onClick={() => setActiveTab(nextTab.id)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted transition"
            >
              <span>Next: {nextTab.label}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
