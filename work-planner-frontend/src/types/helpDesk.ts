/**
 * @fileoverview Type definitions for Help Desk module (Tickets, Replies, Permissions, Lifecycle).
 * @module types/helpDesk
 */

export type HelpTicketCategory =
  | 'work_plan_support'
  | 'visit_assistance'
  | 'client_lead_requirement'
  | 'product_pricing_query'
  | 'expense_account_query'
  | 'technical_portal_issue'
  | 'urgent_coordination'
  | 'general_requirement'
  | 'other';

export type HelpTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type HelpTicketStatus =
  | 'open'
  | 'in_progress'
  | 'solution_proposed'
  | 'resolved'
  | 'reopened'
  | 'cancelled';

export type HelpTicketReplyType =
  | 'comment'
  | 'status_change'
  | 'solution_proposal'
  | 'reopen_reason'
  | 'resolution_note'
  | 'users_tagged';

export interface HelpTicketAttachment {
  _id?: string;
  file_id?: string;
  filename: string;
  original_name?: string;
  mime_type?: string;
  size?: number;
  url?: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at?: string;
}

export interface HelpTicketTaggedUser {
  user: string | { _id: string; name?: string; email?: string; department?: string; role?: string };
  name: string;
  email?: string;
  department?: string;
  role?: string;
  tagged_at: string;
  acknowledged_at?: string | null;
  last_read_at?: string | null;
}

export interface HelpTicketReplyReadReceipt {
  user: string | { _id: string; name?: string; email?: string };
  name: string;
  role?: string;
  read_at: string;
}

export interface HelpTicketReply {
  _id: string;
  id?: string;
  ticket: string;
  user: string | { _id: string; name?: string; email?: string; department?: string; role?: string };
  user_snapshot: {
    name: string;
    email?: string;
    department?: string;
    role?: string;
  };
  message: string;
  reply_type: HelpTicketReplyType;
  attachments?: HelpTicketAttachment[];
  metadata?: {
    previous_status?: string | null;
    new_status?: string | null;
    newly_tagged_names?: string[];
    rating?: number;
    reason?: string;
  };
  read_by?: HelpTicketReplyReadReceipt[];
  createdAt: string;
  updatedAt?: string;
}

export interface HelpTicketProposedSolution {
  solution_text: string;
  proposed_by?: string;
  proposed_by_name?: string;
  proposed_at?: string;
  attachments?: HelpTicketAttachment[];
}

export interface HelpTicketResolutionDetails {
  resolved_at?: string | null;
  resolved_by?: string;
  resolved_by_name?: string;
  resolution_notes?: string;
  satisfaction_rating?: number | null; // 1-5
}

export interface HelpTicketReopenItem {
  reopened_at: string;
  reopened_by?: string;
  reopened_by_name?: string;
  reason?: string;
}

export interface HelpTicketMemberReadState {
  user: string | { _id: string; name?: string };
  last_read_at: string;
  last_read_reply_id?: string | null;
}

export interface HelpTicketRecord {
  _id: string;
  id?: string;
  ticket_number: string;
  title: string;
  description: string;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  status: HelpTicketStatus;
  created_by: string | { _id: string; name?: string; email?: string; department?: string; role?: string };
  creator_snapshot: {
    name: string;
    email?: string;
    department?: string;
    role?: string;
  };
  company_id?: string;
  tagged_users: HelpTicketTaggedUser[];
  member_read_state?: HelpTicketMemberReadState[];
  creator_last_read_at?: string | null;
  unseen_messages_count?: number;
  latest_reply_preview?: {
    message: string;
    user_name: string;
    createdAt: string;
    reply_type: string;
  } | null;
  related_entity?: {
    entity_type: 'work_plan' | 'visit' | 'work_task' | 'project' | 'expense' | 'lead' | 'client' | 'none';
    entity_id?: string;
    entity_title?: string;
    entity_code?: string;
  };
  attachments: HelpTicketAttachment[];
  proposed_solution?: HelpTicketProposedSolution;
  resolution_details?: HelpTicketResolutionDetails;
  reopen_history?: HelpTicketReopenItem[];
  replies_count: number;
  last_activity_at: string;
  due_date?: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: HelpTicketReply[];
  permissions?: {
    isCreator: boolean;
    isTagged: boolean;
    canResolve: boolean;
    canProposeSolution: boolean;
    canAcknowledge: boolean;
    canReopen: boolean;
  };
}

export interface HelpDeskStats {
  tagged_to_me_open: number;
  created_by_me_open: number;
  solution_proposed_waiting_me: number;
  resolved_this_month: number;
  urgent_count: number;
  total_all_open: number;
  total_unseen_count?: number;
}

export interface CreateHelpTicketPayload {
  title: string;
  description: string;
  category: HelpTicketCategory;
  priority: HelpTicketPriority;
  tagged_user_ids: string[];
  related_entity?: {
    entity_type: 'work_plan' | 'visit' | 'work_task' | 'project' | 'expense' | 'none';
    entity_id?: string;
    entity_title?: string;
  };
  attachments?: HelpTicketAttachment[];
  due_date?: string | null;
}

export interface AddHelpReplyPayload {
  message: string;
  reply_type?: HelpTicketReplyType;
  attachments?: HelpTicketAttachment[];
}

export interface ProposeSolutionPayload {
  solution_text: string;
  attachments?: HelpTicketAttachment[];
}

export interface ResolveTicketPayload {
  resolution_notes?: string;
  satisfaction_rating?: number; // 1-5
}

export interface ReopenTicketPayload {
  reason: string;
}
