/**
 * @fileoverview Lead Follow-up Management service: scheduling, recording outcomes and alerts.
 * @module modules/leads/leadFollowUp.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const notificationService = require('../notifications/notification.service');
const {
  isLeadAdmin,
  isLeadManager,
  isLeadCoordinator,
  isLeadExecutive,
  assertCanAccessLead,
  refId,
} = require('./lead.service');
const { getVisibleLeadUserIds } = require('../team/teamVisibility.service');

/**
 * Schedule a new follow-up for a lead.
 */
async function createForLead(leadId, body, user) {
  const { Lead, LeadFollowUp } = getModels();
  const lead = await Lead.findOne({ _id: leadId, deletedAt: null });
  if (!lead) throw new ApiError(404, 'Lead not found');

  if (user) {
    await assertCanAccessLead(lead, user, 'schedule follow-ups for');
  }

  const isNote = body.type === 'note';
  const followUpDate = body.follow_up_date ? new Date(body.follow_up_date) : new Date();

  const doc = await LeadFollowUp.create({
    lead: leadId,
    follow_up_date: followUpDate,
    follow_up_time: body.follow_up_time ? String(body.follow_up_time).trim() : '',
    type: body.type || 'call',
    notes: body.notes ? String(body.notes).trim() : '',
    status: isNote ? 'completed' : 'pending',
    completed_at: isNote ? new Date() : undefined,
    completed_by: isNote ? user._id : undefined,
    actions: body.notes && isNote ? [{
      author: user._id,
      action_type: 'comment',
      message: String(body.notes).trim(),
      created_at: new Date(),
    }] : [],
    created_by: user._id,
    updated_by: user._id,
  });

  // Update lead's next follow-up pointer & last activity if scheduled
  if (!isNote) {
    lead.next_follow_up_at = followUpDate;
  }
  lead.last_activity_at = new Date();
  if (lead.status === 'new' || lead.status === 'assigned') {
    lead.status = 'follow_up';
  }
  await lead.save();

  const populated = await LeadFollowUp.findById(doc._id)
    .populate('created_by', 'name email department')
    .populate('completed_by', 'name email department')
    .populate('actions.author', 'name email department')
    .lean();

  const plain = toPlain(populated);

  await activityService.create({
    actor: user._id,
    entity_type: 'lead',
    entity_id: lead._id,
    action: isNote ? 'updated' : 'created',
    message: isNote ? `Team note added: "${(body.notes || '').slice(0, 80)}"` : `Follow-up scheduled (${body.type || 'call'}) for ${followUpDate.toLocaleDateString()}`,
    new_value: plain,
  });

  // Notify assignee if scheduled by someone else (e.g. manager)
  const assigneeId = refId(lead.assigned_to);
  if (assigneeId && assigneeId !== String(user._id)) {
    await notificationService.createForUser(assigneeId, {
      title: 'Follow-up Scheduled',
      message: `A ${body.type || 'call'} follow-up was scheduled for Lead #${lead.lead_no} on ${followUpDate.toLocaleDateString()}`,
      type: 'info',
      module: 'lead',
      entity_type: 'lead',
      entity_id: lead._id,
    });
  }

  return plain;
}

/**
 * List all follow-ups for a single lead.
 */
async function listForLead(leadId, user) {
  const { Lead, LeadFollowUp } = getModels();
  if (user) {
    const lead = await Lead.findOne({ _id: leadId, deletedAt: null }).lean();
    if (!lead) throw new ApiError(404, 'Lead not found');
    await assertCanAccessLead(lead, user, 'view follow-ups for');
  }
  const rows = await LeadFollowUp.find({ lead: leadId, deletedAt: null })
    .populate('created_by', 'name email department')
    .populate('completed_by', 'name email department')
    .populate('actions.author', 'name email department')
    .sort({ follow_up_date: -1, createdAt: -1 })
    .lean();
  return rows.map(toPlain);
}

/**
 * Complete a follow-up, record outcome, and optionally schedule the next one.
 */
