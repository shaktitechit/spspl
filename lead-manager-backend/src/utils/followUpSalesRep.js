/**
 * Resolve sales representative display name for follow-ups, leads, and quotations.
 * Mirrors lead-manager-frontend getFollowUpSalesRepName().
 */

function refId(value) {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function userDisplayName(user) {
  if (!user) return '';
  if (typeof user === 'object' && user.name) return String(user.name).trim();
  return '';
}

/**
 * @param {object} fu - Follow-up with populated lead / quotation / created_by
 * @returns {string}
 */
function resolveSalesRepFromFollowUp(fu = {}) {
  const lead = fu.lead && typeof fu.lead === 'object' ? fu.lead : null;
  if (lead?.assigned_to && typeof lead.assigned_to === 'object') {
    const name = userDisplayName(lead.assigned_to);
    if (name) return name;
  }

  const quotation = fu.quotation && typeof fu.quotation === 'object' ? fu.quotation : null;
  if (quotation?.sales_person_name && String(quotation.sales_person_name).trim()) {
    return String(quotation.sales_person_name).trim();
  }
  if (quotation?.sales_person_user && typeof quotation.sales_person_user === 'object') {
    const name = userDisplayName(quotation.sales_person_user);
    if (name) return name;
  }

  if (fu.created_by && typeof fu.created_by === 'object') {
    const name = userDisplayName(fu.created_by);
    if (name) return name;
  }

  return 'Unassigned';
}

/**
 * @param {object} lead - Lead with optional populated assigned_to
 * @returns {string}
 */
function resolveSalesRepFromLead(lead = {}) {
  if (lead.assigned_to && typeof lead.assigned_to === 'object') {
    const name = userDisplayName(lead.assigned_to);
    if (name) return name;
  }
  if (lead.created_by && typeof lead.created_by === 'object') {
    const name = userDisplayName(lead.created_by);
    if (name) return name;
  }
  return 'Unassigned';
}

/**
 * @param {object} quotation
 * @returns {string}
 */
function resolveSalesRepFromQuotation(quotation = {}) {
  if (quotation.sales_person_name && String(quotation.sales_person_name).trim()) {
    return String(quotation.sales_person_name).trim();
  }
  if (quotation.sales_person_user && typeof quotation.sales_person_user === 'object') {
    const name = userDisplayName(quotation.sales_person_user);
    if (name) return name;
  }
  if (quotation.created_by && typeof quotation.created_by === 'object') {
    const name = userDisplayName(quotation.created_by);
    if (name) return name;
  }
  return 'Unassigned';
}

/**
 * Assignee / owner user id for routing follow-up reminders.
 * @param {object} fu
 * @returns {string|null}
 */
function resolveFollowUpOwnerUserId(fu = {}) {
  const lead = fu.lead && typeof fu.lead === 'object' ? fu.lead : null;
  const assigneeId = lead?.assigned_to ? refId(lead.assigned_to) : null;

  const quotation = fu.quotation && typeof fu.quotation === 'object' ? fu.quotation : null;
  const qRepId = quotation?.sales_person_user ? refId(quotation.sales_person_user) : null;
  const qCreatorId = quotation?.created_by ? refId(quotation.created_by) : null;

  const fallbackId = fu.created_by ? refId(fu.created_by) : null;
  return assigneeId || qRepId || qCreatorId || fallbackId;
}

/**
 * All assignee / owner user ids for routing follow-up reminders (including co-assignees).
 * @param {object} fu
 * @returns {string[]}
 */
function resolveFollowUpAllUserIds(fu = {}) {
  const set = new Set();
  const lead = fu.lead && typeof fu.lead === 'object' ? fu.lead : null;
  if (lead?.assigned_to) {
    const id = refId(lead.assigned_to);
    if (id) set.add(id);
  }
  if (Array.isArray(lead?.assigned_users)) {
    for (const u of lead.assigned_users) {
      const id = refId(u);
      if (id) set.add(id);
    }
  }

  const quotation = fu.quotation && typeof fu.quotation === 'object' ? fu.quotation : null;
  if (quotation?.sales_person_user) {
    const id = refId(quotation.sales_person_user);
    if (id) set.add(id);
  }
  if (quotation?.created_by) {
    const id = refId(quotation.created_by);
    if (id) set.add(id);
  }

  if (set.size === 0 && fu.created_by) {
    const id = refId(fu.created_by);
    if (id) set.add(id);
  }

  return Array.from(set);
}

module.exports = {
  refId,
  resolveSalesRepFromFollowUp,
  resolveSalesRepFromLead,
  resolveSalesRepFromQuotation,
  resolveFollowUpOwnerUserId,
  resolveFollowUpAllUserIds,
};
