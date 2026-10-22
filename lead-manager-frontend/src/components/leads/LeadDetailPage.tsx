/**
 * @fileoverview Lead Details Page with 3-Column Split-Pane Workspace, Interactive Lifecycle Stepper,
 * Sticky Contact Rail, Follow-Up Collaboration Hub, and Responsive Tabs.
 * @module components/leads/LeadDetailPage
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  Pencil,
  UserCheck,
  Activity,
  CalendarPlus,
  CheckCircle,
  AlertTriangle,
  FileText,
  FilePlus,
  Paperclip,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
  Package,
  Layers,
  ExternalLink,
  Copy,
  Plus,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Send,
  ShoppingCart,
  RotateCcw,
  Trophy,
  Calendar,
  Check,
  X,
  Lock,
  Sparkles,
  ChevronRight,
  User,
  ShieldCheck,
  Tag,
} from "lucide-react";
import {
  useGetLeadQuery,
  useChangeLeadStatusMutation,
  useListAttachmentsQuery,
  useCreateAttachmentMutation,
  useDeleteAttachmentMutation,
  useListLeadFollowUpsQuery,
  type LeadRecord,
  type LeadFollowUpRecord,
} from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { toast } from "@/lib/toast";
import { mutationRejectedMessage } from "@/lib/mutationMessages";
import { PortalBusyOverlay } from "@/components/portal/shared/PortalBusyOverlay";
import { FilePreviewModal, useFilePreview } from "@/components/portal/shared/FilePreviewModal";
import {
  formatCurrencyINR,
  formatLeadDate,
  formatLeadDateTime,
  formatLeadAssignees,
  isFollowUpOverdue,
  isFollowUpToday,
  isLeadAdmin,
  canAssignLead,
  canViewLeadPricing,
  leadLineValue,
  leadEstimatedValue,
  LEAD_STATUS_CONFIG,
  LEAD_PRIORITY_CONFIG,
  FOLLOWUP_TYPE_CONFIG,
  getDeptLabel,
} from "./leadUtils";
import { AssignLeadModal } from "./AssignLeadModal";
import { MarkWonModal } from "./MarkWonModal";
import { MarkLostModal } from "./MarkLostModal";
import { FollowUpModal } from "./FollowUpModal";
import { CompleteFollowUpModal } from "./CompleteFollowUpModal";
import { LeadTimelineTab } from "./LeadTimelineTab";
import { FollowUpChatPanel } from "@/components/shared/followups/FollowUpChatPanel";
import { readSessionFromStorage } from "@/utils/authStorage";

import { DetailWorkspaceSkeleton } from "@/components/shared/Skeletons";

type Props = {
  leadId: string;
  portalHome?: string;
};

export function LeadDetailPage({ leadId, portalHome = "/dashboard" }: Props) {
  const router = useRouter();
  const reduxUser = useAppSelector((state) => state.auth.user);
  const sessionUser = useMemo(() => readSessionFromStorage()?.user || null, []);
  const authUser = (reduxUser || sessionUser) as any;
  const isAdmin = isLeadAdmin(authUser, portalHome);
  const showPricing = canViewLeadPricing(authUser, portalHome);

  const [activeTab, setActiveTab] = useState<
    "overview" | "products" | "followups" | "attachments" | "timeline"
  >("overview");

  // Modals state
  const [assignOpen, setAssignOpen] = useState(false);
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [completingFollowUp, setCompletingFollowUp] = useState<LeadFollowUpRecord | null>(null);

  // File preview
  const {
    previewDoc,
    previewBlobUrl,
    previewLoading,
    openPreview,
    closePreview,
    downloadFile,
  } = useFilePreview(null);
  const [uploadRemarks, setUploadRemarks] = useState<string>("");

  const { data: lead, isLoading, isFetching, refetch } = useGetLeadQuery(leadId);
  const { data: attachments = [], refetch: refetchAttachments } = useListAttachmentsQuery({
    entity_type: "lead",
    entity_id: leadId,
  });

  const { data: followUps, refetch: refetchFollowUps } = useListLeadFollowUpsQuery(leadId);

  const [createAttachment, { isLoading: uploading }] = useCreateAttachmentMutation();
  const [deleteAttachment] = useDeleteAttachmentMutation();
  const [changeStatus, { isLoading: isChangingStatus }] = useChangeLeadStatusMutation();

  if (isLoading || !lead) {
    return <DetailWorkspaceSkeleton />;
  }

  const statusCfg = LEAD_STATUS_CONFIG[lead.status];
  const priorityCfg = LEAD_PRIORITY_CONFIG[lead.priority];

  const isWon = lead.status === "won";
  const isLost = lead.status === "lost";
  const isConverted = lead.status === "converted";
  const isClosed = isWon || isLost || isConverted;
  const isOverdue = isFollowUpOverdue(lead.next_follow_up_at);
  const isToday = isFollowUpToday(lead.next_follow_up_at);
  const estValue = leadEstimatedValue(lead);

  const handleCopyLeadNo = () => {
    navigator.clipboard.writeText(lead.lead_no);
    toast.success(`Copied ${lead.lead_no} to clipboard`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("entity_type", "lead");
    formData.append("entity_id", lead._id);
    if (uploadRemarks.trim()) {
      formData.append("remarks", uploadRemarks.trim());
    }

    try {
      await createAttachment(formData).unwrap();
      toast.success("Attachment uploaded successfully");
      setUploadRemarks("");
      refetchAttachments();
      if (e.target) e.target.value = "";
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  const handleDeleteAttachment = async (attId: string) => {
    try {
      await deleteAttachment(attId).unwrap();
      toast.success("Attachment removed");
      refetchAttachments();
    } catch (err) {
      toast.error(mutationRejectedMessage(err));
    }
  };

  return (
    <div className="relative min-h-screen space-y-5 pb-24 font-sans">
      <PortalBusyOverlay active={isFetching || uploading || isChangingStatus} />

      {/* TOP HEADER & ACTION CLUSTER */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Back & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`${portalHome}/leads`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted shadow-2xs hover:bg-surface-muted hover:text-foreground transition cursor-pointer"
              title="Back to Leads Pipeline"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  #{lead.lead_no}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLeadNo}
                  title="Copy Lead Number"
                  className="text-muted hover:text-foreground cursor-pointer p-0.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <h1 className="text-xl font-bold tracking-tight text-foreground truncate">
                  {lead.name}
                </h1>
              </div>

              {lead.company_name && (
                <p className="flex items-center gap-1.5 text-xs text-muted mt-0.5 truncate">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-semibold text-foreground/80">{lead.company_name}</span>
                  {lead.industry && <span>• {lead.industry}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons Cluster */}
          <div className="flex flex-wrap items-center gap-2">
            {!isClosed && (
              <Link
                href={`${portalHome}/leads/${lead._id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition"
              >
                <Pencil className="h-3.5 w-3.5 text-muted" />
                <span>Edit Lead</span>
              </Link>
            )}

            <Link
              href={`${portalHome}/leads/new?copy_from=${lead._id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground shadow-2xs hover:bg-surface-muted transition"
              title="Copy this lead to create a new lead"
            >
              <Copy className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Copy</span>
            </Link>

            {!isClosed && (
              <button
                type="button"
                onClick={() => setFollowUpOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-2xs hover:bg-amber-500/20 transition cursor-pointer"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                <span>Schedule Follow-up</span>
              </button>
            )}

            {!isClosed && canAssignLead(authUser, portalHome) && (
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-bold text-primary shadow-2xs hover:bg-primary/20 transition cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" />
                <span>Assign</span>
              </button>
            )}

            {!isWon && !isLost && !isConverted && (
              <button
                type="button"
                onClick={() => setWonOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
              >
                <Trophy className="h-3.5 w-3.5" />
                <span>Mark Won</span>
              </button>
            )}

            {!isWon && !isLost && !isConverted && (
              <button
                type="button"
                onClick={() => setLostOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 shadow-2xs hover:bg-rose-500/20 transition cursor-pointer"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Mark Lost</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* INTERACTIVE LIFECYCLE PIPELINE STEPPER */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3 mb-3.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
              Lifecycle Stage Pipeline
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Current Status:</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusCfg?.bg} ${statusCfg?.text} ${statusCfg?.border}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg?.dot}`} />
              {statusCfg?.label || lead.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Step 1: Intake */}
          <div
            className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
              lead.status === "new"
                ? "border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30"
                : "border-border bg-surface-muted/30"
            }`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                lead.status === "new"
                  ? "bg-primary text-white"
                  : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {lead.status === "new" ? "1" : "✓"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-foreground">1. New Intake</div>
              <div className="text-[10px] text-muted truncate">
                {formatLeadDate(lead.createdAt) || "Received"}
              </div>
            </div>
          </div>

          {/* Step 2: Assigned */}
          {(() => {
            const hasAssigned =
              Boolean(lead.assigned_to) ||
              ["assigned", "follow_up", "won", "converted"].includes(lead.status);
            const isCurrent = lead.status === "assigned";
            return (
              <div
                className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                  isCurrent
                    ? "border-indigo-500/40 bg-indigo-500/10 shadow-2xs ring-1 ring-indigo-500/30"
                    : hasAssigned
                    ? "border-border bg-surface-muted/30"
                    : "border-border/40 bg-surface-muted/10 opacity-50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : hasAssigned
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {isCurrent ? "2" : hasAssigned ? "✓" : "2"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">2. Assigned</div>
                  <div className="text-[10px] text-muted truncate">
                    {formatLeadAssignees(lead) || "Unassigned"}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 3: Follow Up */}
          {(() => {
            const hasFollowUp =
              (followUps && followUps.length > 0) ||
              ["follow_up", "won", "converted"].includes(lead.status);
            const isCurrent = lead.status === "follow_up";
            return (
              <div
                className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                  isCurrent
                    ? "border-amber-500/40 bg-amber-500/10 shadow-2xs ring-1 ring-amber-500/30"
                    : hasFollowUp
                    ? "border-border bg-surface-muted/30"
                    : "border-border/40 bg-surface-muted/10 opacity-50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isCurrent
                      ? "bg-amber-600 text-white"
                      : hasFollowUp
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {isCurrent ? "3" : hasFollowUp ? "✓" : "3"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">3. Follow Up</div>
                  <div className="text-[10px] text-muted truncate">
                    {followUps && followUps.length > 0
                      ? `${followUps.length} touchpoint${followUps.length > 1 ? "s" : ""}`
                      : "Touchpoint scheduled"}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 4: Qualification */}
          {(() => {
            const isQualified =
              ["follow_up", "won", "converted"].includes(lead.status) ||
              (followUps && followUps.length > 0);
            return (
              <div
                className={`relative flex items-center gap-3 rounded-xl border p-2.5 transition-all ${
                  isQualified
                    ? "border-border bg-surface-muted/30"
                    : "border-border/40 bg-surface-muted/10 opacity-50"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    isQualified
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {isQualified ? "✓" : "4"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">4. Qualification</div>
                  <div className="text-[10px] text-muted truncate">Scope &amp; Terms</div>
                </div>
              </div>
            );
          })()}

          {/* Step 5: Outcome */}
          {(() => {
            if (isWon || isConverted) {
              return (
                <div className="relative flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 shadow-2xs ring-1 ring-emerald-500/30">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Trophy className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      5. Deal Won 🎉
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                      Closed Converted
                    </div>
                  </div>
                </div>
              );
            }
            if (isLost) {
              return (
                <div className="relative flex items-center gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-2.5 shadow-2xs ring-1 ring-rose-500/30">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-white">
                    <XCircle className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      5. Closed (Lost)
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 truncate">
                      {lead.lost_info?.lost_reason || "Deal lost"}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div className="relative flex items-center gap-3 rounded-xl border border-border/40 bg-surface-muted/10 p-2.5 opacity-50">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-xs font-bold text-muted">
                  5
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-foreground">5. Decision</div>
                  <div className="text-[10px] text-muted truncate">Pipeline Active</div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 3-COLUMN SPLIT-PANE WORKSPACE */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
        {/* LEFT RAIL (320px / 3 cols on xl): Contact Profile, Location & Key Metrics */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Quick Contact Card */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4">
            <div className="border-b border-border/60 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                Contact Profile
              </h3>
              <p className="text-base font-bold text-foreground mt-1">{lead.name}</p>
              {lead.designation && (
                <p className="text-xs text-muted">{lead.designation}</p>
              )}
            </div>

            {/* Direct Connect Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {lead.phone ? (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 py-2 px-2 text-xs font-bold text-foreground hover:border-primary/40 transition cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span>Call</span>
                </a>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-muted/20 py-2 px-2 text-xs text-muted opacity-50">
                  <Phone className="h-3.5 w-3.5" />
                  <span>No Phone</span>
                </div>
              )}

              {lead.email ? (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-muted/60 py-2 px-2 text-xs font-bold text-foreground hover:border-primary/40 transition cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  <span>Email</span>
                </a>
              ) : (
                <div className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-muted/20 py-2 px-2 text-xs text-muted opacity-50">
                  <Mail className="h-3.5 w-3.5" />
                  <span>No Email</span>
                </div>
              )}
            </div>

            {/* Detailed Properties List */}
            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-muted text-[11px] font-semibold">Phone Number</dt>
                <dd className="font-mono font-bold text-foreground mt-0.5">
                  {lead.phone || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[11px] font-semibold">Email</dt>
                <dd className="font-semibold text-foreground mt-0.5 truncate">
                  {lead.email || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[11px] font-semibold">Company</dt>
                <dd className="font-semibold text-foreground mt-0.5">
                  {lead.company_name || "—"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[11px] font-semibold">Lead Source</dt>
                <dd className="mt-0.5">
                  <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    {lead.source}
                  </span>
                </dd>
              </div>

              {lead.department && (
                <div>
                  <dt className="text-muted text-[11px] font-semibold">Department</dt>
                  <dd className="mt-0.5">
                    <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                      {getDeptLabel(lead.department)}
                    </span>
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-muted text-[11px] font-semibold">Priority</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${priorityCfg?.bg} ${priorityCfg?.text} ${priorityCfg?.border}`}
                  >
                    {priorityCfg?.label || lead.priority}
                  </span>
                </dd>
              </div>

              {showPricing && (
                <div>
                  <dt className="text-muted text-[11px] font-semibold">Estimated Value</dt>
                  <dd className="font-mono text-base font-bold text-foreground mt-0.5">
                    {estValue > 0 ? formatCurrencyINR(estValue) : "₹0"}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Location & Address Card */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Location &amp; Address
            </h3>
            <div className="text-xs text-foreground space-y-1">
              {lead.billing_address?.address_line_1 && (
                <p>{lead.billing_address.address_line_1}</p>
              )}
              {lead.billing_address?.address_line_2 && (
                <p>{lead.billing_address.address_line_2}</p>
              )}
              <p className="font-semibold text-foreground">
                {[
                  lead.billing_address?.city,
                  lead.billing_address?.state,
                  lead.billing_address?.pincode,
                ]
                  .filter(Boolean)
                  .join(", ") || "No address on file"}
              </p>
              <p className="text-muted text-[11px]">
                {lead.billing_address?.country || "India"}
              </p>
            </div>
          </div>
        </div>

        {/* CENTER STAGE (6 cols on xl / 8 cols on lg): Activity Feed, Requirements & Collaboration */}
        <div className="lg:col-span-8 xl:col-span-6 space-y-4">
          {/* Working Tabs Navigation */}
          <div className="flex overflow-x-auto scrollbar-none border-b border-border/80 gap-1 pb-1">
            {[
              { id: "overview", label: "Overview & Scope", count: null },
              {
                id: "products",
                label: "Requirements",
                count: lead.products?.length || null,
              },
              {
                id: "followups",
                label: "Follow-Up Chat",
                count: followUps?.length || null,
              },
              {
                id: "attachments",
                label: "Documents",
                count: attachments?.length || null,
              },
              { id: "timeline", label: "Audit Timeline", count: null },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? "bg-primary text-white shadow-2xs"
                      : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-surface-muted text-muted"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Requirement Description */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                    Requirement Summary &amp; Scope
                  </h3>
                  {!isClosed && (
                    <Link
                      href={`${portalHome}/leads/${lead._id}/edit`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Edit Requirements
                    </Link>
                  )}
                </div>

                {lead.requirement ? (
                  <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {lead.requirement}
                  </p>
                ) : (
                  <p className="text-xs text-muted italic">No requirement description entered.</p>
                )}
              </div>

              {/* Product Requirements Preview Table */}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                    Required Products ({lead.products?.length || 0})
                  </h3>
                  {!isClosed && (
                    <Link
                      href={`${portalHome}/leads/${lead._id}/edit`}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Manage Products
                    </Link>
                  )}
                </div>

                {!lead.products || lead.products.length === 0 ? (
                  <p className="text-xs text-muted py-2 italic">
                    No specific catalog product line items attached.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-xs text-foreground">
                      <thead className="border-b border-border bg-surface-muted/60 font-bold uppercase text-muted text-[10px]">
                        <tr>
                          <th className="px-3.5 py-2">Item Name</th>
                          <th className="px-3.5 py-2 text-center">Qty</th>
                          {showPricing && <th className="px-3.5 py-2 text-right">Target Price</th>}
                          {showPricing && <th className="px-3.5 py-2 text-right">Line Total</th>}
                          <th className="px-3.5 py-2">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {lead.products.map((p, idx) => (
                          <tr key={idx} className="hover:bg-surface-muted/40 transition">
                            <td className="px-3.5 py-2.5 font-bold text-foreground">
                              {p.product_name}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold">
                              {p.quantity} {p.unit || "pcs"}
                            </td>
                            {showPricing && (
                              <td className="px-3.5 py-2.5 text-right font-mono text-muted">
                                {Number(p.target_price || 0) > 0
                                  ? formatCurrencyINR(p.target_price)
                                  : "—"}
                              </td>
                            )}
                            {showPricing && (
                              <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                                {leadLineValue(p) > 0 ? formatCurrencyINR(leadLineValue(p)) : "—"}
                              </td>
                            )}
                            <td className="px-3.5 py-2.5 text-muted text-[11px]">
                              {p.remarks || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Additional Contacts */}
              {lead.contacts && lead.contacts.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      Additional Contacts ({lead.contacts.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lead.contacts.map((c, i) => (
                      <div
                        key={c._id || i}
                        className="rounded-xl border border-border bg-surface-muted/40 p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{c.name}</span>
                          {c.designation && (
                            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                              {c.designation}
                            </span>
                          )}
                        </div>
                        {c.department && (
                          <p className="text-[10px] text-muted">Dept: {c.department}</p>
                        )}
                        {c.phone && (
                          <p className="font-mono text-muted flex items-center gap-1 text-[11px]">
                            <Phone className="h-3 w-3 text-muted" /> {c.phone}
                          </p>
                        )}
                        {c.email && (
                          <p className="text-muted flex items-center gap-1 text-[11px] truncate">
                            <Mail className="h-3 w-3 text-muted" /> {c.email}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal Notes */}
              {lead.notes && (
                <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted border-b border-border/60 pb-2">
                    Internal Collaboration Notes
                  </h3>
                  <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {lead.notes}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Full Products Workspace */}
          {activeTab === "products" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Required Product Catalog Items
                  </h3>
                  <p className="text-xs text-muted">
                    Specifications, SKU catalogs, and target pricing
                  </p>
                </div>
                {!isClosed && (
                  <Link
                    href={`${portalHome}/leads/${lead._id}/edit`}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-primary-hover transition"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Manage Items</span>
                  </Link>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-xs text-foreground">
                  <thead className="border-b border-border bg-surface-muted/60 font-bold uppercase text-muted text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">SKU</th>
                      <th className="px-4 py-3 text-center">Required Qty</th>
                      {showPricing && <th className="px-4 py-3 text-right">Target Price</th>}
                      {showPricing && <th className="px-4 py-3 text-right">Line Total</th>}
                      <th className="px-4 py-3">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {!lead.products || lead.products.length === 0 ? (
                      <tr>
                        <td colSpan={showPricing ? 6 : 4} className="py-12 text-center text-muted">
                          No product line items added.
                        </td>
                      </tr>
                    ) : (
                      lead.products.map((p, idx) => {
                        const catalog = typeof p.product === "object" ? p.product : null;
                        return (
                          <tr key={idx} className="hover:bg-surface-muted/40 transition">
                            <td className="px-4 py-3 font-bold text-foreground">
                              {p.product_name}
                            </td>
                            <td className="px-4 py-3 font-mono text-muted text-[11px]">
                              {catalog?.sku || "—"}
                            </td>
                            <td className="px-4 py-3 text-center font-mono font-bold">
                              {p.quantity} {p.unit || "pcs"}
                            </td>
                            {showPricing && (
                              <td className="px-4 py-3 text-right font-mono text-muted">
                                {Number(p.target_price || 0) > 0
                                  ? formatCurrencyINR(p.target_price)
                                  : "—"}
                              </td>
                            )}
                            {showPricing && (
                              <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                                {leadLineValue(p) > 0 ? formatCurrencyINR(leadLineValue(p)) : "—"}
                              </td>
                            )}
                            <td className="px-4 py-3 text-muted text-[11px]">
                              {p.remarks || "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab 3: Collaborative Follow-up Chat */}
          {activeTab === "followups" && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
              <FollowUpChatPanel context="lead" lead={lead} disabled={isClosed} />
            </div>
          )}

          {/* Tab 4: Attachments & Documents */}
          {activeTab === "attachments" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Attached Documents</h3>
                  <p className="text-xs text-muted">
                    Specifications, visiting cards, client RFQs
                  </p>
                </div>

                <label className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-primary-hover transition cursor-pointer">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Upload File</span>
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              <div className="space-y-2">
                {!attachments || attachments.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">
                    No attachments uploaded yet.
                  </div>
                ) : (
                  attachments.map((att) => (
                    <div
                      key={att._id}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface-muted/30 p-3 text-xs hover:bg-surface-muted/60 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Paperclip className="h-4 w-4 text-primary shrink-0" />
                        <div className="truncate">
                          <p className="font-bold text-foreground truncate">{att.original_name}</p>
                          <p className="text-[10px] text-muted">
                            {Math.round((att.size || 0) / 1024)} KB •{" "}
                            {formatLeadDate(att.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {att.url && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                openPreview({
                                  url: att.url || "",
                                  name: att.original_name,
                                  mime: att.mime_type || "application/octet-stream",
                                })
                              }
                              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
                              title="Preview File"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.original_name}
                              className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground cursor-pointer"
                              title="Download File"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att._id)}
                          className="rounded-lg p-1.5 text-muted hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete File"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 5: Chronological Timeline */}
          {activeTab === "timeline" && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted border-b border-border/60 pb-3">
                Chronological Activity Stream
              </h3>
              <LeadTimelineTab leadId={lead._id} />
            </div>
          )}
        </div>

        {/* RIGHT RAIL (320px / 3 cols on xl): Assigned Reps, Deadlines, and Metadata */}
        <div className="lg:col-span-12 xl:col-span-3 space-y-4">
          {/* Assigned Team Members Card */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">
                Assigned Team
              </h3>
              {!isClosed && canAssignLead(authUser, portalHome) && (
                <button
                  type="button"
                  onClick={() => setAssignOpen(true)}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Manage
                </button>
              )}
            </div>

            <div className="space-y-2 text-xs">
              {lead.assigned_users && lead.assigned_users.length > 0 ? (
                lead.assigned_users.map((u, i) => (
                  <div
                    key={u._id || i}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/30 p-2"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                      {(u.name || "U")[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{u.name}</p>
                      {u.department && (
                        <p className="text-[10px] text-muted">Dept: {u.department}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : lead.assigned_to?.name ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-muted/30 p-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                    {lead.assigned_to.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{lead.assigned_to.name}</p>
                    <p className="text-[10px] text-muted">Primary Sales Representative</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted italic">No team member assigned yet.</p>
              )}
            </div>
          </div>

          {/* Follow-up & Deadlines Card */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted border-b border-border/60 pb-2.5">
              Deadlines &amp; Touchpoints
            </h3>
            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-muted text-[11px] font-semibold">Next Follow-Up</dt>
                <dd
                  className={`mt-0.5 font-bold ${
                    isOverdue
                      ? "text-rose-600 dark:text-rose-400"
                      : isToday
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground"
                  }`}
                >
                  {lead.next_follow_up_at
                    ? `${formatLeadDateTime(lead.next_follow_up_at)}${
                        isOverdue ? " (Overdue)" : isToday ? " (Today)" : ""
                      }`
                    : "None Scheduled"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[11px] font-semibold">Expected Closing Date</dt>
                <dd className="font-semibold text-foreground mt-0.5">
                  {formatLeadDate(lead.expected_closing_date) || "Not Set"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[11px] font-semibold">Last Contacted</dt>
                <dd className="text-muted font-medium mt-0.5">
                  {formatLeadDateTime(lead.last_contacted_at) || "Never"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Won / Lost Status Reason Card */}
          {lead.status === "lost" && lead.lost_info && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 shadow-xs space-y-1.5">
              <h4 className="text-xs font-extrabold uppercase text-rose-700 dark:text-rose-300">
                Lost Reason
              </h4>
              <p className="text-xs font-bold text-rose-900 dark:text-rose-200">
                {lead.lost_info.lost_reason}
              </p>
              {lead.lost_info.lost_remarks && (
                <p className="text-[11px] text-rose-700 dark:text-rose-300">
                  {lead.lost_info.lost_remarks}
                </p>
              )}
            </div>
          )}

          {lead.status === "converted" && lead.conversion && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-xs space-y-1.5">
              <h4 className="text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-300">
                Conversion Details
              </h4>
              <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Type: {lead.conversion.conversion_type}
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Converted on: {formatLeadDate(lead.conversion.converted_at)}
              </p>
            </div>
          )}

          {/* Record System Information */}
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted border-b border-border/60 pb-2">
              System Audit
            </h3>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted text-[10px]">Created By</dt>
                <dd className="font-semibold text-foreground text-[11px]">
                  {typeof lead.created_by === "object" && lead.created_by?.name
                    ? lead.created_by.name
                    : typeof lead.created_by === "string" && lead.created_by
                    ? lead.created_by
                    : "System"}
                </dd>
              </div>

              <div>
                <dt className="text-muted text-[10px]">Created Date</dt>
                <dd className="font-mono text-muted text-[11px]">
                  {formatLeadDateTime(lead.createdAt)}
                </dd>
              </div>

              {lead.updatedAt && (
                <div>
                  <dt className="text-muted text-[10px]">Last Modified</dt>
                  <dd className="font-mono text-muted text-[11px]">
                    {formatLeadDateTime(lead.updatedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {assignOpen && canAssignLead(authUser, portalHome) && (
        <AssignLeadModal
          lead={lead}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {wonOpen && (
        <MarkWonModal
          lead={lead}
          open={wonOpen}
          onClose={() => setWonOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {lostOpen && (
        <MarkLostModal
          lead={lead}
          open={lostOpen}
          onClose={() => setLostOpen(false)}
          onSuccess={() => refetch()}
        />
      )}

      {followUpOpen && (
        <FollowUpModal
          lead={lead}
          open={followUpOpen}
          onClose={() => setFollowUpOpen(false)}
          onSuccess={() => {
            refetch();
            refetchFollowUps();
          }}
        />
      )}

      {completingFollowUp && (
        <CompleteFollowUpModal
          followUp={completingFollowUp}
          open={Boolean(completingFollowUp)}
          onClose={() => setCompletingFollowUp(null)}
          onSuccess={() => {
            refetch();
            refetchFollowUps();
          }}
        />
      )}

      {previewDoc && (
        <FilePreviewModal
          doc={previewDoc}
          blobUrl={previewBlobUrl}
          loading={previewLoading}
          onClose={closePreview}
          onDownload={downloadFile}
        />
      )}
    </div>
  );
}