async function complete(followUpId, body, user) {
  const { Lead, LeadFollowUp } = getModels();
  const fu = await LeadFollowUp.findOne({ _id: followUpId, deletedAt: null });
  if (!fu) throw new ApiError(404, 'Follow-up not found');

  if (fu.quotation) {
    const quotationService = require('../quotations/quotation.service');
    return quotationService.completeFollowUp(followUpId, body, user);
  }

  const lead = await Lead.findOne({ _id: fu.lead, deletedAt: null });
  if (!lead) throw new ApiError(404, 'Associated lead not found');

  await assertCanAccessLead(lead, user, 'complete follow-ups for');

  fu.status = 'completed';
  fu.outcome = String(body.outcome).trim();
  fu.completed_at = new Date();
  fu.completed_by = user._id;
  fu.updated_by = user._id;

  let nextFu = null;
  if (body.next_follow_up_date) {
    const nextDate = new Date(body.next_follow_up_date);
    fu.next_follow_up_date = nextDate;

    // Create the next scheduled follow-up
    nextFu = await LeadFollowUp.create({
      lead: lead._id,
      follow_up_date: nextDate,
      follow_up_time: body.next_follow_up_time || '',
      type: body.next_type || fu.type,
      notes: body.next_notes || '',
      status: 'pending',
      created_by: user._id,
      updated_by: user._id,
    });

    lead.next_follow_up_at = nextDate;
  } else {
    // Check if there are other pending follow-ups
    const nextPending = await LeadFollowUp.findOne({
      lead: lead._id,
      status: 'pending',
      deletedAt: null,
      _id: { $ne: fu._id },
    }).sort({ follow_up_date: 1 });

    lead.next_follow_up_at = nextPending ? nextPending.follow_up_date : null;
  }

  if (lead.status === 'new' || lead.status === 'assigned') {
    lead.status = 'follow_up';
  }
  lead.last_contacted_at = new Date();
  lead.last_activity_at = new Date();
  await lead.save();
  await fu.save();

  const plain = toPlain(fu.toObject());

  await activityService.create({
    actor: user._id,
    entity_type: 'lead',
    entity_id: lead._id,
    action: 'status_changed',
    message: `Follow-up completed: ${body.outcome}`,
    new_value: plain,
  });

  return {
    completed: plain,
    next: nextFu ? toPlain(nextFu.toObject()) : null,
  };
}

/**
 * Get follow-up list for calendar/agenda view.
 */
