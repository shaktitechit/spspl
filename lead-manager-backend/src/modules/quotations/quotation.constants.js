/**
 * @fileoverview Quotation module constants.
 * @module modules/quotations/quotation.constants
 */

const QUOTATION_STATUSES = ['draft', 'pending_approval', 'approved', 'sent', 'in_negotiation', 'accepted', 'rejected', 'expired', 'on_hold', 'converted'];

/** Customer-facing pipeline: approved/sent and actively negotiated (excludes draft/pending). */
const ACTIVE_PIPELINE_STATUSES = ['approved', 'sent', 'in_negotiation', 'on_hold'];

function isActivePipelineStatus(status) {
  return ACTIVE_PIPELINE_STATUSES.includes(status);
}

// Roles authorized to view/read quotations
const QUOTATION_ROLES = ['sales', 'admin', 'finance'];

// Roles authorized to create, edit, approve, or delete quotations
const QUOTATION_ADMIN_ROLES = ['admin', 'finance'];

module.exports = {
  QUOTATION_STATUSES,
  ACTIVE_PIPELINE_STATUSES,
  isActivePipelineStatus,
  QUOTATION_ROLES,
  QUOTATION_ADMIN_ROLES,
};