async function getCalendar(query = {}, user) {
  const { LeadFollowUp } = getModels();
  const q = { deletedAt: null };

  if (query.from_date || query.to_date) {
    q.follow_up_date = {};
    if (query.from_date) {
      const from = new Date(query.from_date);
      from.setHours(0, 0, 0, 0);
      q.follow_up_date.$gte = from;
    }
    if (query.to_date) {
      const to = new Date(query.to_date);
      to.setHours(23, 59, 59, 999);
      q.follow_up_date.$lte = to;
    }
  }

  if (query.status && query.status !== 'all') {
    q.status = query.status;
  }

  if (query.type && query.type !== 'all') {
    q.type = query.type;
  }

  const isAdmin = isLeadAdmin(user);
  const isMgr = isLeadManager(user);
  const isCoord = isLeadCoordinator(user);
  const isExec = isLeadExecutive(user);
  const hasQuotationAccess = isAdmin || isMgr || isCoord || isExec;
  const userIdStr = String(user._id);
  const teamIds = !isAdmin && (isMgr || isCoord) ? await getVisibleLeadUserIds(user) : null;
  const teamSet = new Set((teamIds || []).map(String));
  teamSet.add(userIdStr);

  if (!hasQuotationAccess) {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'lead') {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'quotation') {
    q.quotation = { $ne: null };
  }

  let rows = await LeadFollowUp.find(q)
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to assigned_users created_by estimated_value party_id requirement_details',
      populate: [
        { path: 'assigned_to', select: 'name email department' },
        { path: 'assigned_users', select: 'name email department' },
        { path: 'created_by', select: 'name email department' },
        { path: 'party_id', select: 'party_name legal_name district state' },
      ],
    })
    .populate({
      path: 'quotation',
      select: 'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by signatory_user sales_person_name sales_person_user lead',
      populate: [
        { path: 'sales_person_user', select: 'name email department' },
        { path: 'created_by', select: 'name email department' },
        { path: 'signatory_user', select: 'name email department' },
        { path: 'party_id', select: 'party_name legal_name' },
      ],
    })
    .populate('created_by', 'name email department')
    .populate('completed_by', 'name email department')
    .sort({ follow_up_date: 1 })
    .lean();

  const getAssigneeIds = (r) => {
    const ids = new Set();
    const lead = r.lead && typeof r.lead === 'object' ? r.lead : null;
    const leadAssignee = lead?.assigned_to?._id ? String(lead.assigned_to._id) : (lead?.assigned_to ? String(lead.assigned_to) : null);
    if (leadAssignee) ids.add(leadAssignee);

    if (Array.isArray(lead?.assigned_users)) {
      lead.assigned_users.forEach((u) => {
        const uId = u?._id ? String(u._id) : (u ? String(u) : null);
        if (uId) ids.add(uId);
      });
    }

    const quote = r.quotation && typeof r.quotation === 'object' ? r.quotation : null;
    const qRep = quote?.sales_person_user?._id ? String(quote.sales_person_user._id) : (quote?.sales_person_user ? String(quote.sales_person_user) : null);
    if (qRep) ids.add(qRep);

    return ids;
  };

  const getCreatorIds = (r) => {
    const ids = new Set();
    const fuCreator = r.created_by?._id ? String(r.created_by._id) : (r.created_by ? String(r.created_by) : null);
    if (fuCreator) ids.add(fuCreator);

    const lead = r.lead && typeof r.lead === 'object' ? r.lead : null;
    const leadCreator = lead?.created_by?._id ? String(lead.created_by._id) : (lead?.created_by ? String(lead.created_by) : null);
    if (leadCreator) ids.add(leadCreator);

    const quote = r.quotation && typeof r.quotation === 'object' ? r.quotation : null;
    const qCreator = quote?.created_by?._id ? String(quote.created_by._id) : (quote?.created_by ? String(quote.created_by) : null);
    if (qCreator) ids.add(qCreator);

    return ids;
  };

  const scope = String(query.scope || '').toLowerCase().trim();

  // 1. Base Role Scoping
  if (!isAdmin) {
    if (isMgr || isCoord) {
      // Manager / Coordinator: own + downline team (by assignee OR creator)
      rows = rows.filter((r) => {
        const assignees = getAssigneeIds(r);
        const creators = getCreatorIds(r);
        return [...assignees].some((id) => teamSet.has(id)) || [...creators].some((id) => teamSet.has(id));
      });
    } else {
      // Executive: strictly see follow-ups where THIS user is assigned or is creator
      rows = rows.filter((r) => {
        const assignees = getAssigneeIds(r);
        const creators = getCreatorIds(r);
        return assignees.has(userIdStr) || creators.has(userIdStr);
      });
    }
  }

  // 2. View Scope: "team" vs "mine" / "me"
  if (scope === 'mine' || scope === 'me') {
    rows = rows.filter((r) => {
      const assignees = getAssigneeIds(r);
      const creators = getCreatorIds(r);
      return assignees.has(userIdStr) || creators.has(userIdStr);
    });
  } else if (scope === 'team') {
    if (isMgr || isCoord) {
      rows = rows.filter((r) => {
        const assignees = getAssigneeIds(r);
        const creators = getCreatorIds(r);
        return [...assignees].some((id) => teamSet.has(id)) || [...creators].some((id) => teamSet.has(id));
      });
    }
  } else if (scope === 'assigned_to_me') {
    rows = rows.filter((r) => getAssigneeIds(r).has(userIdStr));
  } else if (scope === 'created_by_me') {
    rows = rows.filter((r) => getCreatorIds(r).has(userIdStr));
  }

  // 3. Separate Filter: assigned_to
  if (query.assigned_to && query.assigned_to !== 'all') {
    const target = String(query.assigned_to).trim();
    if (target === 'me') {
      rows = rows.filter((r) => getAssigneeIds(r).has(userIdStr));
    } else if (target === 'unassigned') {
      rows = rows.filter((r) => getAssigneeIds(r).size === 0);
    } else {
      rows = rows.filter((r) => getAssigneeIds(r).has(target));
    }
  }

  // 4. Separate Filter: created_by
  if (query.created_by && query.created_by !== 'all') {
    const target = String(query.created_by).trim();
    if (target === 'me') {
      rows = rows.filter((r) => getCreatorIds(r).has(userIdStr));
    } else {
      rows = rows.filter((r) => getCreatorIds(r).has(target));
    }
  }

  return rows.map(toPlain);
}

/**
 * Get urgent follow-ups summary (overdue + due today) scoped by user role.
 * Powers the frontend persistent unskippable banner & intercept action modal.
 */
async function getUrgentSummary(user, timeZone = 'Asia/Kolkata') {
  const { LeadFollowUp } = getModels();
  const now = new Date();

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );

  const [y, m, d] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  const startOfToday = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const endOfToday = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));

  const allPending = await LeadFollowUp.find({
    deletedAt: null,
    status: 'pending',
    follow_up_date: { $lte: endOfToday },
  })
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority assigned_to assigned_users created_by requirement products party_id contacts',
      populate: [
        { path: 'party_id', select: 'party_name legal_name' },
        { path: 'assigned_to', select: 'name email' },
        { path: 'assigned_users', select: 'name email' },
        { path: 'created_by', select: 'name email' },
      ],
    })
    .populate({
      path: 'quotation',
      select: 'quotation_no version grand_total status customer_name kind_attn phone email subject party_id created_by sales_person_user lead',
      populate: [
        { path: 'sales_person_user', select: 'name email' },
        { path: 'created_by', select: 'name email' },
      ],
    })
    .populate('created_by', 'name email department')
    .sort({ follow_up_date: 1, follow_up_time: 1 })
    .lean();

  const isAdmin = isLeadAdmin(user);
  const userStr = String(user._id);

  // Filter based on user scope (assigned to OR created by)
  const filtered = allPending.filter((fu) => {
    if (isAdmin) return true;
    const leadAssignee = fu.lead?.assigned_to?._id ? String(fu.lead.assigned_to._id) : (fu.lead?.assigned_to ? String(fu.lead.assigned_to) : null);
    const inAssignedUsers = Array.isArray(fu.lead?.assigned_users) && fu.lead.assigned_users.some((u) => String(u?._id || u) === userStr);
    const qRep = fu.quotation?.sales_person_user?._id ? String(fu.quotation.sales_person_user._id) : (fu.quotation?.sales_person_user ? String(fu.quotation.sales_person_user) : null);
    const isAssigned = leadAssignee === userStr || inAssignedUsers || qRep === userStr;

    const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
    const leadCreator = fu.lead?.created_by?._id ? String(fu.lead.created_by._id) : (fu.lead?.created_by ? String(fu.lead.created_by) : null);
    const qCreator = fu.quotation?.created_by?._id ? String(fu.quotation.created_by._id) : (fu.quotation?.created_by ? String(fu.quotation.created_by) : null);
    const isCreator = fuCreator === userStr || leadCreator === userStr || qCreator === userStr;

    return isAssigned || isCreator;
  });

  const overdue = [];
  const dueToday = [];
  const upcomingSoon = [];

  for (const item of filtered) {
    const isPast = new Date(item.follow_up_date) < startOfToday;
    if (isPast) {
      overdue.push(item);
    } else {
      dueToday.push(item);
      if (item.follow_up_time) {
        const timeParts = item.follow_up_time.split(':');
        if (timeParts.length >= 2) {
          const itemMins = parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
          if (itemMins >= currentMinutes && itemMins <= currentMinutes + 60) {
            upcomingSoon.push(item);
          }
        }
      }
    }
  }

  const quoteCount = filtered.filter((f) => f.quotation).length;
  const leadCount = filtered.filter((f) => f.lead && !f.quotation).length;

  return {
    total_urgent: filtered.length,
    overdue_count: overdue.length,
    today_count: dueToday.length,
    upcoming_soon_count: upcomingSoon.length,
    quote_count: quoteCount,
    lead_count: leadCount,
    overdue: overdue.map(toPlain),
    due_today: dueToday.map(toPlain),
    upcoming_soon: upcomingSoon.map(toPlain),
  };
}

/**
 * Append a collaborative comment or intermediate action to an existing follow-up.
 */
async function addAction(followUpId, body, user) {
  const { Lead, LeadFollowUp } = getModels();
  const fu = await LeadFollowUp.findOne({ _id: followUpId, deletedAt: null });
  if (!fu) throw new ApiError(404, 'Follow-up not found');

  if (fu.lead && user) {
    const lead = await Lead.findOne({ _id: fu.lead, deletedAt: null });
    if (lead) {
      await assertCanAccessLead(lead, user, 'update follow-ups for');
    }
  }

  const message = String(body.message || '').trim();
  if (!message) throw new ApiError(400, 'Message is required');

  const actionItem = {
    author: user._id,
    action_type: body.action_type || 'comment',
    message,
    metadata: body.metadata || {},
    created_at: new Date(),
  };

  fu.actions = fu.actions || [];
  fu.actions.push(actionItem);
  fu.updated_by = user._id;
  await fu.save();

  if (fu.lead) {
    await activityService.create({
      actor: user._id,
      entity_type: 'lead',
      entity_id: fu.lead,
      action: 'updated',
      message: `Follow-up action logged (${actionItem.action_type}): "${message.slice(0, 80)}"`,
      new_value: { follow_up_id: fu._id, action: actionItem },
    });
  } else if (fu.quotation) {
    await activityService.create({
      actor: user._id,
      entity_type: 'quotation',
      entity_id: fu.quotation,
      action: 'updated',
      message: `Quotation follow-up action logged (${actionItem.action_type}): "${message.slice(0, 80)}"`,
      new_value: { follow_up_id: fu._id, action: actionItem },
    });
  }

  const populated = await LeadFollowUp.findById(fu._id)
    .populate('created_by', 'name email department')
    .populate('completed_by', 'name email department')
    .populate('actions.author', 'name email department')
    .lean();

  return toPlain(populated);
}

module.exports = {
  createForLead,
  listForLead,
  complete,
  addAction,
  getCalendar,
  getUrgentSummary,
};
