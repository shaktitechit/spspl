/**
 * @fileoverview Work Planner: business rules and mongoose persistence with portal role support.
 * @module modules/workPlanner/workPlanner.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const notificationService = require('../notifications/notification.service');
const {
  sendWorkPlanCompletedEmail,
  sendCustomDayEndEmail,
  sendCustomWorkPlanCreationEmail,
  getWorkPlannerManagers,
  renderVisitsTable,
  renderTasksTable,
} = require('./workPlanNotification.service');
const {
  notifyWorkPlanCreated,
  notifyWorkPlanSubmitted,
  notifyWorkPlanApproved,
  notifyWorkPlanRejected,
  notifyVisitCreated,
  notifyTaskCreated,
  notifyAuthorityRemarkAdded,
  notifyJuniorFollowupAdded,
  notifyDirectiveResolved,
  notifyExpenseSubmitted,
  notifyExpenseApproved,
  notifyExpenseRejected,
  notifyDayEndCompleted,
} = require('./workPlannerAutoNotification.service');
const { resolveReportingStakeholderEmails } = require('./workPlannerTeamReporting.service');
const { syncPartyMasterForVisit } = require('./partySync.service');
const {
  EDITABLE_PLAN_STATUSES,
  EDITABLE_EXPENSE_STATUSES,
  TERMINAL_VISIT_STATUSES,
  TRAVEL_SUB_CATEGORIES,
  startOfDay,
  endOfDay,
  isAdminDept,
  isWpAdmin,
  isWpManager,
  isWpCoordinator,
  isWpElevated,
  isExecutive,
  isExpenseAddWindowOpen,
  isExpenseAddWindowEnded,
  isExpenseReceiptRequired,
} = require('./workPlanner.constants');
const {
  canAccessSalesUser,
  applySalesUserFilter,
  getVisibleSalesUserIds,
} = require('./teamVisibility.service');

function userId(user) {
  return user?._id || user?.id;
}

function getUserRole(user) {
  if (!user) return 'Executive';
  if (isWpAdmin(user)) return 'Portal Admin';
  if (isWpManager(user)) return 'Senior Manager';
  if (isWpCoordinator(user)) return 'Coordinator';
  if (isExecutive(user)) return 'Executive';

  const rawRole =
    user.role ||
    user.user_role ||
    (Array.isArray(user.roles) ? user.roles[0] : null) ||
    (Array.isArray(user.role_codes) ? user.role_codes[0] : null) ||
    user.department;

  if (rawRole) {
    const r = String(rawRole).toLowerCase();
    if (r.includes('admin') || r.includes('root') || r.includes('director')) return 'Portal Admin';
    if (r.includes('coord')) return 'Coordinator';
    if (r.includes('manager') || r.includes('mgmt') || r.includes('lead') || r.includes('head')) return 'Senior Manager';
    if (r.includes('sales') || r.includes('exec') || r.includes('officer') || r.includes('rep') || r.includes('user')) return 'Executive';
  }

  return 'Executive';
}

function applyAuthorityRemarks(doc, body, user) {
  if (!doc || !body) return null;
  const remarkText =
    (typeof body.manager_remarks === 'string' && body.manager_remarks.trim()) ||
    (typeof body.authority_remark === 'string' && body.authority_remark.trim()) ||
    (typeof body.authority_remarks === 'string' && body.authority_remarks.trim()) ||
    (typeof body.remark === 'string' && body.remark.trim());

  if (remarkText) {
    doc.manager_remarks = remarkText;
    if (!Array.isArray(doc.authority_remarks)) {
      doc.authority_remarks = [];
    }
    const uid = userId(user);
    const uName = user?.name || user?.email || 'Senior Authority';
    let uRole = getUserRole(user);
    if (uRole === 'Executive' && isWpElevated(user)) {
      uRole = 'Senior Authority';
    }

    const remarkType = ['instruction', 'appreciation', 'objection'].includes(body.remark_type)
      ? body.remark_type
      : 'instruction';
    const priority = ['low', 'medium', 'high', 'urgent'].includes(body.priority)
      ? body.priority
      : 'medium';
    const expectedFollowupDate = body.expected_followup_date ? new Date(body.expected_followup_date) : undefined;
    const initialStatus = remarkType === 'appreciation' ? 'responded' : 'pending_response';

    doc.authority_remarks.push({
      remark: remarkText,
      user: uid,
      user_name: uName,
      role: uRole,
      remark_type: remarkType,
      priority,
      expected_followup_date: expectedFollowupDate,
      status: initialStatus,
      followup_remarks: [],
      created_at: new Date(),
    });
    return remarkText;
  }
  return null;
}

/** Aggregate $match needs ObjectId; req.user ids are strings (see toReqUser). */
function asObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function parseCsvInts(value) {
  if (value == null || value === '') return [];
  const parts = Array.isArray(value) ? value : String(value).split(',');
  return parts
    .map((part) => parseInt(String(part).trim(), 10))
    .filter((n) => Number.isFinite(n));
}

function toValidDate(val, baseDate) {
  if (val == null || val === '') return undefined;
  if (val instanceof Date) return isNaN(val.getTime()) ? undefined : val;
  const d = new Date(val);
  if (!isNaN(d.getTime())) return d;

  if (typeof val === 'string') {
    const trimmed = val.trim();
    const timeMatch = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\s*([AP]M)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
      const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      const base = baseDate ? new Date(baseDate) : new Date();
      if (isNaN(base.getTime())) return undefined;
      base.setHours(hours, minutes, seconds, 0);
      return base;
    }
  }
  return undefined;
}

/** Date-range (`from`/`to`) or year+month (`years`, `months` 1–12) match on a date field. */
function planDatePeriodMatch(query = {}, datePath = 'plan_date') {
  if (query.from || query.to) {
    const range = {};
    if (query.from) range.$gte = startOfDay(query.from);
    if (query.to) range.$lte = endOfDay(query.to);
    return { [datePath]: range };
  }

  if (query.years == null && query.months == null) return {};

  const years = parseCsvInts(query.years);
  const months = parseCsvInts(query.months);
  if (years.length === 0 || months.length === 0) {
    return { $expr: { $eq: [0, 1] } };
  }

  const clauses = [
    { $in: [{ $year: `$${datePath}` }, years] },
    { $in: [{ $month: `$${datePath}` }, months] },
  ];
  return { $expr: { $and: clauses } };
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
}

function isOwner(plan, user) {
  if (!plan || !user) return false;
  const currentUid = userId(user) || user.sub;
  const planSalesUserId = plan.sales_user?._id || plan.sales_user?.id || plan.sales_user;
  if (sameId(planSalesUserId, currentUid)) return true;

  const planSalesEmail = plan.sales_user?.email || plan.sales_user_email;
  const currentUserEmail = user.email;
  if (planSalesEmail && currentUserEmail && String(planSalesEmail).toLowerCase().trim() === String(currentUserEmail).toLowerCase().trim()) {
    return true;
  }

  return false;
}

async function assertCanView(plan, user) {
  if (await canAccessSalesUser(user, plan.sales_user)) return;
  throw new ApiError(403, 'You do not have access to this work plan');
}

async function assertCanEditStructure(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or their manager can edit this work plan');
  }
  // Admin / manager (within team scope) may keep editing after submit/approve/completed.
  if (isWpElevated(user)) {
    return;
  }
  // Executive owners may edit planned, draft, or rejected plans (and Leave plans).
  if (!EDITABLE_PLAN_STATUSES.includes(plan.status) && !(plan.plan_type === 'Leave' && (plan.status === 'completed' || plan.status === 'planned'))) {
    throw new ApiError(400, `Cannot edit a work plan in status "${plan.status}"`);
  }
}

async function assertCanEditVisits(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or their manager can edit this work plan');
  }
  if (isWpElevated(user)) {
    return;
  }
  // Executive owners may edit visits/tasks on planned, draft, rejected, approved, submitted, or completed plans.
  if (!['planned', 'draft', 'rejected', 'approved', 'submitted', 'completed'].includes(plan.status)) {
    throw new ApiError(400, `Cannot edit visits for a work plan in status "${plan.status}"`);
  }
}

function assertValidPlanDateForUser(planDateInput, user) {
  if (isWpElevated(user)) return;
  const pDate = startOfDay(planDateInput);
  const minAllowed = startOfDay(new Date());
  minAllowed.setUTCDate(minAllowed.getUTCDate() - 2);

  if (pDate.getTime() < minAllowed.getTime()) {
    throw new ApiError(
      400,
      'Executives cannot create or edit work plans for dates earlier than 2 days before today',
    );
  }
}

async function logActivity(user, planId, action, message, extra = {}) {
  await activityService.create({
    actor: userId(user),
    entity_type: 'work_plan',
    entity_id: planId,
    action,
    message,
    ...extra,
  });
}

function parseStandaloneId(id) {
  if (typeof id !== 'string' || !id.startsWith('standalone_')) return null;
  const parts = id.split('_');
  // standalone_<userId>_<YYYY-MM-DD>
  const salesUserId = parts[1];
  const dateStr = parts.slice(2).join('_');
  return { salesUserId, dateStr };
}

async function loadPlanOrThrow(id) {
  const parsed = parseStandaloneId(id);
  if (parsed) {
    const { User, WorkPlanVisit, WorkPlanWork } = getModels();
    const userDoc =
      parsed.salesUserId && mongoose.Types.ObjectId.isValid(parsed.salesUserId)
        ? await User.findById(parsed.salesUserId).select('name email department').lean()
        : null;
    const planDate =
      parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : new Date();

    const [visitCount, workCount] = await Promise.all([
      parsed.salesUserId
        ? WorkPlanVisit.countDocuments({
            sales_user: parsed.salesUserId,
            work_plan: null,
            deletedAt: null,
            ...(parsed.dateStr && parsed.dateStr !== 'nodate'
              ? { plan_date: { $gte: startOfDay(parsed.dateStr), $lte: endOfDay(parsed.dateStr) } }
              : {}),
          })
        : 0,
      parsed.salesUserId
        ? WorkPlanWork.countDocuments({
            sales_user: parsed.salesUserId,
            work_plan: null,
            deletedAt: null,
            ...(parsed.dateStr && parsed.dateStr !== 'nodate'
              ? { plan_date: { $gte: startOfDay(parsed.dateStr), $lte: endOfDay(parsed.dateStr) } }
              : {}),
          })
        : 0,
    ]);

    const planType =
      visitCount > 0 && workCount > 0
        ? 'Tasks & Visits'
        : visitCount > 0
        ? 'Visits'
        : 'Work From Office';

    return {
      _id: id,
      id: id,
      is_standalone: true,
      plan_date: planDate,
      sales_user: userDoc || parsed.salesUserId,
      status: 'planned',
      plan_type: planType,
      location: 'HQ / Territory',
      remarks: '',
      is_discussed_with_manager: false,
      visit_count: visitCount,
      work_count: workCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }

  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null })
    .populate('sales_user', 'name email department')
    .populate('approved_by', 'name email')
    .populate('discussed_manager_id', 'name email department')
    .populate('day_end.attachments')
    .lean();
  if (!plan) throw new ApiError(404, 'Work plan not found');
  return plan;
}

async function loadVisits(planId) {
  const { WorkPlanVisit } = getModels();
  const parsed = parseStandaloneId(planId);
  let filter;
  if (parsed) {
    const planDate = parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : null;
    filter = {
      sales_user: parsed.salesUserId,
      work_plan: null,
      deletedAt: null,
      ...(planDate ? { plan_date: { $gte: startOfDay(planDate), $lte: endOfDay(planDate) } } : {}),
    };
  } else if (!mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  } else {
    filter = { work_plan: planId, deletedAt: null };
  }

  const rows = await WorkPlanVisit.find(filter)
    .populate('party', 'party_name mobile email contact_person contacts billing_address shipping_address')
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .sort({ sequence: 1 })
    .lean();
  const { withFreshVisitSelfieUrls } = require('../../services/fileManagement');
  return Promise.all(
    rows.map(async (v) => {
      const plain = toPlain(v);
      if (!plain.check_in_address && typeof plain.check_in_lat === 'number' && typeof plain.check_in_lng === 'number') {
        plain.check_in_address = `Lat: ${plain.check_in_lat.toFixed(4)}, Lng: ${plain.check_in_lng.toFixed(4)}`;
      }
      if (!plain.check_out_address && typeof plain.check_out_lat === 'number' && typeof plain.check_out_lng === 'number') {
        plain.check_out_address = `Lat: ${plain.check_out_lat.toFixed(4)}, Lng: ${plain.check_out_lng.toFixed(4)}`;
      }
      return withFreshVisitSelfieUrls(plain);
    })
  );
}

async function loadExpenses(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  }
  const { WorkPlanExpense } = getModels();
  const { withFreshExpenseAttachmentUrls } = require('../../services/fileManagement');
  const rows = await WorkPlanExpense.find({ work_plan: planId, deletedAt: null })
    .populate('sales_user', 'name email department')
    .populate('receipt_attachment')
    .populate('attachments')
    .populate('start_reading_image')
    .populate('end_reading_image')
    .populate('approved_by', 'name email')
    .populate('created_by', 'name email')
    .sort({ expense_date: 1, createdAt: 1 })
    .lean();
  return Promise.all(rows.map((row) => withFreshExpenseAttachmentUrls(toPlain(row))));
}

function buildExpenseTotals(expenses) {
  let expense_total = 0;
  let expense_approved_total = 0;
  const visit_expense_totals = {};

  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    expense_total += amount;
    if (exp.status === 'approved') expense_approved_total += amount;
    const visitKey = exp.work_plan_visit
      ? String(exp.work_plan_visit._id || exp.work_plan_visit)
      : null;
    if (visitKey) {
      visit_expense_totals[visitKey] = (visit_expense_totals[visitKey] || 0) + amount;
    }
  }

  return { expense_total, expense_approved_total, visit_expense_totals };
}

async function getWithVisits(id) {
  const plan = await loadPlanOrThrow(id);
  const { withFreshViewUrl } = require('../../services/fileManagement');
  if (plan.day_end && Array.isArray(plan.day_end.attachments)) {
    plan.day_end.attachments = await Promise.all(
      plan.day_end.attachments.map((att) => withFreshViewUrl(att))
    );
  }
  const [visits, works, expenses] = await Promise.all([loadVisits(id), loadWorks(id), loadExpenses(id)]);
  const totals = buildExpenseTotals(expenses);
  return { ...toPlain(plan), visits, works, expenses, ...totals };
}

async function renumberVisits(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) return;
  const { WorkPlanVisit } = getModels();
  const visits = await WorkPlanVisit.find({ work_plan: planId, deletedAt: null })
    .sort({ sequence: 1 })
    .lean();
  for (let i = 0; i < visits.length; i += 1) {
    await WorkPlanVisit.updateOne(
      { _id: visits[i]._id },
      { $set: { sequence: (i + 1) * 1000 } }
    );
  }
  for (let i = 0; i < visits.length; i += 1) {
    await WorkPlanVisit.updateOne({ _id: visits[i]._id }, { $set: { sequence: i + 1 } });
  }
}

async function maybeCompletePlan(planId, user) {
  // Plan completion is manual via Complete Work Plan button
  return;
}

async function maybeCompleteWorkPlan(planId, user) {
  // Plan completion is manual via Complete Work Plan button
  return;
}

async function completePlan(id, user, dayEndData = null) {
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user)) {
    if (!isWpElevated(user) && !isAdminDept(user)) {
      throw new ApiError(403, 'Only the plan owner or authorized manager can complete this work plan');
    }
    if (!(await canAccessSalesUser(user, plan.sales_user))) {
      throw new ApiError(403, 'You do not have permission to complete this work plan');
    }
  }
  if (!['planned', 'approved', 'submitted', 'completed'].includes(plan.status)) {
    throw new ApiError(400, `Only active planned work plans can be completed (current status: "${plan.status}")`);
  }

  plan.status = 'completed';
  plan.updated_by = userId(user);

  if (dayEndData && typeof dayEndData === 'object') {
    const rawAtts = dayEndData.attachment_ids || dayEndData.attachmentIds || dayEndData.attachments;
    const validAttachmentIds = Array.isArray(rawAtts)
      ? rawAtts
          .map((aid) => (typeof aid === 'object' && aid ? aid._id || aid.id : aid))
          .filter((aid) => aid && mongoose.Types.ObjectId.isValid(aid))
      : [];

    plan.day_end = {
      completed_at: new Date(),
      from_email: dayEndData.from_email || user.email,
      to_email: dayEndData.to_email || '',
      cc_emails: Array.isArray(dayEndData.cc_emails)
        ? dayEndData.cc_emails.map((e) => String(e).trim()).filter(Boolean)
        : Array.isArray(dayEndData.ccEmails)
        ? dayEndData.ccEmails.map((e) => String(e).trim()).filter(Boolean)
        : [],
      subject: dayEndData.subject || `Day End Report — ${user.name || user.email}`,
      body_html: dayEndData.body_html || '',
      attachments: validAttachmentIds,
    };
  }

  await plan.save();
  await logActivity(user, id, 'status_changed', 'Work plan marked completed via Day End');

  // Trigger completion auto notification (in-app + emails to stakeholders)
  notifyDayEndCompleted({ planId: id, actorUser: user, dayEndData }).catch((err) =>
    console.error('[workPlanner.service] Day End auto-notification error:', err?.message || err)
  );

  return get(id, user);
}

async function getDayEndDraft(id, user) {
  const plan = await loadPlanOrThrow(id);
  await assertCanView(plan, user);

  const [visits, works, expenses] = await Promise.all([
    loadVisits(id),
    loadWorks(id),
    loadExpenses(id),
  ]);

  const planType = plan.plan_type || 'Visits';
  const targetUserId = plan.sales_user?._id || plan.sales_user || user._id;
  const planLean = typeof plan.toObject === 'function' ? plan.toObject() : plan;

  const {
    directManager,
    uplineManagers,
    primaryRecipientEmail,
    ccList: reportingCcList,
  } = await resolveReportingStakeholderEmails(targetUserId, planLean);

  const managers = await getWorkPlannerManagers();
  const reportingChain = [directManager, ...(uplineManagers || [])].filter(Boolean);
  const reportingIds = new Set(reportingChain.map((m) => String(m._id)));
  const managerList = [
    ...reportingChain.map((m) => ({
      _id: String(m._id),
      name: m.name || m.email.split('@')[0],
      email: m.email,
      department: m.department || '',
      isReportingManager: true,
    })),
    ...managers
      .filter((m) => m.email && !reportingIds.has(String(m._id)))
      .map((m) => ({
        _id: String(m._id),
        name: m.name || m.email.split('@')[0],
        email: m.email,
        department: m.department || '',
        isReportingManager: false,
      })),
  ];

  let userSettings = null;
  try {
    userSettings = await getUserSettings(targetUserId, user);
  } catch (e) {
    // fallback if user settings not found
  }

  const pts = userSettings?.planTypeSettings?.[planType];
  const ptsManagerEmail = pts?.assignedManagerEmail;
  const globalManagerEmail = userSettings?.assignedManagerEmail;

  let firstManagerEmail =
    primaryRecipientEmail ||
    ptsManagerEmail ||
    globalManagerEmail ||
    (plan.discussed_manager_id && plan.discussed_manager_id.email ? plan.discussed_manager_id.email : '') ||
    (managerList.length > 0 ? managerList[0].email : '');

  const ptsCc = pts?.ccEmails || [];
  const globalCc = userSettings?.ccEmails || [];
  const configuredCc = ptsCc.length > 0 ? ptsCc : globalCc;

  const ccEmails = [...new Set([...configuredCc, ...(reportingCcList || [])])].filter(
    (email) => email && email.toLowerCase() !== String(firstManagerEmail || '').toLowerCase()
  );

  const executiveName = user.name || user.email?.split('@')[0] || 'Executive';
  const executiveEmail = user.email || '';
  const fromAddress = `${executiveName} <${executiveEmail}>`;

  const planDateStr = plan.plan_date
    ? new Date(plan.plan_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB');

  const subject = `Day End Report — ${executiveName} (${planDateStr})`;
  const expensesTotal = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const visitsTableHtml = renderVisitsTable(visits);
  const tasksTableHtml = renderTasksTable(works);

  const defaultHtmlBody = `
<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
    <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">Day End Report — Summary</h2>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Executive:</strong> ${executiveName} (${executiveEmail})</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Date:</strong> ${planDateStr}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan Type:</strong> ${plan.plan_type || 'Visits'} | <strong>Location:</strong> ${plan.location || 'N/A'}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Total Expenses Logged:</strong> ₹${expensesTotal.toLocaleString('en-IN')}</p>
  </div>

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-top: 24px;">Field Visits (${visits.length})</h3>
  ${visitsTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #059669; padding-bottom: 6px; margin-top: 24px;">Tasks / Work Items (${works.length})</h3>
  ${tasksTableHtml}

  <h3 style="color: #0f172a; font-size: 16px; border-bottom: 2px solid #475569; padding-bottom: 6px; margin-top: 24px;">Key Highlights & Day End Remarks</h3>
  <p style="font-size: 14px; color: #334155; padding: 12px; background: #f1f5f9; border-radius: 6px;">
    ${plan.remarks ? plan.remarks : 'Please add any specific highlights, order wins, follow-ups, or escalations here...'}
  </p>
</div>
  `.trim();

  return {
    plan_id: String(plan._id),
    plan_date: plan.plan_date,
    from: fromAddress,
    from_email: executiveEmail,
    to: firstManagerEmail,
    cc: ccEmails,
    subject,
    body_html: defaultHtmlBody,
    managers: managerList,
  };
}

async function list(query = {}, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, user, query);

  if (query.status) filter.status = query.status;
  if (query.plan_type && query.plan_type !== 'all') {
    if (query.plan_type === 'Visits') {
      filter.$or = [
        { plan_type: 'Visits' },
        { plan_type: { $exists: false } },
        { plan_type: null },
        { plan_type: '' },
      ];
    } else {
      filter.plan_type = query.plan_type;
    }
  }

  if (query.date) {
    filter.plan_date = {
      $gte: startOfDay(query.date),
      $lte: endOfDay(query.date),
    };
  } else if (query.from || query.to) {
    filter.plan_date = {};
    if (query.from) filter.plan_date.$gte = startOfDay(query.from);
    if (query.to) filter.plan_date.$lte = endOfDay(query.to);
  }

  if (query.party) {
    const planIds = await WorkPlanVisit.distinct('work_plan', {
      party: query.party,
      deletedAt: null,
    });
    filter._id = { $in: planIds };
  }

  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    WorkPlan.countDocuments(filter),
    WorkPlan.find(filter)
      .populate('sales_user', 'name email department')
      .populate('approved_by', 'name email')
      .populate('discussed_manager_id', 'name email department')
      .sort({ plan_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const planIds = rows.map((r) => r._id);
  const [visitCounts, workCounts] = await Promise.all([
    WorkPlanVisit.aggregate([
      { $match: { work_plan: { $in: planIds }, deletedAt: null } },
      { $group: { _id: '$work_plan', count: { $sum: 1 } } },
    ]),
    WorkPlanWork.aggregate([
      { $match: { work_plan: { $in: planIds }, deletedAt: null } },
      { $group: { _id: '$work_plan', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(visitCounts.map((c) => [String(c._id), c.count]));
  const workCountMap = new Map(workCounts.map((c) => [String(c._id), c.count]));

  const includeVisits =
    query.include_visits === '1' ||
    query.include_visits === 1 ||
    query.include_visits === true ||
    query.include_visits === 'true';
  const includeWorks =
    query.include_works === '1' ||
    query.include_works === 1 ||
    query.include_works === true ||
    query.include_works === 'true';

  const visitsByPlan = new Map();
  if (includeVisits && planIds.length) {
    const allVisits = await WorkPlanVisit.find({
      work_plan: { $in: planIds },
      deletedAt: null,
    })
      .populate(
        'party',
        'party_name mobile email contact_person contacts billing_address shipping_address',
      )
      .sort({ sequence: 1 })
      .lean();
    for (const visit of allVisits) {
      const key = String(visit.work_plan);
      if (!visitsByPlan.has(key)) visitsByPlan.set(key, []);
      visitsByPlan.get(key).push(toPlain(visit));
    }
  }

  const worksByPlan = new Map();
  if (includeWorks && planIds.length) {
    const allWorks = await WorkPlanWork.find({
      work_plan: { $in: planIds },
      deletedAt: null,
    })
      .sort({ sequence: 1 })
      .lean();
    for (const work of allWorks) {
      const key = String(work.work_plan);
      if (!worksByPlan.has(key)) worksByPlan.set(key, []);
      worksByPlan.get(key).push(toPlain(work));
    }
  }

  let standaloneRows = [];
  if (includeVisits || includeWorks || query.include_standalone) {
    const standaloneFilter = { work_plan: null, deletedAt: null };
    await applySalesUserFilter(standaloneFilter, user, query);

    if (query.date) {
      standaloneFilter.plan_date = {
        $gte: startOfDay(query.date),
        $lte: endOfDay(query.date),
      };
    } else if (query.from || query.to) {
      standaloneFilter.plan_date = {};
      if (query.from) standaloneFilter.plan_date.$gte = startOfDay(query.from);
      if (query.to) standaloneFilter.plan_date.$lte = endOfDay(query.to);
    }

    let standaloneVisits = [];
    let standaloneWorks = [];
    if (includeVisits || query.include_standalone) {
      standaloneVisits = await WorkPlanVisit.find(standaloneFilter)
        .populate('sales_user', 'name email department')
        .populate(
          'party',
          'party_name mobile email contact_person contacts billing_address shipping_address',
        )
        .sort({ sequence: 1 })
        .lean();
    }
    if (includeWorks || query.include_standalone) {
      standaloneWorks = await WorkPlanWork.find(standaloneFilter)
        .populate('sales_user', 'name email department')
        .sort({ sequence: 1 })
        .lean();
    }

    const standaloneGroups = new Map();
    for (const v of standaloneVisits) {
      const sUserId = String(v.sales_user?._id || v.sales_user || '');
      const dateStr = v.plan_date ? new Date(v.plan_date).toISOString().slice(0, 10) : 'nodate';
      const groupKey = `${sUserId}_${dateStr}`;
      if (!standaloneGroups.has(groupKey)) {
        standaloneGroups.set(groupKey, {
          sales_user: v.sales_user,
          plan_date: v.plan_date,
          visits: [],
          works: [],
        });
      }
      standaloneGroups.get(groupKey).visits.push(toPlain(v));
    }
    for (const w of standaloneWorks) {
      const sUserId = String(w.sales_user?._id || w.sales_user || '');
      const dateStr = w.plan_date ? new Date(w.plan_date).toISOString().slice(0, 10) : 'nodate';
      const groupKey = `${sUserId}_${dateStr}`;
      if (!standaloneGroups.has(groupKey)) {
        standaloneGroups.set(groupKey, {
          sales_user: w.sales_user,
          plan_date: w.plan_date,
          visits: [],
          works: [],
        });
      }
      standaloneGroups.get(groupKey).works.push(toPlain(w));
    }

    for (const [, group] of standaloneGroups.entries()) {
      const dateStr = group.plan_date ? new Date(group.plan_date).toISOString().slice(0, 10) : 'nodate';
      const sUserId = String(group.sales_user?._id || group.sales_user || '');
      const virtualId = `standalone_${sUserId}_${dateStr}`;
      standaloneRows.push({
        _id: virtualId,
        id: virtualId,
        is_standalone: true,
        plan_date: group.plan_date,
        sales_user: group.sales_user,
        status: 'planned',
        plan_type: group.visits.length > 0 ? 'Visits' : 'Tasks',
        location: 'HQ / Territory',
        visit_count: group.visits.length,
        work_count: group.works.length,
        ...(includeVisits ? { visits: group.visits } : {}),
        ...(includeWorks ? { works: group.works } : {}),
        createdAt: group.visits[0]?.createdAt || group.works[0]?.createdAt || new Date(),
        updatedAt: group.visits[0]?.updatedAt || group.works[0]?.updatedAt || new Date(),
      });
    }
  }

  const combinedData = [
    ...rows.map((r) => {
      const id = String(r._id);
      const visits = includeVisits ? visitsByPlan.get(id) || [] : undefined;
      const works = includeWorks ? worksByPlan.get(id) || [] : undefined;
      return {
        ...toPlain(r),
        visit_count: countMap.get(id) || (visits ? visits.length : 0),
        work_count: workCountMap.get(id) || (works ? works.length : 0),
        ...(includeVisits ? { visits } : {}),
        ...(includeWorks ? { works } : {}),
      };
    }),
    ...standaloneRows,
  ];

  return {
    total: total + standaloneRows.length,
    page,
    limit,
    pages: Math.ceil((total + standaloneRows.length) / limit) || 0,
    data: combinedData,
  };
}

async function get(id, user) {
  const plan = await loadPlanOrThrow(id);
  await assertCanView(plan, user);
  const { withFreshViewUrl } = require('../../services/fileManagement');
  if (plan.day_end && Array.isArray(plan.day_end.attachments)) {
    plan.day_end.attachments = await Promise.all(
      plan.day_end.attachments.map((att) => withFreshViewUrl(att))
    );
  }
  const [visits, works, expenses] = await Promise.all([loadVisits(id), loadWorks(id), loadExpenses(id)]);
  const totals = buildExpenseTotals(expenses);
  return { ...toPlain(plan), visits, works, expenses, ...totals };
}

async function create(body, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  assertValidPlanDateForUser(body.plan_date, user);
  let salesUserId = userId(user);
  if (body.sales_user && String(body.sales_user) !== String(userId(user))) {
    if (!isWpElevated(user)) {
      throw new ApiError(403, 'Only managers or admins can create plans for other users');
    }
    if (!(await canAccessSalesUser(user, body.sales_user))) {
      throw new ApiError(403, 'You can only create plans for yourself or your team members');
    }
    salesUserId = body.sales_user;
  }
  const planDate = startOfDay(body.plan_date);

  try {
    const isLeave = (body.plan_type?.trim() || 'Visits') === 'Leave';
    const doc = await WorkPlan.create({
      plan_date: planDate,
      sales_user: salesUserId,
      status: isLeave ? 'completed' : 'planned',
      remarks: body.remarks?.trim() || undefined,
      location: body.location?.trim() || undefined,
      country_id: (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : undefined,
      state_id: (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : undefined,
      city_id: (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id))
        ? body.city_id
        : (Array.isArray(body.city_ids) && body.city_ids[0] && mongoose.Types.ObjectId.isValid(body.city_ids[0]))
          ? body.city_ids[0]
          : undefined,
      city_ids: Array.isArray(body.city_ids) ? body.city_ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : undefined,
      country: body.country?.trim() || undefined,
      state: body.state?.trim() || undefined,
      city: body.city?.trim() || (Array.isArray(body.cities) && body.cities.length > 0 ? body.cities.join(', ') : undefined),
      cities: Array.isArray(body.cities) ? body.cities.map((s) => String(s).trim()).filter(Boolean) : undefined,
      plan_type: body.plan_type?.trim() || 'Visits',
      is_discussed_with_manager: Boolean(body.is_discussed_with_manager),
      discussed_manager_id: body.discussed_manager_id || undefined,
      discussed_manager_name: body.discussed_manager_name?.trim() || undefined,
      discussion_method: body.discussion_method?.trim() || undefined,
      created_by: userId(user),
      updated_by: userId(user),
    });

    // Automatically link any pre-existing standalone visits and works for this date to the new plan (only if not Leave)
    if (doc.plan_type !== 'Leave') {
      await WorkPlanVisit.updateMany(
        { sales_user: salesUserId, plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) }, work_plan: null, deletedAt: null },
        { $set: { work_plan: doc._id } }
      );
      await WorkPlanWork.updateMany(
        { sales_user: salesUserId, plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) }, work_plan: null, deletedAt: null },
        { $set: { work_plan: doc._id } }
      );
      await renumberVisits(doc._id);
      await renumberWorks(doc._id);
    }

    await logActivity(user, doc._id, 'created', `Work plan created for ${planDate.toISOString().slice(0, 10)}`);

    // Clean up any cloud running draft for this user & plan date
    const { WorkPlanDraft } = getModels();
    if (WorkPlanDraft) {
      await WorkPlanDraft.deleteMany({
        sales_user: salesUserId,
        plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) },
      }).catch(() => {});
    }

    // Plan mail is sent only from submit(), after visits and tasks have been saved.

    return get(doc._id, user);
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, 'A work plan already exists for this sales user on the selected date');
    }
    throw err;
  }
}

async function update(id, body, user) {
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  await assertCanEditStructure(plan, user);

  if (body.plan_date !== undefined) {
    assertValidPlanDateForUser(body.plan_date, user);
    plan.plan_date = startOfDay(body.plan_date);
  }
  if (body.remarks !== undefined) {
    plan.remarks = typeof body.remarks === 'string' ? body.remarks.trim() : body.remarks;
  }
  if (body.location !== undefined) {
    plan.location =
      typeof body.location === 'string' ? body.location.trim() : body.location;
  }
  if (body.country_id !== undefined) {
    plan.country_id = (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : null;
  }
  if (body.state_id !== undefined) {
    plan.state_id = (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : null;
  }
  if (body.city_id !== undefined || body.city_ids !== undefined) {
    if (body.city_id !== undefined) {
      plan.city_id = (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : null;
    } else if (Array.isArray(body.city_ids) && body.city_ids.length > 0 && mongoose.Types.ObjectId.isValid(body.city_ids[0])) {
      plan.city_id = body.city_ids[0];
    }
    if (Array.isArray(body.city_ids)) {
      plan.city_ids = body.city_ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    }
  }
  if (body.country !== undefined) {
    plan.country = typeof body.country === 'string' ? body.country.trim() : body.country;
  }
  if (body.state !== undefined) {
    plan.state = typeof body.state === 'string' ? body.state.trim() : body.state;
  }
  if (body.city !== undefined || body.cities !== undefined) {
    if (body.city !== undefined) {
      plan.city = typeof body.city === 'string' ? body.city.trim() : body.city;
    } else if (Array.isArray(body.cities) && body.cities.length > 0) {
      plan.city = body.cities.join(', ');
    }
    if (Array.isArray(body.cities)) {
      plan.cities = body.cities.map((s) => String(s).trim()).filter(Boolean);
    }
  }
  if (body.plan_type !== undefined) {
    plan.plan_type =
      typeof body.plan_type === 'string' ? body.plan_type.trim() : body.plan_type;
    if (plan.plan_type === 'Leave') {
      plan.status = 'completed';
      const { WorkPlanVisit, WorkPlanWork } = getModels();
      const now = new Date();
      await WorkPlanVisit.updateMany({ work_plan: plan._id, deletedAt: null }, { $set: { deletedAt: now } });
      await WorkPlanWork.updateMany({ work_plan: plan._id, deletedAt: null }, { $set: { deletedAt: now } });
    }
  }
  if (body.is_discussed_with_manager !== undefined) {
    plan.is_discussed_with_manager = Boolean(body.is_discussed_with_manager);
  }
  if (body.discussed_manager_id !== undefined) {
    plan.discussed_manager_id = body.discussed_manager_id || undefined;
  }
  if (body.discussed_manager_name !== undefined) {
    plan.discussed_manager_name =
      typeof body.discussed_manager_name === 'string'
        ? body.discussed_manager_name.trim()
        : body.discussed_manager_name;
  }
  if (body.discussion_method !== undefined) {
    plan.discussion_method =
      typeof body.discussion_method === 'string'
        ? body.discussion_method.trim()
        : body.discussion_method;
  }
  if (body.status !== undefined && isWpElevated(user)) {
    plan.status = body.status;
  }

  const appliedRemark = applyAuthorityRemarks(plan, body, user);

  // Rejected plans return to draft when edited
  if (plan.status === 'rejected' && body.status === undefined) {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.approved_by = undefined;
    plan.approved_at = undefined;
    plan.submitted_at = undefined;
  }

  plan.updated_by = userId(user);

  try {
    await plan.save();
  } catch (err) {
    if (err && err.code === 11000) {
      throw new ApiError(409, 'A work plan already exists for this sales user on the selected date');
    }
    throw err;
  }

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId: plan._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  await logActivity(user, plan._id, 'updated', 'Work plan updated');
  return get(plan._id, user);
}

async function remove(id, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  if (!isOwner(plan, user)) {
    if (!isAdminDept(user) && !isWpElevated(user)) {
      throw new ApiError(403, 'Only the plan owner or authorized manager can delete this work plan');
    }
    if (!(await canAccessSalesUser(user, plan.sales_user))) {
      throw new ApiError(403, 'You do not have permission to delete this work plan');
    }
  }
  if (plan.status === 'completed' && plan.plan_type !== 'Leave' && !isAdminDept(user) && !isWpElevated(user)) {
    throw new ApiError(400, 'Completed work plans cannot be deleted');
  }

  const now = new Date();
  plan.deletedAt = now;
  plan.updated_by = userId(user);
  await plan.save();
  await WorkPlanVisit.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
  await WorkPlanWork.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
  await WorkPlanExpense.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });

  // Restore all notes linked to this deleted work plan back to active scratchpad notes
  try {
    const { UserNote } = getModels();
    if (UserNote) {
      await UserNote.updateMany(
        { work_plan: id, is_converted_to_work_plan: true },
        {
          $set: {
            is_converted_to_work_plan: false,
            work_plan: null,
            work_plan_item_id: null,
            work_plan_date: null,
            converted_at: null,
          },
        }
      );
    }
  } catch (err) {
    logger.warn(`[workPlanner.service] Failed to restore notes for removed work plan ${id}:`, err);
  }

  await logActivity(user, plan._id, 'deleted', 'Work plan deleted');
  return toPlain(plan.toObject());
}

async function submit(id, user, body = {}) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Cannot submit a virtual work plan directly; please save it as a work plan first');
  }
  const { WorkPlan, WorkPlanVisit, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  if (!isOwner(plan, user)) {
    if (!isWpElevated(user) && !isAdminDept(user)) {
      throw new ApiError(403, 'Only the plan owner or authorized manager can submit this work plan');
    }
    if (!(await canAccessSalesUser(user, plan.sales_user))) {
      throw new ApiError(403, 'You do not have permission to submit this work plan');
    }
  }
  if (!EDITABLE_PLAN_STATUSES.includes(plan.status) && !(plan.plan_type === 'Leave' && (plan.status === 'completed' || plan.status === 'planned'))) {
    throw new ApiError(400, `Cannot submit a work plan in status "${plan.status}"`);
  }

  const planType = plan.plan_type || 'Visits';
  if (planType === 'Visits') {
    const visitCount = await WorkPlanVisit.countDocuments({ work_plan: id, deletedAt: null });
    if (visitCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one visit');
    }
  } else if (planType === 'Work From Home' || planType === 'Work From Office') {
    const workCount = await WorkPlanWork.countDocuments({ work_plan: id, deletedAt: null });
    if (workCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one work task');
    }
  } else if (planType === 'Tasks & Visits') {
    const visitCount = await WorkPlanVisit.countDocuments({ work_plan: id, deletedAt: null });
    const workCount = await WorkPlanWork.countDocuments({ work_plan: id, deletedAt: null });
    if (visitCount < 1 && workCount < 1) {
      throw new ApiError(400, 'Work plan cannot be submitted without at least one visit or work task');
    }
  }

  if (plan.plan_type === 'Leave') {
    const { WorkPlanVisit, WorkPlanWork } = getModels();
    const now = new Date();
    await WorkPlanVisit.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
    await WorkPlanWork.updateMany({ work_plan: id, deletedAt: null }, { $set: { deletedAt: now } });
  }

  plan.status = plan.plan_type === 'Leave' ? 'completed' : 'planned';
  plan.submitted_at = new Date();
  plan.rejection_reason = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'submitted', plan.plan_type === 'Leave' ? 'Leave work plan submitted and completed' : 'Work plan saved as planned');

  // In-app notice only after visits and tasks are saved. Mail is sent only when the client includes a recipient.
  notifyWorkPlanCreated({ planId: plan._id, actorUser: user, creationMailData: body }).catch((err) => {
    const { logger } = require('../../utils/logger');
    logger.error(`[WorkPlanService] Failed to send creation notification for plan ${id}: ${err.message}`);
  });

  return get(plan._id, user);
}

async function approve(id, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only manager or admin can approve work plans');
  }
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (plan.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted work plans can be approved');
  }

  plan.status = 'approved';
  plan.approved_by = userId(user);
  plan.approved_at = new Date();
  plan.rejection_reason = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'approved', 'Work plan approved');
  notifyWorkPlanApproved({ planId: plan._id, actorUser: user }).catch((err) => {
    console.error('[WorkPlanner] Error notifying plan approved:', err);
  });

  return get(plan._id, user);
}

async function reject(id, body, user) {
  if (parseStandaloneId(id) || !mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(404, 'Work plan not found');
  }
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only manager or admin can reject work plans');
  }
  const { WorkPlan } = getModels();
  const plan = await WorkPlan.findOne({ _id: id, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (plan.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted work plans can be rejected');
  }

  plan.status = 'rejected';
  plan.rejection_reason = body.rejection_reason.trim();
  plan.approved_by = undefined;
  plan.approved_at = undefined;
  plan.updated_by = userId(user);
  await plan.save();

  await logActivity(user, plan._id, 'rejected', `Work plan rejected: ${plan.rejection_reason}`);
  notifyWorkPlanRejected({ planId: plan._id, actorUser: user, reason: plan.rejection_reason }).catch((err) => {
    console.error('[WorkPlanner] Error notifying plan rejected:', err);
  });

  return get(plan._id, user);
}

async function addStandaloneVisit(body, user) {
  const { WorkPlan, WorkPlanVisit, Party } = getModels();

  let salesUserId = userId(user);
  if (body.sales_user || body.salesUserId) {
    const requestedUser = String(body.sales_user || body.salesUserId);
    if (requestedUser !== String(userId(user))) {
      if (!isWpElevated(user)) {
        throw new ApiError(403, 'Only managers or admins can plan visits for other users');
      }
      if (!(await canAccessSalesUser(user, requestedUser))) {
        throw new ApiError(403, 'You can only plan visits for yourself or your team members');
      }
      salesUserId = requestedUser;
    }
  }

  const rawDate = body.plan_date || body.planDate || new Date();
  const planDate = startOfDay(rawDate);
  const userRole = getUserRole(user);

  // Sync Party Master (check party master with name, contact, email, gst; create with party_type 'visits' if not exist, or update)
  const partySyncResult = await syncPartyMasterForVisit(body, user);
  const resolvedPartyId =
    partySyncResult?._id ||
    (body.party && mongoose.Types.ObjectId.isValid(body.party) ? body.party : undefined);

  const partyType = body.party_type || (resolvedPartyId ? 'existing' : 'new_party');
  let partyDoc = null;
  if (resolvedPartyId) {
    partyDoc = partySyncResult || (await Party.findOne({ _id: resolvedPartyId, deletedAt: null }).lean());
  }

  const partyName =
    body.party_name?.trim() ||
    partyDoc?.party_name ||
    undefined;

  // Check if a work plan already exists for this sales user on that date
  const existingPlan = await WorkPlan.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    deletedAt: null,
  });

  if (existingPlan) {
    const maxSeq = await WorkPlanVisit.findOne({
      work_plan: existingPlan._id,
      deletedAt: null,
    })
      .sort({ sequence: -1 })
      .select('sequence')
      .lean();

    const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

    const visit = await WorkPlanVisit.create({
      work_plan: existingPlan._id,
      sales_user: salesUserId,
      plan_date: planDate,
      sequence,
      party_type: partyType,
      party: resolvedPartyId,
      party_name: partyName,
      contact_person: body.contact_person?.trim() || undefined,
      contact_number: body.contact_number?.trim() || undefined,
      contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
      contacts: body.contacts,
      address: body.address?.trim() || undefined,
      country: body.country?.trim() || undefined,
      state: body.state?.trim() || undefined,
      city: body.city?.trim() || undefined,
      country_id: (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : undefined,
      state_id: (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : undefined,
      city_id: (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : undefined,
      gst_no: body.gst_no?.trim()?.toUpperCase() || undefined,
      planned_start_time: toValidDate(body.planned_start_time, planDate),
      planned_end_time: toValidDate(body.planned_end_time, planDate),
      purpose: body.purpose?.trim() || undefined,
      notes: body.notes?.trim() || undefined,
      status: body.status || 'created',
      pending_remarks: body.pending_remarks?.trim() || undefined,
      in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
      created_by: userId(user),
      created_by_role: userRole,
      updated_by: userId(user),
      updated_by_role: userRole,
    });

    if (existingPlan.status === 'rejected') {
      existingPlan.status = 'draft';
      existingPlan.rejection_reason = undefined;
      existingPlan.submitted_at = undefined;
      existingPlan.updated_by = userId(user);
      await existingPlan.save();
    }

    await renumberVisits(existingPlan._id);
    await logActivity(user, existingPlan._id, 'created', `Visit added to work plan for ${planDate.toISOString().slice(0, 10)}`);

    return toPlain(visit);
  }

  const maxSeq = await WorkPlanVisit.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    work_plan: null,
    deletedAt: null,
  })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();

  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const visit = await WorkPlanVisit.create({
    work_plan: null,
    sales_user: salesUserId,
    plan_date: planDate,
    sequence,
    party_type: partyType,
    party: resolvedPartyId,
    party_name: partyName,
    contact_person: body.contact_person?.trim() || undefined,
    contact_number: body.contact_number?.trim() || undefined,
    contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
    contacts: body.contacts,
    address: body.address?.trim() || undefined,
    country: body.country?.trim() || undefined,
    state: body.state?.trim() || undefined,
    city: body.city?.trim() || undefined,
    country_id: (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : undefined,
    state_id: (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : undefined,
    city_id: (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : undefined,
    gst_no: body.gst_no?.trim()?.toUpperCase() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, planDate),
    planned_end_time: toValidDate(body.planned_end_time, planDate),
    purpose: body.purpose?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  await logActivity(user, salesUserId, 'created', `Standalone visit created for ${planDate.toISOString().slice(0, 10)}`);

  return toPlain(visit);
}

async function updateStandaloneVisit(visitId, body, user) {
  const { WorkPlanVisit, Party } = getModels();
  const visit = await WorkPlanVisit.findOne({ _id: visitId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  if (!admin && visit.sales_user && String(visit.sales_user) !== String(userId(user))) {
    if (!(await canAccessSalesUser(user, visit.sales_user))) {
      throw new ApiError(403, 'You do not have permission to edit this visit');
    }
  }

  if (body.party_type !== undefined || body.party !== undefined) {
    const nextPartyType =
      body.party_type !== undefined
        ? String(body.party_type)
        : visit.party_type || (visit.party ? 'existing' : 'new_party');

    visit.party_type = nextPartyType;

    if (nextPartyType === 'existing') {
      const partyId = body.party !== undefined ? body.party : visit.party;
      if (partyId) {
        const partyDoc = await Party.findOne({ _id: partyId, deletedAt: null }).lean();
        if (partyDoc) {
          visit.party = partyId;
          if (body.party_name === undefined && !visit.party_name) {
            visit.party_name = partyDoc.party_name;
          }
        }
      }
    } else {
      visit.party = undefined;
    }
  }

  const baseDate = visit.plan_date || new Date();
  if (body.party_name !== undefined) visit.party_name = body.party_name?.trim() || undefined;
  if (body.contact_person !== undefined) visit.contact_person = body.contact_person?.trim() || undefined;
  if (body.contact_number !== undefined) visit.contact_number = body.contact_number?.trim() || undefined;
  if (body.contact_email !== undefined) {
    visit.contact_email = body.contact_email?.trim()?.toLowerCase() || undefined;
  }
  if (body.contacts !== undefined) visit.contacts = body.contacts;
  if (body.address !== undefined) visit.address = body.address?.trim() || undefined;
  if (body.country !== undefined) visit.country = body.country?.trim() || undefined;
  if (body.state !== undefined) visit.state = body.state?.trim() || undefined;
  if (body.city !== undefined) visit.city = body.city?.trim() || undefined;
  if (body.country_id !== undefined) {
    visit.country_id = (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : undefined;
  }
  if (body.state_id !== undefined) {
    visit.state_id = (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : undefined;
  }
  if (body.city_id !== undefined) {
    visit.city_id = (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : undefined;
  }
  if (body.gst_no !== undefined) visit.gst_no = body.gst_no?.trim()?.toUpperCase() || undefined;

  // If party details were provided, check/sync Party Master
  if (body.party || body.party_name || body.contact_person || body.contact_number || body.contact_email || body.gst_no || body.address || body.contacts || body.country || body.state || body.city || body.country_id || body.state_id || body.city_id) {
    const partySyncResult = await syncPartyMasterForVisit({
      ...visit.toObject(),
      ...body,
    }, user);
    if (partySyncResult?._id) {
      visit.party = partySyncResult._id;
    }
  }
  if (body.sequence !== undefined) visit.sequence = Number(body.sequence);
  if (body.planned_start_time !== undefined) {
    visit.planned_start_time = toValidDate(body.planned_start_time, baseDate);
  }
  if (body.planned_end_time !== undefined) {
    visit.planned_end_time = toValidDate(body.planned_end_time, baseDate);
  }
  if (body.purpose !== undefined) visit.purpose = body.purpose?.trim() || undefined;
  if (body.notes !== undefined) visit.notes = body.notes?.trim() || undefined;
  if (body.status !== undefined) visit.status = body.status;
  if (body.pending_remarks !== undefined) visit.pending_remarks = body.pending_remarks?.trim() || undefined;
  if (body.in_progress_remarks !== undefined) visit.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  if (body.outcome !== undefined) visit.outcome = body.outcome?.trim() || undefined;
  if (body.meeting_with_doctor !== undefined) visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  if (body.meeting_with_purchase !== undefined) visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  if (body.meeting_with_finance !== undefined) visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  if (body.meeting_with_engineer !== undefined) visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  if (body.new_product_introduced !== undefined) visit.new_product_introduced = Boolean(body.new_product_introduced);
  if (body.order_received !== undefined) visit.order_received = Boolean(body.order_received);

  if (body.check_in_selfie_url !== undefined) visit.check_in_selfie_url = body.check_in_selfie_url;
  if (body.check_out_selfie_url !== undefined) visit.check_out_selfie_url = body.check_out_selfie_url;
  if (body.outcome_selfie_url !== undefined) visit.outcome_selfie_url = body.outcome_selfie_url;

  if (body.check_in_lat !== undefined) visit.check_in_lat = body.check_in_lat;
  if (body.check_in_lng !== undefined) visit.check_in_lng = body.check_in_lng;
  if (body.check_in_address !== undefined) visit.check_in_address = body.check_in_address;

  if (body.check_out_lat !== undefined) visit.check_out_lat = body.check_out_lat;
  if (body.check_out_lng !== undefined) visit.check_out_lng = body.check_out_lng;
  if (body.check_out_address !== undefined) visit.check_out_address = body.check_out_address;

  const rescheduleDateStr = body.rescheduled_date || body.rescheduledDate;
  if (rescheduleDateStr !== undefined) {
    visit.rescheduled_date = rescheduleDateStr ? toValidDate(rescheduleDateStr, rescheduleDateStr) : undefined;
  }

  const appliedRemark = applyAuthorityRemarks(visit, body, user);

  visit.updated_by = userId(user);
  visit.updated_by_role = getUserRole(user);

  await visit.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId: visit.work_plan, visitId: visit._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  if (body.status === 'rescheduled' && rescheduleDateStr && body.auto_schedule !== false) {
    try {
      await addStandaloneVisit({
        sales_user: visit.sales_user,
        plan_date: rescheduleDateStr,
        party_type: visit.party_type,
        party: visit.party,
        party_name: visit.party_name,
        contact_person: visit.contact_person,
        contact_number: visit.contact_number,
        contact_email: visit.contact_email,
        contacts: visit.contacts,
        address: visit.address,
        purpose: visit.purpose,
        notes: body.remarks || body.pending_remarks || visit.notes,
        manager_remarks: body.manager_remarks || visit.manager_remarks,
        status: 'created',
      }, user);
    } catch (err) {
      console.error('Failed to auto-schedule standalone visit to target date:', err);
    }
  }

  const { withFreshVisitSelfieUrls } = require('../../services/fileManagement');
  return withFreshVisitSelfieUrls(toPlain(visit));
}

async function removeStandaloneVisit(visitId, user) {
  const { WorkPlanVisit } = getModels();
  const visit = await WorkPlanVisit.findOne({ _id: visitId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  const elevated = isWpElevated(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(visit.created_by_role || '').trim()
  );
  if (!admin && !elevated && isManagerCreated) {
    throw new ApiError(403, 'Visits created by a Manager cannot be removed by an Executive');
  }

  if (!admin && !elevated && !['created', 'pending', 'rescheduled', 'skipped', 'cancelled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot delete a visit in status "${visit.status}"`);
  }

  visit.deletedAt = new Date();
  await visit.save();
  return { success: true };
}

async function addVisit(planId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const parsed = parseStandaloneId(planId);
    const salesUserId = parsed?.salesUserId || body.sales_user || userId(user);
    const planDate = parsed?.dateStr && parsed.dateStr !== 'nodate' ? parsed.dateStr : body.plan_date;
    return addStandaloneVisit({ ...body, sales_user: salesUserId, plan_date: planDate }, user);
  }

  const { WorkPlan, WorkPlanVisit, Party } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  // Sync Party Master
  const partySyncResult = await syncPartyMasterForVisit(body, user);
  const resolvedPartyId =
    partySyncResult?._id ||
    (body.party && mongoose.Types.ObjectId.isValid(body.party) ? body.party : undefined);

  const partyType = body.party_type || (resolvedPartyId ? 'existing' : '');
  let partyDoc = null;
  if (resolvedPartyId) {
    partyDoc = partySyncResult || (await Party.findOne({ _id: resolvedPartyId, deletedAt: null }).lean());
  }

  const maxSeq = await WorkPlanVisit.findOne({ work_plan: planId, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const partyName =
    body.party_name?.trim() ||
    partyDoc?.party_name ||
    undefined;

  const userRole = getUserRole(user);

  const existingVisitId = body._id || body.visit_id || body.id;
  if (existingVisitId) {
    const existingVisit = await WorkPlanVisit.findOne({ _id: existingVisitId, deletedAt: null });
    if (existingVisit) {
      existingVisit.work_plan = planId;
      existingVisit.sales_user = plan.sales_user;
      existingVisit.plan_date = plan.plan_date;
      existingVisit.sequence = sequence;
      if (body.planned_start_time !== undefined) {
        existingVisit.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
      }
      if (body.planned_end_time !== undefined) {
        existingVisit.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
      }
      if (resolvedPartyId) {
        existingVisit.party = resolvedPartyId;
      }
      existingVisit.updated_by = userId(user);
      existingVisit.updated_by_role = userRole;
      await existingVisit.save();

      if (plan.status === 'rejected') {
        plan.status = 'draft';
        plan.rejection_reason = undefined;
        plan.submitted_at = undefined;
        plan.updated_by = userId(user);
        await plan.save();
      }

      await renumberVisits(planId);
      await logActivity(user, planId, 'updated', `Visit reassigned (sequence ${sequence})`);
      return getWithVisits(planId);
    }
  }

  const visit = await WorkPlanVisit.create({
    work_plan: planId,
    sales_user: plan.sales_user,
    plan_date: plan.plan_date,
    sequence,
    party_type: partyType,
    party: resolvedPartyId,
    party_name: partyName,
    contact_person: body.contact_person?.trim() || undefined,
    contact_number: body.contact_number?.trim() || undefined,
    contact_email: body.contact_email?.trim()?.toLowerCase() || undefined,
    contacts: body.contacts,
    address: body.address?.trim() || undefined,
    country: body.country?.trim() || undefined,
    state: body.state?.trim() || undefined,
    city: body.city?.trim() || undefined,
    country_id: (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : undefined,
    state_id: (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : undefined,
    city_id: (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : undefined,
    gst_no: body.gst_no?.trim()?.toUpperCase() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, plan.plan_date),
    planned_end_time: toValidDate(body.planned_end_time, plan.plan_date),
    purpose: body.purpose?.trim() || undefined,
    notes: body.notes?.trim() || undefined,
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberVisits(planId);
  await logActivity(user, planId, 'updated', `Visit added (sequence ${sequence})`);

  return getWithVisits(planId);
}

async function updateVisit(planId, visitId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return updateStandaloneVisit(visitId, body, user);
  }

  const { WorkPlan, WorkPlanVisit, Party } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  await assertCanEditVisits(plan, user);

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  if (!admin && !isWpElevated(user) && !['created', 'pending', 'in_progress', 'rescheduled', 'checked_in', 'completed', 'skipped', 'cancelled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot edit a visit in status "${visit.status}"`);
  }

  if (body.party_type !== undefined || body.party !== undefined) {
    const nextPartyType =
      body.party_type !== undefined
        ? String(body.party_type)
        : visit.party_type || (visit.party ? 'existing' : 'new_party');

    visit.party_type = nextPartyType;

    if (nextPartyType === 'existing') {
      const partyId = body.party !== undefined ? body.party : visit.party;
      if (partyId) {
        const partyDoc = await Party.findOne({ _id: partyId, deletedAt: null }).lean();
        if (partyDoc) {
          visit.party = partyId;
          if (body.party_name === undefined && !visit.party_name) {
            visit.party_name = partyDoc.party_name;
          }
        }
      }
    } else {
      visit.party = undefined;
    }
  }

  if (body.party_name !== undefined) visit.party_name = body.party_name?.trim() || undefined;
  if (body.contact_person !== undefined) visit.contact_person = body.contact_person?.trim() || undefined;
  if (body.contact_number !== undefined) visit.contact_number = body.contact_number?.trim() || undefined;
  if (body.contact_email !== undefined) {
    visit.contact_email = body.contact_email?.trim()?.toLowerCase() || undefined;
  }
  if (body.contacts !== undefined) visit.contacts = body.contacts;
  if (body.address !== undefined) visit.address = body.address?.trim() || undefined;
  if (body.sequence !== undefined) visit.sequence = Number(body.sequence);
  if (body.planned_start_time !== undefined) {
    visit.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
  }
  if (body.planned_end_time !== undefined) {
    visit.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
  }
  if (body.purpose !== undefined) visit.purpose = body.purpose?.trim() || undefined;
  if (body.notes !== undefined) visit.notes = body.notes?.trim() || undefined;
  if (body.status !== undefined) visit.status = body.status;
  if (body.pending_remarks !== undefined) visit.pending_remarks = body.pending_remarks?.trim() || undefined;
  if (body.in_progress_remarks !== undefined) visit.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  if (body.outcome !== undefined) visit.outcome = body.outcome?.trim() || undefined;
  if (body.meeting_with_doctor !== undefined) visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  if (body.meeting_with_purchase !== undefined) visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  if (body.meeting_with_finance !== undefined) visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  if (body.meeting_with_engineer !== undefined) visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  if (body.new_product_introduced !== undefined) visit.new_product_introduced = Boolean(body.new_product_introduced);
  if (body.order_received !== undefined) visit.order_received = Boolean(body.order_received);

  if (body.check_in_selfie_url !== undefined) visit.check_in_selfie_url = body.check_in_selfie_url;
  if (body.check_out_selfie_url !== undefined) visit.check_out_selfie_url = body.check_out_selfie_url;
  if (body.outcome_selfie_url !== undefined) visit.outcome_selfie_url = body.outcome_selfie_url;

  if (body.check_in_lat !== undefined) visit.check_in_lat = body.check_in_lat;
  if (body.check_in_lng !== undefined) visit.check_in_lng = body.check_in_lng;
  if (body.check_in_address !== undefined) visit.check_in_address = body.check_in_address;

  if (body.check_out_lat !== undefined) visit.check_out_lat = body.check_out_lat;
  if (body.check_out_lng !== undefined) visit.check_out_lng = body.check_out_lng;
  if (body.check_out_address !== undefined) visit.check_out_address = body.check_out_address;

  const rescheduleDateStr = body.rescheduled_date || body.rescheduledDate;
  if (rescheduleDateStr !== undefined) {
    visit.rescheduled_date = rescheduleDateStr ? toValidDate(rescheduleDateStr, rescheduleDateStr) : undefined;
  }

  const appliedRemark = applyAuthorityRemarks(visit, body, user);

  visit.updated_by = userId(user);
  visit.updated_by_role = getUserRole(user);

  await visit.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId: visit.work_plan, visitId: visit._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  if (body.status === 'rescheduled' && rescheduleDateStr && body.auto_schedule !== false) {
    try {
      await addStandaloneVisit({
        sales_user: visit.sales_user || plan.sales_user,
        plan_date: rescheduleDateStr,
        party_type: visit.party_type,
        party: visit.party,
        party_name: visit.party_name,
        contact_person: visit.contact_person,
        contact_number: visit.contact_number,
        contact_email: visit.contact_email,
        contacts: visit.contacts,
        address: visit.address,
        purpose: visit.purpose,
        notes: body.remarks || body.pending_remarks || visit.notes,
        manager_remarks: body.manager_remarks || visit.manager_remarks,
        status: 'created',
      }, user);
    } catch (err) {
      console.error('Failed to auto-schedule visit to target date:', err);
    }
  }

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberVisits(planId);
  await logActivity(user, planId, 'updated', `Visit updated (${visitId})`);
  return getWithVisits(planId);
}

async function removeVisit(planId, visitId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return removeStandaloneVisit(visitId, user);
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');

  const admin = isAdminDept(user);
  const elevated = isWpElevated(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(visit.created_by_role || '').trim()
  );
  if (!admin && !elevated && isManagerCreated) {
    throw new ApiError(403, 'Visits created by a Manager cannot be removed by an Executive');
  }

  if (!admin && !elevated && !['created', 'pending', 'rescheduled', 'skipped', 'cancelled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot delete a visit in status "${visit.status}"`);
  }

  visit.deletedAt = new Date();
  await visit.save();
  await renumberVisits(planId);

  // Restore linked Scratchpad notes back to active pending status
  try {
    const { UserNote } = getModels();
    if (UserNote) {
      await UserNote.updateMany(
        {
          $or: [
            { work_plan_item_id: visit._id || visitId },
            { work_plan: planId, type: 'visit', party_name: visit.party_name },
          ],
          is_converted_to_work_plan: true,
        },
        {
          $set: {
            is_converted_to_work_plan: false,
            work_plan: null,
            work_plan_item_id: null,
            work_plan_date: null,
            converted_at: null,
          },
        }
      );
    }
  } catch (err) {
    logger.warn(`[workPlanner.service] Failed to restore notes for removed visit ${visitId}:`, err);
  }

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await logActivity(user, planId, 'updated', `Visit deleted (${visitId})`);
  return getWithVisits(planId);
}

async function reverseGeocodeAddress(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  try {
    const axios = require('axios');
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: { 'User-Agent': 'OPMS-WorkPlanner-Backend/1.0' },
        timeout: 4000,
      }
    );
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
  } catch (_err) {}
  return null;
}

async function checkIn(planId, visitId, body = {}, user) {
  const selfieUrl = body.selfie_url || body.check_in_selfie_url || null;
  const lat = typeof body.lat === 'number' ? body.lat : (body.check_in_lat || null);
  const lng = typeof body.lng === 'number' ? body.lng : (body.check_in_lng || null);
  let address = body.address || body.check_in_address || null;
  if (!address && lat !== null && lng !== null) {
    address = await reverseGeocodeAddress(lat, lng);
    if (!address && typeof lat === 'number' && typeof lng === 'number') {
      address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  }

  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const visit = await updateStandaloneVisit(visitId, {
      status: 'checked_in',
      actual_check_in: new Date(),
      ...(selfieUrl ? { check_in_selfie_url: selfieUrl } : {}),
      ...(lat !== null ? { check_in_lat: lat } : {}),
      ...(lng !== null ? { check_in_lng: lng } : {}),
      ...(address ? { check_in_address: address } : {}),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Checked in to visit ${visit.sequence}`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can check in');
  }
  if (!['planned', 'approved', 'draft'].includes(plan.status)) {
    throw new ApiError(400, 'Visits can only be executed on planned work plans');
  }

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (!['created', 'pending', 'rescheduled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot check in a visit in status "${visit.status}"`);
  }

  visit.status = 'checked_in';
  visit.actual_check_in = new Date();
  if (selfieUrl) visit.check_in_selfie_url = selfieUrl;
  if (lat !== null) visit.check_in_lat = lat;
  if (lng !== null) visit.check_in_lng = lng;
  if (address) visit.check_in_address = address;
  await visit.save();

  await logActivity(user, planId, 'status_changed', `Checked in to visit ${visit.sequence}`);
  return getWithVisits(planId);
}

async function checkOut(planId, visitId, body = {}, user) {
  const selfieUrl = body.selfie_url || body.check_out_selfie_url || null;
  const lat = typeof body.lat === 'number' ? body.lat : (body.check_out_lat || null);
  const lng = typeof body.lng === 'number' ? body.lng : (body.check_out_lng || null);
  let address = body.address || body.check_out_address || null;
  if (!address && lat !== null && lng !== null) {
    address = await reverseGeocodeAddress(lat, lng);
    if (!address && typeof lat === 'number' && typeof lng === 'number') {
      address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  }

  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const visit = await updateStandaloneVisit(visitId, {
      status: 'checked_out',
      actual_check_out: new Date(),
      ...(selfieUrl ? { check_out_selfie_url: selfieUrl } : {}),
      ...(lat !== null ? { check_out_lat: lat } : {}),
      ...(lng !== null ? { check_out_lng: lng } : {}),
      ...(address ? { check_out_address: address } : {}),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Checked out from visit ${visit.sequence}`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);
  if (!isOwner(plan, user) && !isAdminDept(user)) {
    throw new ApiError(403, 'Only the plan owner can check out');
  }
  if (!['planned', 'approved', 'draft'].includes(plan.status)) {
    throw new ApiError(400, 'Visits can only be executed on planned work plans');
  }

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (visit.status !== 'checked_in') {
    throw new ApiError(400, 'Visit must be checked in before check out');
  }

  visit.status = 'checked_out';
  visit.actual_check_out = new Date();
  if (selfieUrl) visit.check_out_selfie_url = selfieUrl;
  if (lat !== null) visit.check_out_lat = lat;
  if (lng !== null) visit.check_out_lng = lng;
  if (address) visit.check_out_address = address;
  await visit.save();

  await logActivity(user, planId, 'status_changed', `Checked out from visit ${visit.sequence}`);
  return getWithVisits(planId);
}

async function completeVisit(planId, visitId, body, user) {
  const selfieUrl = body?.selfie_url || body?.outcome_selfie_url || body?.check_out_selfie_url || null;
  const lat = typeof body?.check_out_lat === 'number' ? body.check_out_lat : (typeof body?.lat === 'number' ? body.lat : null);
  const lng = typeof body?.check_out_lng === 'number' ? body.check_out_lng : (typeof body?.lng === 'number' ? body.lng : null);
  let address = body?.check_out_address || body?.address || null;
  if (!address && lat !== null && lng !== null) {
    address = await reverseGeocodeAddress(lat, lng);
    if (!address && typeof lat === 'number' && typeof lng === 'number') {
      address = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    }
  }

  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const outcomeText = typeof body?.outcome === 'string' ? body.outcome.trim() : (body?.outcome ? String(body.outcome).trim() : '');
    if (!outcomeText) {
      throw new ApiError(400, 'Outcome / completion remarks are required to complete a visit');
    }
    const visit = await updateStandaloneVisit(visitId, {
      status: 'completed',
      outcome: outcomeText,
      meeting_with_doctor: Boolean(body?.meeting_with_doctor),
      meeting_with_purchase: Boolean(body?.meeting_with_purchase),
      meeting_with_finance: Boolean(body?.meeting_with_finance),
      meeting_with_engineer: Boolean(body?.meeting_with_engineer),
      new_product_introduced: Boolean(body?.new_product_introduced),
      order_received: Boolean(body?.order_received),
      ...(selfieUrl ? { outcome_selfie_url: selfieUrl, check_out_selfie_url: selfieUrl } : {}),
      ...(lat !== null ? { check_out_lat: lat } : {}),
      ...(lng !== null ? { check_out_lng: lng } : {}),
      ...(address ? { check_out_address: address } : {}),
    }, user);
    await logActivity(user, visit.sales_user || userId(user), 'status_changed', `Visit ${visit.sequence} completed`);
    return visit;
  }

  const { WorkPlan, WorkPlanVisit } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanView(plan, user);

  const visit = await WorkPlanVisit.findOne({ _id: visitId, work_plan: planId, deletedAt: null });
  if (!visit) throw new ApiError(404, 'Visit not found');
  if (!isAdminDept(user) && !isWpElevated(user) && !['created', 'pending', 'in_progress', 'checked_in', 'rescheduled', 'completed', 'skipped', 'cancelled'].includes(visit.status)) {
    throw new ApiError(400, `Cannot complete a visit in status "${visit.status}"`);
  }

  const outcomeText = typeof body?.outcome === 'string' ? body.outcome.trim() : (body?.outcome ? String(body.outcome).trim() : '');
  if (!outcomeText) {
    throw new ApiError(400, 'Outcome / completion remarks are required to complete a visit');
  }

  visit.status = 'completed';
  visit.outcome = outcomeText;
  visit.meeting_with_doctor = Boolean(body.meeting_with_doctor);
  visit.meeting_with_purchase = Boolean(body.meeting_with_purchase);
  visit.meeting_with_finance = Boolean(body.meeting_with_finance);
  visit.meeting_with_engineer = Boolean(body.meeting_with_engineer);
  visit.new_product_introduced = Boolean(body.new_product_introduced);
  visit.order_received = Boolean(body.order_received);
  if (selfieUrl) {
    visit.outcome_selfie_url = selfieUrl;
    visit.check_out_selfie_url = selfieUrl;
  }
  if (lat !== null) visit.check_out_lat = lat;
  if (lng !== null) visit.check_out_lng = lng;
  if (address) visit.check_out_address = address;
  if (!visit.actual_check_out) visit.actual_check_out = new Date();
  if (!visit.actual_check_in) visit.actual_check_in = visit.actual_check_out;

  const appliedRemark = applyAuthorityRemarks(visit, body, user);

  visit.updated_by = userId(user);
  visit.updated_by_role = getUserRole(user);

  await visit.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId, visitId: visit._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  await logActivity(user, planId, 'status_changed', `Visit ${visit.sequence} completed`);
  await maybeCompletePlan(planId, user);
  return getWithVisits(planId);
}

async function stats(query = {}, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const filter = { deletedAt: null };

  await applySalesUserFilter(filter, user, query);

  Object.assign(filter, planDatePeriodMatch(query));

  let salesUserMatch = {};
  let planAggMatch = { ...filter };
  if (filter.sales_user) {
    if (filter.sales_user.$in) {
      salesUserMatch = { 'plan.sales_user': { $in: filter.sales_user.$in } };
    } else if (filter.sales_user.$ne) {
      salesUserMatch = { 'plan.sales_user': { $ne: filter.sales_user.$ne } };
    } else {
      const salesUserOid = asObjectId(filter.sales_user);
      if (salesUserOid) {
        salesUserMatch = { 'plan.sales_user': salesUserOid };
        planAggMatch = { ...filter, sales_user: salesUserOid };
      }
    }
  }

  const today = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const nestedPlanDateMatch = planDatePeriodMatch(query, 'plan.plan_date');
  const planNotDraftMatch = { 'plan.deletedAt': null };
  const todayFilter = {
    deletedAt: null,
    plan_date: { $gte: today, $lte: todayEnd },
    ...(filter.sales_user ? { sales_user: filter.sales_user } : {}),
  };

  const [
    totalPlans,
    todayPlans,
    pendingApproval,
    approved,
    completed,
    rejected,
    statusGroups,
    visitAgg,
    workAgg,
    typeGroups,
    monthlyTrend,
    expenseAgg,
    expenseMonthlyTrend,
  ] = await Promise.all([
    WorkPlan.countDocuments(filter),
    WorkPlan.countDocuments(todayFilter),
    WorkPlan.countDocuments({ ...filter, status: 'submitted' }),
    WorkPlan.countDocuments({ ...filter, status: 'approved' }),
    WorkPlan.countDocuments({ ...filter, status: 'completed' }),
    WorkPlan.countDocuments({ ...filter, status: 'rejected' }),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    WorkPlanVisit.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: '$work_plan',
          visit_count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          plans_with_visits: { $sum: 1 },
          total_visits: { $sum: '$visit_count' },
        },
      },
    ]),
    WorkPlanWork.aggregate([
      {
        $lookup: {
          from: WorkPlan.collection.name,
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: '$work_plan',
          work_count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: null,
          plans_with_works: { $sum: 1 },
          total_works: { $sum: '$work_count' },
        },
      },
    ]),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      {
        $group: {
          _id: { $ifNull: ['$plan_type', 'Visits'] },
          count: { $sum: 1 },
        },
      },
    ]),
    WorkPlan.aggregate([
      { $match: planAggMatch },
      {
        $group: {
          _id: {
            year: { $year: '$plan_date' },
            month: { $month: '$plan_date' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
    WorkPlanExpense.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: null,
          expense_total: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0],
            },
          },
          expense_pending_approval: {
            $sum: {
              $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0],
            },
          },
          expense_approved_count: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, 1, 0],
            },
          },
        },
      },
    ]),
    WorkPlanExpense.aggregate([
      {
        $lookup: {
          from: 'workplans',
          localField: 'work_plan',
          foreignField: '_id',
          as: 'plan',
        },
      },
      { $unwind: '$plan' },
      {
        $match: {
          deletedAt: null,
          status: 'approved',
          'plan.deletedAt': null,
          ...nestedPlanDateMatch,
          ...planNotDraftMatch,
          ...salesUserMatch,
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$expense_date' },
            month: { $month: '$expense_date' },
          },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
    ]),
  ]);

  const visitSummary = visitAgg[0] || { plans_with_visits: 0, total_visits: 0 };
  const averageVisits =
    visitSummary.plans_with_visits > 0
      ? Math.round((visitSummary.total_visits / visitSummary.plans_with_visits) * 10) / 10
      : 0;

  const workSummary = workAgg[0] || { plans_with_works: 0, total_works: 0 };
  const averageWorks =
    workSummary.plans_with_works > 0
      ? Math.round((workSummary.total_works / workSummary.plans_with_works) * 10) / 10
      : 0;

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g._id, g.count]));
  const byPlanType = Object.fromEntries(
    typeGroups.map((g) => [g._id || 'Visits', g.count])
  );
  const expenseSummary = expenseAgg[0] || {
    expense_total: 0,
    expense_pending_approval: 0,
    expense_approved_count: 0,
  };

  return {
    total_plans: totalPlans,
    today_plans: todayPlans,
    pending_approval: pendingApproval,
    approved,
    completed,
    rejected,
    average_visits: averageVisits,
    average_works: averageWorks,
    total_visits: visitSummary.total_visits || 0,
    total_works: workSummary.total_works || 0,
    by_status: byStatus,
    by_plan_type: byPlanType,
    monthly_trend: monthlyTrend.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      count: m.count,
    })),
    expense_total: expenseSummary.expense_total || 0,
    expense_pending_approval: expenseSummary.expense_pending_approval || 0,
    expense_approved_count: expenseSummary.expense_approved_count || 0,
    expense_monthly_trend: expenseMonthlyTrend.map((m) => ({
      year: m._id.year,
      month: m._id.month,
      amount: m.amount,
      count: m.count,
    })),
  };
}

async function assertCanManageExpense(plan, user) {
  if (!(await canAccessSalesUser(user, plan.sales_user))) {
    throw new ApiError(403, 'Only the plan owner or manager can manage expenses');
  }
}

async function assertCanEditExpense(expense, plan, user) {
  await assertCanManageExpense(plan, user);
  if (isWpElevated(user)) {
    if (expense.status === 'approved') {
      throw new ApiError(400, 'Cannot edit an approved expense');
    }
    return;
  }
  if (!EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, `Cannot edit an expense in status "${expense.status}"`);
  }
}

async function resolveExpenseVisit(planId, visitId) {
  if (!visitId) return null;
  const { WorkPlanVisit } = getModels();
  const visit = await WorkPlanVisit.findOne({
    _id: visitId,
    work_plan: planId,
    deletedAt: null,
  }).lean();
  if (!visit) throw new ApiError(400, 'work_plan_visit must belong to this work plan');
  return visit._id;
}

function applyExpenseFields(expense, body, { isCreate = false } = {}) {
  if (isCreate || body.expense_date !== undefined) {
    expense.expense_date = startOfDay(body.expense_date);
  }
  if (isCreate || body.category !== undefined) {
    expense.category = String(body.category).trim();
  }
  if (isCreate || body.category !== undefined || body.sub_category !== undefined) {
    if (expense.category === 'Travel') {
      const sub = String(body.sub_category || expense.sub_category || '').trim();
      if (!TRAVEL_SUB_CATEGORIES.includes(sub)) {
        throw new ApiError(
          400,
          `sub_category must be one of: ${TRAVEL_SUB_CATEGORIES.join(', ')} when category is Travel`,
        );
      }
      expense.sub_category = sub;
    } else {
      expense.sub_category = undefined;
    }
  }
  if (isCreate || body.amount !== undefined) {
    expense.amount = Number(body.amount);
  }
  if (isCreate || body.payment_mode !== undefined) {
    expense.payment_mode = String(body.payment_mode).trim();
  }
  if (body.vendor_name !== undefined) {
    expense.vendor_name =
      typeof body.vendor_name === 'string' ? body.vendor_name.trim() : body.vendor_name;
  }
  if (body.bill_number !== undefined) {
    expense.bill_number =
      typeof body.bill_number === 'string' ? body.bill_number.trim() : body.bill_number;
  }
  if (body.bill_date !== undefined) {
    expense.bill_date =
      body.bill_date === null || body.bill_date === ''
        ? undefined
        : startOfDay(body.bill_date);
  }
  if (body.description !== undefined) {
    expense.description =
      typeof body.description === 'string' ? body.description.trim() : body.description;
  }
  if (body.receipt_attachment !== undefined) {
    expense.receipt_attachment =
      body.receipt_attachment === null || body.receipt_attachment === ''
        ? null
        : body.receipt_attachment;
  }
  if (body.attachments !== undefined) {
    if (Array.isArray(body.attachments)) {
      expense.attachments = body.attachments.filter(Boolean);
      if (expense.attachments.length > 0 && !expense.receipt_attachment) {
        expense.receipt_attachment = expense.attachments[0];
      }
    } else if (body.attachments === null) {
      expense.attachments = [];
    }
  } else if (expense.receipt_attachment && (!expense.attachments || expense.attachments.length === 0)) {
    expense.attachments = [expense.receipt_attachment];
  }

  const isPrivateBike =
    expense.category === 'Travel' && expense.sub_category === 'Private Bike';

  if (isPrivateBike) {
    if (isCreate || body.start_reading !== undefined) {
      expense.start_reading = Number(body.start_reading);
    }
    if (isCreate || body.closing_reading !== undefined) {
      expense.closing_reading = Number(body.closing_reading);
    }
    const start = Number(expense.start_reading);
    const closing = Number(expense.closing_reading);
    if (Number.isFinite(start) && Number.isFinite(closing) && closing >= start) {
      expense.total_km = Math.round((closing - start) * 100) / 100;
      expense.rate_per_km = 3.5;
      // Auto-calculate amount at 3.5 rupees per km
      expense.amount = Math.round(expense.total_km * 3.5 * 100) / 100;
    }
    if (body.start_reading_image !== undefined) {
      expense.start_reading_image =
        body.start_reading_image === null || body.start_reading_image === ''
          ? null
          : body.start_reading_image;
    }
    if (body.end_reading_image !== undefined) {
      expense.end_reading_image =
        body.end_reading_image === null || body.end_reading_image === ''
          ? null
          : body.end_reading_image;
    }
  } else if (
    isCreate ||
    body.category !== undefined ||
    body.sub_category !== undefined
  ) {
    expense.start_reading = undefined;
    expense.closing_reading = undefined;
    expense.total_km = undefined;
    expense.rate_per_km = undefined;
    expense.start_reading_image = null;
    expense.end_reading_image = null;
  }
}

function assertPrivateBikeExpense(expense) {
  if (expense.category !== 'Travel' || expense.sub_category !== 'Private Bike') {
    return;
  }
  const start = Number(expense.start_reading);
  const closing = Number(expense.closing_reading);
  if (!Number.isFinite(start) || start < 0) {
    throw new ApiError(400, 'start_reading is required for Private Bike expenses');
  }
  if (!Number.isFinite(closing) || closing < 0) {
    throw new ApiError(400, 'closing_reading is required for Private Bike expenses');
  }
  if (closing < start) {
    throw new ApiError(400, 'closing_reading must be greater than or equal to start_reading');
  }
}

async function listAllExpenses(query = {}, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const limit = Math.min(parseInt(query.limit, 10) || 50, 1000);
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const selfId = String(userId(user) || '');
  const isMineScope = String(query.scope || query.ownership || '').toLowerCase() === 'mine';
  const targetUserParam =
    query.sales_user ||
    query.sales_user_id ||
    query.salesUser ||
    query.user ||
    query.userId ||
    query.user_id;
  const isSelfFilter = targetUserParam && String(targetUserParam) === selfId;
  const isViewingSelf = isMineScope || isSelfFilter || (!isWpElevated(user));

  const visible = await getVisibleSalesUserIds(user);
  let allowedUserOids = null;
  if (isMineScope || isSelfFilter) {
    allowedUserOids = [asObjectId(selfId)].filter(Boolean);
  } else if (targetUserParam && targetUserParam !== 'all') {
    if (visible !== null && !visible.includes(String(targetUserParam))) {
      return { total: 0, page: 1, limit, pages: 0, data: [] };
    }
    allowedUserOids = [asObjectId(targetUserParam)].filter(Boolean);
  } else if (visible !== null) {
    allowedUserOids = visible.map(asObjectId).filter(Boolean);
  }

  const filter = { deletedAt: null };

  if (allowedUserOids) {
    const planIds = await WorkPlan.find({
      sales_user: { $in: allowedUserOids },
      deletedAt: null,
    }).distinct('_id');

    filter.$or = [
      { work_plan: { $in: planIds } },
      { sales_user: { $in: allowedUserOids } },
    ];
  }

  // Draft isolation: Draft expenses must strictly be visible only to self.
  // When populated to senior authority (team/all scope or reviewing subordinates), expenses MUST be submitted/approved/rejected.
  if (query.status && query.status !== 'all') {
    if (query.status === 'draft') {
      if (!isViewingSelf) {
        return { total: 0, page: 1, limit, pages: 0, data: [] };
      }
      filter.status = 'draft';
    } else {
      filter.status = query.status;
    }
  } else if (!isViewingSelf) {
    // In team/all view: only allow self's own drafts (if any) or non-draft expenses
    if (selfId) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { sales_user: asObjectId(selfId), status: 'draft' },
          { status: { $ne: 'draft' } },
        ],
      });
    } else {
      filter.status = { $ne: 'draft' };
    }
  }

  const fromDate = query.from_date || query.from || query.start_date;
  const toDate = query.to_date || query.to || query.end_date;
  if (fromDate || toDate) {
    filter.expense_date = {};
    if (fromDate) filter.expense_date.$gte = startOfDay(fromDate);
    if (toDate) filter.expense_date.$lte = endOfDay(toDate);
  }

  const searchParam = query.q || query.search;
  if (searchParam && String(searchParam).trim()) {
    const rgx = new RegExp(String(searchParam).trim(), 'i');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { description: rgx },
        { vendor_name: rgx },
        { bill_number: rgx },
        { category: rgx },
        { sub_category: rgx },
      ],
    });
  }

  const { withFreshExpenseAttachmentUrls } = require('../../services/fileManagement');
  const [total, rows] = await Promise.all([
    WorkPlanExpense.countDocuments(filter),
    WorkPlanExpense.find(filter)
      .populate('sales_user', 'name email department')
      .populate({
        path: 'work_plan',
        select: 'plan_date sales_user location status',
        populate: { path: 'sales_user', select: 'name email department' },
      })
      .populate({
        path: 'work_plan_visit',
        select: 'sequence party_type party party_name contact_person',
        populate: { path: 'party', select: 'party_name' },
      })
      .populate('receipt_attachment')
      .populate('attachments')
      .populate('start_reading_image')
      .populate('end_reading_image')
      .populate('approved_by', 'name email')
      .populate('created_by', 'name email')
      .sort({ expense_date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const data = await Promise.all(
    rows.map(async (row) => {
      const item = await withFreshExpenseAttachmentUrls(toPlain(row));
      const sUserObj =
        item.sales_user && typeof item.sales_user === 'object' && item.sales_user.name
          ? item.sales_user
          : null;
      const wpUserObj =
        item.work_plan && typeof item.work_plan === 'object' && item.work_plan.sales_user && item.work_plan.sales_user.name
          ? item.work_plan.sales_user
          : null;
      const createdByObj =
        item.created_by && typeof item.created_by === 'object' && item.created_by.name
          ? item.created_by
          : null;

      item.sales_user = sUserObj || wpUserObj || createdByObj || item.sales_user;
      return item;
    }),
  );

  return {
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 0,
    data,
  };
}

async function listExpenses(planId, user) {
  const plan = await loadPlanOrThrow(planId);
  await assertCanView(plan, user);
  const expenses = await loadExpenses(planId);
  const totals = buildExpenseTotals(expenses);
  return { expenses, ...totals };
}

function assertSalesExpenseReceipt(expense, user) {
  const hasAttachment =
    Boolean(expense.receipt_attachment) ||
    (Array.isArray(expense.attachments) && expense.attachments.length > 0);
  if (isExpenseReceiptRequired(expense.amount) && !hasAttachment) {
    throw new ApiError(400, 'Attachments/receipt is required for expenses exceeding ₹200');
  }
}

async function addExpense(planId, body, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  if (!isWpElevated(user) && !isExpenseAddWindowOpen(plan.plan_date)) {
    throw new ApiError(
      400,
      'Expenses can only be added from the work plan day through the next 2 days (3 days total). Earlier or later entries are not allowed.',
    );
  }

  const visitId = await resolveExpenseVisit(planId, body.work_plan_visit || null);

  const expense = new WorkPlanExpense({
    work_plan: planId,
    sales_user: plan.sales_user || userId(user),
    work_plan_visit: visitId,
    status: 'draft',
    created_by: userId(user),
    updated_by: userId(user),
  });
  applyExpenseFields(expense, body, { isCreate: true });
  assertPrivateBikeExpense(expense);
  assertSalesExpenseReceipt(expense, user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'created',
    `Expense created (${expense.category}, ${expense.amount})`,
  );
  return getWithVisits(planId);
}

async function updateExpense(planId, expenseId, body, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  await assertCanEditExpense(expense, plan, user);

  if (body.work_plan_visit !== undefined) {
    expense.work_plan_visit = await resolveExpenseVisit(
      planId,
      body.work_plan_visit || null,
    );
  }
  applyExpenseFields(expense, body, { isCreate: false });

  if (expense.status === 'rejected') {
    expense.status = 'draft';
    expense.rejection_reason = undefined;
    expense.approved_by = undefined;
    expense.approved_at = undefined;
  }

  assertPrivateBikeExpense(expense);
  assertSalesExpenseReceipt(expense, user);
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'updated',
    `Expense updated (${expense.category}, ${expense.amount})`,
  );
  return getWithVisits(planId);
}

async function removeExpense(planId, expenseId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  await assertCanManageExpense(plan, user);

  if (!isWpElevated(user) && !EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, 'Only draft or rejected expenses can be deleted');
  }
  if (isWpElevated(user) && expense.status === 'approved') {
    throw new ApiError(400, 'Cannot delete an approved expense');
  }

  expense.deletedAt = new Date();
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(user, planId, 'deleted', `Expense deleted (${expense.category}, ${expense.amount})`);
  return getWithVisits(planId);
}

async function submitExpense(planId, expenseId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (!EDITABLE_EXPENSE_STATUSES.includes(expense.status)) {
    throw new ApiError(400, `Cannot submit an expense in status "${expense.status}"`);
  }

  expense.status = 'submitted';
  expense.rejection_reason = undefined;
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'submitted',
    `Expense submitted for approval (${expense.category}, ${expense.amount})`,
  );
  notifyExpenseSubmitted({
    planId,
    count: 1,
    totalAmount: expense.amount,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying expense submitted:', err);
  });
  return getWithVisits(planId);
}

async function approveExpense(planId, expenseId, user) {
  if (!isWpAdmin(user) && !isWpManager(user)) {
    throw new ApiError(403, 'Only managers and administrators can approve expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted expenses can be approved');
  }

  const effectiveSalesUserId = String(expense.sales_user || plan.sales_user || '');
  if (!isWpAdmin(user) && effectiveSalesUserId && String(userId(user)) === effectiveSalesUserId) {
    throw new ApiError(403, 'Segregation of Duties: You cannot approve your own expense claim');
  }

  expense.status = 'approved';
  expense.approved_by = userId(user);
  expense.approved_at = new Date();
  expense.rejection_reason = undefined;
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'approved',
    `Expense approved (${expense.category}, ${expense.amount})`,
  );
  notifyExpenseApproved({
    planId,
    count: 1,
    totalAmount: expense.amount,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying expense approved:', err);
  });

  return getWithVisits(planId);
}

async function rejectExpense(planId, expenseId, body, user) {
  if (!isWpAdmin(user) && !isWpManager(user)) {
    throw new ApiError(403, 'Only managers and administrators can reject expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense not found');
  if (expense.status !== 'submitted') {
    throw new ApiError(400, 'Only submitted expenses can be rejected');
  }

  const effectiveSalesUserId = String(expense.sales_user || plan.sales_user || '');
  if (!isWpAdmin(user) && effectiveSalesUserId && String(userId(user)) === effectiveSalesUserId) {
    throw new ApiError(403, 'Segregation of Duties: You cannot reject your own expense claim');
  }

  expense.status = 'rejected';
  expense.rejection_reason = body.rejection_reason.trim();
  expense.approved_by = userId(user);
  expense.approved_at = new Date();
  expense.updated_by = userId(user);
  await expense.save();

  await logActivity(
    user,
    planId,
    'rejected',
    `Expense rejected: ${expense.rejection_reason}`,
  );
  notifyExpenseRejected({
    planId,
    count: 1,
    totalAmount: expense.amount,
    reason: expense.rejection_reason,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying expense rejected:', err);
  });

  return getWithVisits(planId);
}

async function submitAllExpenses(planId, user) {
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanManageExpense(plan, user);

  const pendingExpenses = await WorkPlanExpense.find({
    work_plan: planId,
    deletedAt: null,
    status: { $in: [...EDITABLE_EXPENSE_STATUSES] },
  }).select('amount').lean();

  const totalAmount = pendingExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: { $in: [...EDITABLE_EXPENSE_STATUSES] },
    },
    {
      $set: {
        status: 'submitted',
        updated_by: userId(user),
      },
      $unset: { rejection_reason: 1 },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No draft or rejected expenses to submit');
  }

  await logActivity(
    user,
    planId,
    'submitted',
    `All day expenses submitted for approval (${count})`,
  );
  notifyExpenseSubmitted({
    planId,
    count,
    totalAmount,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying all expenses submitted:', err);
  });
  return getWithVisits(planId);
}

async function approveAllExpenses(planId, user) {
  if (!isWpAdmin(user) && !isWpManager(user)) {
    throw new ApiError(403, 'Only managers and administrators can approve expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const effectiveSalesUserId = String(plan.sales_user || '');
  if (!isWpAdmin(user) && effectiveSalesUserId && String(userId(user)) === effectiveSalesUserId) {
    throw new ApiError(403, 'Segregation of Duties: You cannot approve your own expense claim');
  }

  const submittedExpenses = await WorkPlanExpense.find({
    work_plan: planId,
    deletedAt: null,
    status: 'submitted',
  }).select('amount').lean();

  const totalAmount = submittedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const now = new Date();
  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: 'submitted',
    },
    {
      $set: {
        status: 'approved',
        approved_by: userId(user),
        approved_at: now,
        updated_by: userId(user),
      },
      $unset: { rejection_reason: 1 },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No submitted expenses to approve');
  }

  await logActivity(
    user,
    planId,
    'approved',
    `All day expenses approved (${count})`,
  );
  notifyExpenseApproved({
    planId,
    count,
    totalAmount,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying all expenses approved:', err);
  });

  return getWithVisits(planId);
}

async function rejectAllExpenses(planId, body, user) {
  if (!isWpAdmin(user) && !isWpManager(user)) {
    throw new ApiError(403, 'Only managers and administrators can reject expenses');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const effectiveSalesUserId = String(plan.sales_user || '');
  if (!isWpAdmin(user) && effectiveSalesUserId && String(userId(user)) === effectiveSalesUserId) {
    throw new ApiError(403, 'Segregation of Duties: You cannot reject your own expense claim');
  }

  const reason = body.rejection_reason.trim();
  const submittedExpenses = await WorkPlanExpense.find({
    work_plan: planId,
    deletedAt: null,
    status: 'submitted',
  }).select('amount').lean();

  const totalAmount = submittedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const result = await WorkPlanExpense.updateMany(
    {
      work_plan: planId,
      deletedAt: null,
      status: 'submitted',
    },
    {
      $set: {
        status: 'rejected',
        rejection_reason: reason,
        approved_by: userId(user),
        approved_at: new Date(),
        updated_by: userId(user),
      },
    },
  );

  const count = result.modifiedCount || result.nModified || 0;
  if (count < 1) {
    throw new ApiError(400, 'No submitted expenses to reject');
  }

  await logActivity(
    user,
    planId,
    'rejected',
    `All day expenses rejected (${count}): ${reason}`,
  );
  notifyExpenseRejected({
    planId,
    count,
    totalAmount,
    reason,
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying all expenses rejected:', err);
  });

  return getWithVisits(planId);
}

async function loadWorks(planId) {
  const { WorkPlanWork } = getModels();
  const parsed = parseStandaloneId(planId);
  let filter;
  if (parsed) {
    const planDate = parsed.dateStr && parsed.dateStr !== 'nodate' ? startOfDay(parsed.dateStr) : null;
    filter = {
      sales_user: parsed.salesUserId,
      work_plan: null,
      deletedAt: null,
      ...(planDate ? { plan_date: { $gte: startOfDay(planDate), $lte: endOfDay(planDate) } } : {}),
    };
  } else if (!mongoose.Types.ObjectId.isValid(planId)) {
    return [];
  } else {
    filter = { work_plan: planId, deletedAt: null };
  }

  const rows = await WorkPlanWork.find(filter)
    .populate('created_by', 'name email')
    .populate('updated_by', 'name email')
    .sort({ sequence: 1 })
    .lean();
  return rows.map(toPlain);
}

async function renumberWorks(planId) {
  if (parseStandaloneId(planId) || !mongoose.Types.ObjectId.isValid(planId)) return;
  const { WorkPlanWork } = getModels();
  const works = await WorkPlanWork.find({ work_plan: planId, deletedAt: null })
    .sort({ sequence: 1 })
    .lean();
  for (let i = 0; i < works.length; i += 1) {
    await WorkPlanWork.updateOne(
      { _id: works[i]._id },
      { $set: { sequence: i + 1 } }
    );
  }
}

async function addStandaloneWork(body, user) {
  const { WorkPlan, WorkPlanWork } = getModels();

  let salesUserId = userId(user);
  if (body.sales_user || body.salesUserId) {
    const requestedUser = String(body.sales_user || body.salesUserId);
    if (requestedUser !== String(userId(user))) {
      if (!isWpElevated(user)) {
        throw new ApiError(403, 'Only managers or admins can plan tasks for other users');
      }
      if (!(await canAccessSalesUser(user, requestedUser))) {
        throw new ApiError(403, 'You can only plan tasks for yourself or your team members');
      }
      salesUserId = requestedUser;
    }
  }

  const rawDate = body.plan_date || body.planDate || new Date();
  const planDate = startOfDay(rawDate);
  const userRole = getUserRole(user);

  // Check if a work plan already exists for this sales user on that date
  const existingPlan = await WorkPlan.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    deletedAt: null,
  });

  if (existingPlan) {
    const maxSeq = await WorkPlanWork.findOne({
      work_plan: existingPlan._id,
      deletedAt: null,
    })
      .sort({ sequence: -1 })
      .select('sequence')
      .lean();

    const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

    const work = await WorkPlanWork.create({
      work_plan: existingPlan._id,
      sales_user: salesUserId,
      plan_date: planDate,
      sequence,
      title: (body.title || 'Task').trim(),
      description: body.description?.trim() || undefined,
      planned_start_time: toValidDate(body.planned_start_time, planDate),
      planned_end_time: toValidDate(body.planned_end_time, planDate),
      status: body.status || 'created',
      pending_remarks: body.pending_remarks?.trim() || undefined,
      in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
      created_by: userId(user),
      created_by_role: userRole,
      updated_by: userId(user),
      updated_by_role: userRole,
    });

    if (existingPlan.status === 'rejected') {
      existingPlan.status = 'draft';
      existingPlan.rejection_reason = undefined;
      existingPlan.submitted_at = undefined;
      existingPlan.updated_by = userId(user);
      await existingPlan.save();
    }

    await renumberWorks(existingPlan._id);
    await logActivity(user, existingPlan._id, 'created', `Task added to work plan for ${planDate.toISOString().slice(0, 10)}`);

    return toPlain(work);
  }

  const maxSeq = await WorkPlanWork.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(rawDate) },
    work_plan: null,
    deletedAt: null,
  })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();

  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;

  const work = await WorkPlanWork.create({
    work_plan: null,
    sales_user: salesUserId,
    plan_date: planDate,
    sequence,
    title: (body.title || 'Task').trim(),
    description: body.description?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, planDate),
    planned_end_time: toValidDate(body.planned_end_time, planDate),
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  await logActivity(user, salesUserId, 'created', `Standalone task created for ${planDate.toISOString().slice(0, 10)}`);

  return toPlain(work);
}

async function updateStandaloneWork(workId, body, user) {
  const { WorkPlanWork } = getModels();
  const work = await WorkPlanWork.findOne({ _id: workId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  if (!admin && work.sales_user && String(work.sales_user) !== String(userId(user))) {
    if (!(await canAccessSalesUser(user, work.sales_user))) {
      throw new ApiError(403, 'You do not have permission to edit this task');
    }
  }

  const baseDate = work.plan_date || new Date();
  if (body.title !== undefined) work.title = body.title.trim();
  if (body.description !== undefined) work.description = body.description?.trim() || undefined;
  if (body.planned_start_time !== undefined) {
    work.planned_start_time = toValidDate(body.planned_start_time, baseDate);
  }
  if (body.planned_end_time !== undefined) {
    work.planned_end_time = toValidDate(body.planned_end_time, baseDate);
  }
  if (body.status !== undefined) {
    work.status = body.status;
  }
  if (body.completion_remarks !== undefined) {
    work.completion_remarks = body.completion_remarks?.trim() || undefined;
  } else if (body.outcome !== undefined) {
    work.completion_remarks = body.outcome?.trim() || undefined;
  }
  if (body.pending_remarks !== undefined) {
    work.pending_remarks = body.pending_remarks?.trim() || undefined;
  }
  if (body.in_progress_remarks !== undefined) {
    work.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  }
  if (body.sequence !== undefined) work.sequence = Number(body.sequence);

  const rescheduleDateStr = body.rescheduled_date || body.rescheduledDate;
  if (rescheduleDateStr !== undefined) {
    work.rescheduled_date = rescheduleDateStr ? toValidDate(rescheduleDateStr, rescheduleDateStr) : undefined;
  }

  const appliedRemark = applyAuthorityRemarks(work, body, user);

  work.updated_by = userId(user);
  work.updated_by_role = getUserRole(user);

  await work.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId: work.work_plan, workId: work._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  if (body.status === 'rescheduled' && rescheduleDateStr && body.auto_schedule !== false) {
    try {
      await addStandaloneWork({
        sales_user: work.sales_user,
        plan_date: rescheduleDateStr,
        title: work.title,
        description: work.description,
        manager_remarks: body.manager_remarks || work.manager_remarks,
        status: 'created',
      }, user);
    } catch (err) {
      console.error('Failed to auto-schedule standalone work to target date:', err);
    }
  }

  return toPlain(work);
}

async function removeStandaloneWork(workId, user) {
  const { WorkPlanWork } = getModels();
  const work = await WorkPlanWork.findOne({ _id: workId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  const elevated = isWpElevated(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(work.created_by_role || '').trim()
  );
  if (!admin && !elevated && isManagerCreated) {
    throw new ApiError(403, 'Tasks created by a Manager cannot be removed by an Executive');
  }

  work.deletedAt = new Date();
  await work.save();
  return { success: true };
}

async function addWork(planId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    const parsed = parseStandaloneId(planId);
    const salesUserId = parsed?.salesUserId || body.sales_user || userId(user);
    const planDate = parsed?.dateStr && parsed.dateStr !== 'nodate' ? parsed.dateStr : body.plan_date;
    return addStandaloneWork({ ...body, sales_user: salesUserId, plan_date: planDate }, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const maxSeq = await WorkPlanWork.findOne({ work_plan: planId, deletedAt: null })
    .sort({ sequence: -1 })
    .select('sequence')
    .lean();
  const sequence = body.sequence ? Number(body.sequence) : (maxSeq?.sequence || 0) + 1;
  const userRole = getUserRole(user);

  const existingWorkId = body._id || body.work_id || body.id;
  if (existingWorkId) {
    const existingWork = await WorkPlanWork.findOne({ _id: existingWorkId, deletedAt: null });
    if (existingWork) {
      existingWork.work_plan = planId;
      existingWork.sales_user = plan.sales_user;
      existingWork.plan_date = plan.plan_date;
      existingWork.sequence = sequence;
      if (body.planned_start_time !== undefined) {
        existingWork.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
      }
      if (body.planned_end_time !== undefined) {
        existingWork.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
      }
      existingWork.updated_by = userId(user);
      existingWork.updated_by_role = userRole;
      await existingWork.save();

      if (plan.status === 'rejected') {
        plan.status = 'draft';
        plan.rejection_reason = undefined;
        plan.submitted_at = undefined;
        plan.updated_by = userId(user);
        await plan.save();
      }

      await renumberWorks(planId);
      await logActivity(user, planId, 'updated', `Work task reassigned (sequence ${sequence})`);
      return getWithVisits(planId);
    }
  }

  const createdWork = await WorkPlanWork.create({
    work_plan: planId,
    sales_user: plan.sales_user,
    plan_date: plan.plan_date,
    sequence,
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    planned_start_time: toValidDate(body.planned_start_time, plan.plan_date),
    planned_end_time: toValidDate(body.planned_end_time, plan.plan_date),
    status: body.status || 'created',
    pending_remarks: body.pending_remarks?.trim() || undefined,
    in_progress_remarks: body.in_progress_remarks?.trim() || undefined,
    created_by: userId(user),
    created_by_role: userRole,
    updated_by: userId(user),
    updated_by_role: userRole,
  });

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task added (sequence ${sequence})`);

  return getWithVisits(planId);
}

async function updateWork(planId, workId, body, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return updateStandaloneWork(workId, body, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorkPlanWork.findOne({ _id: workId, work_plan: planId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  if (body.title !== undefined) work.title = body.title.trim();
  if (body.description !== undefined) work.description = body.description?.trim() || undefined;
  if (body.planned_start_time !== undefined) {
    work.planned_start_time = toValidDate(body.planned_start_time, plan.plan_date);
  }
  if (body.planned_end_time !== undefined) {
    work.planned_end_time = toValidDate(body.planned_end_time, plan.plan_date);
  }
  if (body.status !== undefined) {
    work.status = body.status;
  }
  if (body.completion_remarks !== undefined) {
    work.completion_remarks = body.completion_remarks?.trim() || undefined;
  } else if (body.outcome !== undefined) {
    work.completion_remarks = body.outcome?.trim() || undefined;
  }
  if (body.pending_remarks !== undefined) {
    work.pending_remarks = body.pending_remarks?.trim() || undefined;
  }
  if (body.in_progress_remarks !== undefined) {
    work.in_progress_remarks = body.in_progress_remarks?.trim() || undefined;
  }
  if (body.sequence !== undefined) work.sequence = Number(body.sequence);

  const rescheduleDateStr = body.rescheduled_date || body.rescheduledDate;
  if (rescheduleDateStr !== undefined) {
    work.rescheduled_date = rescheduleDateStr ? toValidDate(rescheduleDateStr, rescheduleDateStr) : undefined;
  }

  const appliedRemark = applyAuthorityRemarks(work, body, user);

  work.updated_by = userId(user);
  work.updated_by_role = getUserRole(user);

  await work.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({ planId: work.work_plan, workId: work._id, remarkText: appliedRemark, actorUser: user }).catch((err) => {
      console.error('[WorkPlanner] Error notifying authority remark added:', err);
    });
  }

  if (body.status === 'rescheduled' && rescheduleDateStr && body.auto_schedule !== false) {
    try {
      await addStandaloneWork({
        sales_user: work.sales_user || plan.sales_user,
        plan_date: rescheduleDateStr,
        title: work.title,
        description: work.description,
        manager_remarks: body.manager_remarks || work.manager_remarks,
        status: 'created',
      }, user);
    } catch (err) {
      console.error('Failed to auto-schedule work to target date:', err);
    }
  }

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task updated (sequence ${work.sequence})`);
  await maybeCompleteWorkPlan(planId, user);
  return getWithVisits(planId);
}

async function removeWork(planId, workId, user) {
  if (String(planId).startsWith('standalone_') || planId === 'standalone') {
    return removeStandaloneWork(workId, user);
  }

  const { WorkPlan, WorkPlanWork } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');
  await assertCanEditVisits(plan, user);

  const work = await WorkPlanWork.findOne({ _id: workId, work_plan: planId, deletedAt: null });
  if (!work) throw new ApiError(404, 'Work task not found');

  const admin = isAdminDept(user);
  const elevated = isWpElevated(user);
  const isManagerCreated = ['Manager', 'Admin', 'Super Admin', 'manager', 'admin', 'super_admin'].includes(
    String(work.created_by_role || '').trim()
  );
  if (!admin && !elevated && isManagerCreated) {
    throw new ApiError(403, 'Tasks created by a Manager cannot be removed by an Executive');
  }

  work.deletedAt = new Date();
  await work.save();

  // Restore linked Scratchpad notes back to active pending status
  try {
    const { UserNote } = getModels();
    if (UserNote) {
      await UserNote.updateMany(
        {
          $or: [
            { work_plan_item_id: work._id || workId },
            { work_plan: planId, type: { $in: ['task', 'general'] }, title: work.title },
          ],
          is_converted_to_work_plan: true,
        },
        {
          $set: {
            is_converted_to_work_plan: false,
            work_plan: null,
            work_plan_item_id: null,
            work_plan_date: null,
            converted_at: null,
          },
        }
      );
    }
  } catch (err) {
    logger.warn(`[workPlanner.service] Failed to restore notes for removed work ${workId}:`, err);
  }

  if (plan.status === 'rejected') {
    plan.status = 'draft';
    plan.rejection_reason = undefined;
    plan.submitted_at = undefined;
    plan.updated_by = userId(user);
    await plan.save();
  }

  await renumberWorks(planId);
  await logActivity(user, planId, 'updated', `Work task removed (ID: ${workId})`);
  return getWithVisits(planId);
}

async function getUserSettings(targetUserId, currentUser) {
  const { UserWorkPlannerSettings } = getModels();
  const uid = asObjectId(targetUserId);
  if (!uid) {
    throw new ApiError(400, 'Invalid user ID');
  }
  const isSelf = String(targetUserId) === String(userId(currentUser));
  if (!isSelf && !(await canAccessSalesUser(currentUser, targetUserId))) {
    throw new ApiError(403, 'You do not have access to this user\'s settings');
  }

  let settings = await UserWorkPlannerSettings.findOne({ user: uid })
    .populate('assigned_manager', 'name email department')
    .populate('plan_type_settings.assigned_manager', 'name email department')
    .lean();

  if (!settings) {
    return {
      userId: String(targetUserId),
      assignedManagerId: '',
      assignedManagerName: '',
      assignedManagerEmail: '',
      ccEmails: [],
      planTypeSettings: {},
      customWorkTemplates: [],
    };
  }

  const managerObj = settings.assigned_manager || {};
  const planTypeSettingsObj = {};
  if (Array.isArray(settings.plan_type_settings)) {
    settings.plan_type_settings.forEach((pts) => {
      if (pts && pts.plan_type) {
        const mgr = pts.assigned_manager || {};
        planTypeSettingsObj[pts.plan_type] = {
          plan_type: pts.plan_type,
          assignedManagerId: mgr._id ? String(mgr._id) : (pts.assigned_manager ? String(pts.assigned_manager) : ''),
          assignedManagerName: mgr.name || '',
          assignedManagerEmail: mgr.email || '',
          ccEmails: Array.isArray(pts.cc_emails) ? pts.cc_emails : [],
        };
      }
    });
  }

  return {
    userId: String(settings.user),
    assignedManagerId: managerObj._id ? String(managerObj._id) : (settings.assigned_manager ? String(settings.assigned_manager) : ''),
    assignedManagerName: managerObj.name || '',
    assignedManagerEmail: managerObj.email || '',
    ccEmails: settings.cc_emails || [],
    planTypeSettings: planTypeSettingsObj,
    customWorkTemplates: (settings.custom_work_templates || []).map((t) => ({
      id: String(t._id || t.id),
      title: t.title,
      description: t.description || '',
      planned_start_time: t.planned_start_time || '',
      planned_end_time: t.planned_end_time || '',
      work_type: t.work_type || 'default',
    })),
    updatedAt: settings.updatedAt,
  };
}

async function updateUserSettings(targetUserId, payload, currentUser) {
  const { UserWorkPlannerSettings } = getModels();
  const uid = asObjectId(targetUserId);
  if (!uid) {
    throw new ApiError(400, 'Invalid user ID');
  }
  if (!isWpElevated(currentUser)) {
    throw new ApiError(403, 'Only managers or admins can update user settings');
  }
  if (!(await canAccessSalesUser(currentUser, targetUserId))) {
    throw new ApiError(403, 'You can only update settings for your team members');
  }

  const updateFields = {
    user: uid,
    updated_by: userId(currentUser),
  };

  if (payload.assignedManagerId !== undefined) {
    updateFields.assigned_manager = payload.assignedManagerId ? asObjectId(payload.assignedManagerId) : null;
  }
  if (Array.isArray(payload.ccEmails)) {
    updateFields.cc_emails = payload.ccEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  }
  if (payload.planTypeSettings && typeof payload.planTypeSettings === 'object') {
    const ptsList = [];
    Object.entries(payload.planTypeSettings).forEach(([planType, pts]) => {
      if (pts && typeof pts === 'object') {
        ptsList.push({
          plan_type: planType,
          assigned_manager: pts.assignedManagerId ? asObjectId(pts.assignedManagerId) : null,
          cc_emails: Array.isArray(pts.ccEmails) ? pts.ccEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean) : [],
        });
      }
    });
    updateFields.plan_type_settings = ptsList;
  }

  if (Array.isArray(payload.customWorkTemplates)) {
    updateFields.custom_work_templates = payload.customWorkTemplates.map((t) => ({
      title: String(t.title || '').trim(),
      description: String(t.description || '').trim(),
      planned_start_time: String(t.planned_start_time || '').trim(),
      planned_end_time: String(t.planned_end_time || '').trim(),
      work_type: t.work_type === 'optional' ? 'optional' : 'default',
    }));
  }

  await UserWorkPlannerSettings.findOneAndUpdate(
    { user: uid },
    { $set: updateFields, $setOnInsert: { created_by: userId(currentUser) } },
    { new: true, upsert: true }
  );

  await logActivity(currentUser, targetUserId, 'updated_user_settings', `Updated Work Planner settings for user ${targetUserId}`);

  return getUserSettings(targetUserId, currentUser);
}

async function getEligibleManagers(user) {
  const { User } = getModels();
  const allActiveUsers = await User.find({ is_active: { $ne: false } })
    .select('_id name email department roles role_codes portals')
    .lean();

  return allActiveUsers
    .filter((u) => {
      if (!u.email) return false;
      if (
        u.department === 'super_admin' ||
        (Array.isArray(u.role_codes) && u.role_codes.includes('super_admin')) ||
        (Array.isArray(u.roles) && u.roles.includes('super_admin'))
      ) {
        return true;
      }
      if (['admin', 'manager', 'coordinator', 'super_admin'].includes(String(u.wp_role || '').toLowerCase().trim())) {
        return true;
      }
      if (Array.isArray(u.portals)) {
        const wpPortal = u.portals.find(
          (p) =>
            p &&
            ['work_planner'].includes(
              String(p.portal_code || p.code || p.portal || '').toLowerCase()
            )
        );
        if (wpPortal) {
          const roles = (Array.isArray(wpPortal.access_roles)
            ? wpPortal.access_roles
            : wpPortal.access_role
            ? [wpPortal.access_role]
            : []
          ).map((r) => String(r).toLowerCase().trim());
          return roles.some((r) =>
            ['coordinator', 'manager', 'admin', 'super_admin'].includes(r)
          );
        }
      }
      return false;
    })
    .map((u) => {
      let wpRole = 'Executive';
      if (
        u.department === 'super_admin' ||
        (Array.isArray(u.role_codes) && u.role_codes.includes('super_admin')) ||
        (Array.isArray(u.roles) && u.roles.includes('super_admin'))
      ) {
        wpRole = 'Admin';
      } else if (u.wp_role === 'admin' || u.wp_role === 'super_admin') {
        wpRole = 'Admin';
      } else if (u.wp_role === 'manager') {
        wpRole = 'Manager';
      } else if (u.wp_role === 'coordinator') {
        wpRole = 'Coordinator';
      } else if (Array.isArray(u.portals)) {
        const wpPortal = u.portals.find(
          (p) =>
            p &&
            ['work_planner'].includes(
              String(p.portal_code || p.code || p.portal || '').toLowerCase()
            )
        );
        if (wpPortal) {
          const roles = (Array.isArray(wpPortal.access_roles)
            ? wpPortal.access_roles
            : wpPortal.access_role
            ? [wpPortal.access_role]
            : []
          ).map((r) => String(r).toLowerCase().trim());
          if (roles.includes('admin') || roles.includes('super_admin')) {
            wpRole = 'Admin';
          } else if (roles.includes('manager')) {
            wpRole = 'Manager';
          } else if (roles.includes('coordinator')) {
            wpRole = 'Coordinator';
          }
        }
      }
      return {
        _id: String(u._id),
        id: String(u._id),
        name: u.name || u.email.split('@')[0],
        email: u.email,
        department:
          typeof u.department === 'object'
            ? u.department?.name || ''
            : u.department || '',
        portals: u.portals || [],
        wp_role: wpRole.toLowerCase(),
        roleBadge: wpRole === 'Admin' ? 'Portal Admin' : wpRole === 'Coordinator' ? 'Portal Coordinator' : 'Portal Manager',
      };
    });
}

async function addWorkPlanAuthorityRemark(id, body, user) {
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only higher authorities can add authority remarks');
  }
  return update(id, body, user);
}

async function addVisitAuthorityRemark(planId, visitId, body, user) {
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only higher authorities can add authority remarks');
  }
  return updateVisit(planId, visitId, body, user);
}

async function addWorkAuthorityRemark(planId, workId, body, user) {
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only higher authorities can add authority remarks');
  }
  return updateWork(planId, workId, body, user);
}

async function addExpenseAuthorityRemark(planId, expenseId, body, user) {
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only higher authorities can add authority remarks');
  }
  const { WorkPlan, WorkPlanExpense } = getModels();
  const plan = await WorkPlan.findOne({ _id: planId, deletedAt: null });
  if (!plan) throw new ApiError(404, 'Work plan not found');

  const expense = await WorkPlanExpense.findOne({
    _id: expenseId,
    work_plan: planId,
    deletedAt: null,
  });
  if (!expense) throw new ApiError(404, 'Expense claim not found');

  const appliedRemark = applyAuthorityRemarks(expense, body, user);
  expense.updated_by = userId(user);
  await expense.save();

  if (appliedRemark) {
    notifyAuthorityRemarkAdded({
      planId: plan._id,
      expenseId: expense._id,
      remarkText: appliedRemark,
      actorUser: user,
    }).catch((err) => {
      console.warn('[workPlannerAutoNotification] Error in notifyAuthorityRemarkAdded (expense):', err.message);
    });
  }

  await logActivity(
    user,
    planId,
    'updated',
    `Senior remark added to expense (${expense.category}, ₹${expense.amount || 0})`
  );

  return getWithVisits(planId);
}

async function getWorkPlanDraft(query, user) {
  const { WorkPlanDraft } = getModels();
  let salesUserId = userId(user);
  if (query.sales_user && String(query.sales_user) !== String(userId(user))) {
    if (isWpElevated(user)) {
      salesUserId = query.sales_user;
    }
  }
  if (!query.plan_date) return null;
  const planDate = startOfDay(query.plan_date);
  const draft = await WorkPlanDraft.findOne({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(query.plan_date) },
  }).lean();
  return draft;
}

async function saveWorkPlanDraft(body, user) {
  const { WorkPlanDraft } = getModels();
  let salesUserId = userId(user);
  if (body.sales_user && String(body.sales_user) !== String(userId(user))) {
    if (isWpElevated(user)) {
      salesUserId = body.sales_user;
    }
  }
  if (!body.plan_date) {
    throw new ApiError(400, 'plan_date is required to save a draft');
  }
  const planDate = startOfDay(body.plan_date);

  const updateDoc = {
    sales_user: salesUserId,
    plan_date: planDate,
    plan_type: body.plan_type || undefined,
    remarks: body.remarks !== undefined ? body.remarks : undefined,
    location: body.location !== undefined ? body.location : undefined,
    country_id: (body.country_id && mongoose.Types.ObjectId.isValid(body.country_id)) ? body.country_id : (body.country_id === null ? null : undefined),
    state_id: (body.state_id && mongoose.Types.ObjectId.isValid(body.state_id)) ? body.state_id : (body.state_id === null ? null : undefined),
    city_id: (body.city_id && mongoose.Types.ObjectId.isValid(body.city_id)) ? body.city_id : (body.city_id === null ? null : undefined),
    country: body.country !== undefined ? body.country : undefined,
    state: body.state !== undefined ? body.state : undefined,
    city: body.city !== undefined ? body.city : undefined,
    is_discussed_with_manager: body.is_discussed_with_manager !== undefined ? body.is_discussed_with_manager : null,
    discussed_manager_id: body.discussed_manager_id || undefined,
    discussed_manager_name: body.discussed_manager_name || undefined,
    discussion_method: body.discussion_method || undefined,
    visits: Array.isArray(body.visits) ? body.visits : [],
    works: Array.isArray(body.works) ? body.works : [],
    last_saved_at: new Date(),
  };

  const draft = await WorkPlanDraft.findOneAndUpdate(
    { sales_user: salesUserId, plan_date: { $gte: planDate, $lte: endOfDay(body.plan_date) } },
    { $set: updateDoc },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return draft;
}

async function deleteWorkPlanDraft(query, user) {
  const { WorkPlanDraft } = getModels();
  let salesUserId = userId(user);
  if (query.sales_user && String(query.sales_user) !== String(userId(user))) {
    if (isWpElevated(user)) {
      salesUserId = query.sales_user;
    }
  }
  if (!query.plan_date) return { success: true };
  const planDate = startOfDay(query.plan_date);
  await WorkPlanDraft.deleteMany({
    sales_user: salesUserId,
    plan_date: { $gte: planDate, $lte: endOfDay(query.plan_date) },
  });
  return { success: true };
}

async function getSeniorRemarksFeed(query = {}, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense, User } = getModels();
  const selfId = String(userId(user) || '');
  const selfOid = asObjectId(selfId);
  const isAdmin = isWpAdmin(user);
  const isManagerOrCoord = isWpManager(user) || isWpCoordinator(user);
  const isElevated = isWpElevated(user);

  const scope = String(query.scope || query.ownership || '').toLowerCase();

  const remarksCondition = {
    $or: [
      { 'authority_remarks.0': { $exists: true } },
      { manager_remarks: { $exists: true, $ne: '', $ne: null } },
    ],
  };

  // Subordinates list for manager / coordinator
  const visibleIds = (await getVisibleSalesUserIds(user)) || [selfId];
  const subordinateIds = visibleIds.filter((id) => id !== selfId);
  const subordinateIdSet = new Set(subordinateIds.map(String));

  // Base sales filter (WITHOUT remarks condition) to find all parent plans for planMap
  let baseSalesFilter = { deletedAt: null };

  if (!isElevated) {
    // 1. Executive: strictly concerned only with their own plans/visits/tasks
    baseSalesFilter.sales_user = selfOid || selfId;
  } else if (isAdmin) {
    // 2. Admin: sees all portal-wide by default, or 'mine' if explicitly chosen
    if (scope === 'mine') {
      baseSalesFilter.sales_user = selfOid || selfId;
    } else if (query.sales_user && query.sales_user !== 'all') {
      const targetOid = asObjectId(query.sales_user) || query.sales_user;
      baseSalesFilter.sales_user = targetOid;
    }
  } else if (isManagerOrCoord) {
    // 3. Coordinator & Manager
    if (scope === 'mine') {
      baseSalesFilter.sales_user = selfOid || selfId;
    } else if (query.sales_user && query.sales_user !== 'all') {
      const requested = String(query.sales_user);
      if (visibleIds.includes(requested)) {
        baseSalesFilter.sales_user = asObjectId(requested) || requested;
      } else {
        baseSalesFilter.sales_user = { $in: [] };
      }
    } else {
      const visibleOids = visibleIds.map(asObjectId).filter(Boolean);
      baseSalesFilter.sales_user = { $in: visibleOids };
    }
  }

  // 1. Fetch all parent plans matching base sales filter to build planMap and get matchingPlanIds
  const matchingPlans = await WorkPlan.find(baseSalesFilter)
    .select('_id sales_user plan_date')
    .populate('sales_user', 'name email department')
    .lean();

  const matchingPlanIds = matchingPlans.map((p) => p._id);
  const planMap = new Map();
  matchingPlans.forEach((p) => {
    planMap.set(String(p._id), p);
  });

  // 2. Plan filter for plans with remarks
  let planFilter = {
    ...baseSalesFilter,
    ...remarksCondition,
  };

  if (isManagerOrCoord && scope !== 'mine' && (!query.sales_user || query.sales_user === 'all')) {
    const visibleOids = visibleIds.map(asObjectId).filter(Boolean);
    planFilter = {
      deletedAt: null,
      ...remarksCondition,
      $or: [
        { sales_user: { $in: visibleOids } },
        { 'authority_remarks.user': selfOid || selfId },
      ],
    };
  }

  // 3. SubItem filter for visits & works
  let subItemFilter = {
    deletedAt: null,
    ...remarksCondition,
  };

  if (!isElevated) {
    const orConditions = [{ sales_user: selfOid || selfId }];
    if (matchingPlanIds.length > 0) {
      orConditions.push({ work_plan: { $in: matchingPlanIds } });
    }
    subItemFilter.$or = orConditions;
  } else if (isAdmin) {
    if (scope === 'mine') {
      const orConditions = [{ sales_user: selfOid || selfId }];
      if (matchingPlanIds.length > 0) orConditions.push({ work_plan: { $in: matchingPlanIds } });
      subItemFilter.$or = orConditions;
    } else if (query.sales_user && query.sales_user !== 'all') {
      const targetOid = asObjectId(query.sales_user) || query.sales_user;
      const orConditions = [{ sales_user: targetOid }];
      if (matchingPlanIds.length > 0) orConditions.push({ work_plan: { $in: matchingPlanIds } });
      subItemFilter.$or = orConditions;
    }
  } else if (isManagerOrCoord) {
    if (scope === 'mine') {
      const orConditions = [{ sales_user: selfOid || selfId }];
      if (matchingPlanIds.length > 0) orConditions.push({ work_plan: { $in: matchingPlanIds } });
      subItemFilter.$or = orConditions;
    } else if (query.sales_user && query.sales_user !== 'all') {
      const requested = String(query.sales_user);
      if (visibleIds.includes(requested)) {
        const targetOid = asObjectId(requested) || requested;
        const orConditions = [{ sales_user: targetOid }];
        if (matchingPlanIds.length > 0) orConditions.push({ work_plan: { $in: matchingPlanIds } });
        subItemFilter.$or = orConditions;
      } else {
        subItemFilter.sales_user = { $in: [] };
      }
    } else {
      const visibleOids = visibleIds.map(asObjectId).filter(Boolean);
      const orConditions = [
        { sales_user: { $in: visibleOids } },
        { 'authority_remarks.user': selfOid || selfId },
      ];
      if (matchingPlanIds.length > 0) {
        orConditions.push({ work_plan: { $in: matchingPlanIds } });
      }
      subItemFilter.$or = orConditions;
    }
  }

  const [plans, visits, works, expenses] = await Promise.all([
    WorkPlan.find(planFilter)
      .populate('sales_user', 'name email department')
      .lean(),
    WorkPlanVisit.find(subItemFilter)
      .populate('sales_user', 'name email department')
      .populate('party', 'party_name mobile email contact_person')
      .lean(),
    WorkPlanWork.find(subItemFilter)
      .populate('sales_user', 'name email department')
      .lean(),
    WorkPlanExpense.find(subItemFilter)
      .populate('sales_user', 'name email department')
      .populate('created_by', 'name email department')
      .lean(),
  ]);

  const items = [];

  // Helper to push remark
  const pushRemarkItem = (doc, r, idx, targetType, title, location, sUser, fallbackDate) => {
    const sUserId = String(sUser._id || sUser.id || sUser || '');
    let sUserName = sUser.name || sUser.email || '';
    if (!sUserName && sUserId && String(sUserId) === String(selfId)) {
      sUserName = user?.name || user?.email || 'Executive';
    } else if (!sUserName) {
      sUserName = 'Executive';
    }

    // Sanitize senior author role
    let seniorRole = r.role || 'Senior Authority';
    if (seniorRole === 'Executive') {
      seniorRole = 'Senior Authority';
    }

    // Sanitize junior follow-up responses
    const followups = Array.isArray(r.followup_remarks)
      ? r.followup_remarks.map((f) => {
          const isFollowupOwner =
            String(f.user || '') === sUserId ||
            String(f.user_name || '').toLowerCase() === sUserName.toLowerCase();
          let fRole = f.role;
          if (isFollowupOwner && (!fRole || fRole === 'Senior Authority')) {
            fRole = 'Executive';
          }

          const rawDetails = Array.isArray(f.attachment_details) && f.attachment_details.length > 0
            ? f.attachment_details.map((d) => {
                const attId = String(d.attachment_id || d._id || d.id || '');
                return {
                  _id: attId,
                  attachment_id: attId,
                  filename: d.filename || d.original_name || 'attachment',
                  original_name: d.original_name || d.filename || 'attachment',
                  mime_type: d.mime_type || 'application/octet-stream',
                  size: d.size || 0,
                  url: d.url || (attId ? `/api/work-planner/attachments/${attId}/preview` : ''),
                };
              })
            : Array.isArray(f.attachments)
            ? f.attachments.map((att) => {
                const attId = typeof att === 'object' ? String(att._id || att.id || '') : String(att);
                return {
                  _id: attId,
                  attachment_id: attId,
                  filename: (typeof att === 'object' && (att.original_name || att.filename)) || 'attachment',
                  original_name: (typeof att === 'object' && (att.original_name || att.filename)) || 'attachment',
                  mime_type: (typeof att === 'object' && (att.mime_type || att.mimetype)) || 'application/octet-stream',
                  size: (typeof att === 'object' && (att.file_size || att.size)) || 0,
                  url: `/api/work-planner/attachments/${attId}/preview`,
                };
              })
            : [];

          return {
            ...f,
            _id: f._id ? String(f._id) : undefined,
            user_name: f.user_name || (isFollowupOwner ? sUserName : 'Executive'),
            role: fRole || 'Executive',
            attachments: rawDetails,
            attachment_details: rawDetails,
          };
        })
      : [];

    items.push({
      id: String(r._id || `${doc._id}_${targetType}_${idx}`),
      remark_id: String(r._id || idx),
      target_type: targetType,
      plan_id: String(doc.work_plan?._id || doc.work_plan || doc._id),
      target_id: String(doc._id),
      plan_date: doc.plan_date || fallbackDate || null,
      title: title || 'Day Plan',
      location: location || '',
      sales_user: {
        _id: sUserId,
        name: sUserName,
        email: sUser.email || '',
      },
      senior_user: {
        _id: String(r.user || ''),
        name: r.user_name || 'Senior Authority',
        role: seniorRole,
      },
      remark: r.remark,
      remark_type: r.remark_type || 'instruction',
      priority: r.priority || 'medium',
      expected_followup_date: r.expected_followup_date || null,
      status: r.status || 'pending_response',
      followup_remarks: followups,
      resolution_remarks: r.resolution_remarks || '',
      resolved_at: r.resolved_at || null,
      resolved_by: r.resolved_by || null,
      resolved_by_name: r.resolved_by_name || '',
      created_at: r.created_at || doc.updatedAt || doc.createdAt || new Date(),
    });
  };

  // 1. Process Plan remarks
  for (const doc of plans) {
    const sUser = doc.sales_user || {};
    const authRemarks = Array.isArray(doc.authority_remarks) ? doc.authority_remarks : [];
    if (authRemarks.length > 0) {
      authRemarks.forEach((r, idx) => {
        pushRemarkItem(
          doc,
          r,
          idx,
          'plan',
          doc.remarks || doc.location || 'Full Day Plan',
          doc.location || '',
          sUser,
          doc.plan_date
        );
      });
    } else if (doc.manager_remarks && doc.manager_remarks.trim()) {
      pushRemarkItem(
        doc,
        {
          _id: 'legacy',
          remark: doc.manager_remarks.trim(),
          user_name: 'Senior Manager',
          role: 'Manager',
          remark_type: 'instruction',
          priority: 'medium',
          status: 'pending_response',
          created_at: doc.updatedAt || doc.createdAt,
        },
        'legacy',
        'plan',
        doc.remarks || doc.location || 'Full Day Plan',
        doc.location || '',
        sUser,
        doc.plan_date
      );
    }
  }

  // 2. Process Visit remarks
  for (const doc of visits) {
    const parentPlan = doc.work_plan ? planMap.get(String(doc.work_plan)) : null;
    const sUser = doc.sales_user || parentPlan?.sales_user || {};
    const partyObj = doc.party || {};
    const pTitle = doc.party_name || partyObj.party_name || 'Field Visit';
    const authRemarks = Array.isArray(doc.authority_remarks) ? doc.authority_remarks : [];
    const fallbackDate = doc.plan_date || parentPlan?.plan_date;

    if (authRemarks.length > 0) {
      authRemarks.forEach((r, idx) => {
        pushRemarkItem(
          doc,
          r,
          idx,
          'visit',
          pTitle,
          doc.address || '',
          sUser,
          fallbackDate
        );
      });
    } else if (doc.manager_remarks && doc.manager_remarks.trim()) {
      pushRemarkItem(
        doc,
        {
          _id: 'legacy',
          remark: doc.manager_remarks.trim(),
          user_name: 'Senior Manager',
          role: 'Manager',
          remark_type: 'instruction',
          priority: 'medium',
          status: 'pending_response',
          created_at: doc.updatedAt || doc.createdAt,
        },
        'legacy',
        'visit',
        pTitle,
        doc.address || '',
        sUser,
        fallbackDate
      );
    }
  }

  // 3. Process Work remarks
  for (const doc of works) {
    const parentPlan = doc.work_plan ? planMap.get(String(doc.work_plan)) : null;
    const sUser = doc.sales_user || parentPlan?.sales_user || {};
    const authRemarks = Array.isArray(doc.authority_remarks) ? doc.authority_remarks : [];
    const fallbackDate = doc.plan_date || parentPlan?.plan_date;

    if (authRemarks.length > 0) {
      authRemarks.forEach((r, idx) => {
        pushRemarkItem(
          doc,
          r,
          idx,
          'task',
          doc.title || 'Work Task',
          doc.description || '',
          sUser,
          fallbackDate
        );
      });
    } else if (doc.manager_remarks && doc.manager_remarks.trim()) {
      pushRemarkItem(
        doc,
        {
          _id: 'legacy',
          remark: doc.manager_remarks.trim(),
          user_name: 'Senior Manager',
          role: 'Manager',
          remark_type: 'instruction',
          priority: 'medium',
          status: 'pending_response',
          created_at: doc.updatedAt || doc.createdAt,
        },
        'legacy',
        'task',
        doc.title || 'Work Task',
        doc.description || '',
        sUser,
        fallbackDate
      );
    }
  }

  // 4. Process Expense remarks
  for (const doc of expenses) {
    const parentPlan = doc.work_plan ? planMap.get(String(doc.work_plan)) : null;
    const sUser = doc.sales_user || parentPlan?.sales_user || {};
    const authRemarks = Array.isArray(doc.authority_remarks) ? doc.authority_remarks : [];
    const fallbackDate = doc.expense_date || parentPlan?.plan_date;
    const categoryName = doc.category || 'Expense';
    const amountStr = doc.amount != null ? `₹${doc.amount}` : '';
    const expTitle = `${categoryName} Claim ${amountStr ? `(${amountStr})` : ''} - ${doc.description || 'Expense'}`;
    const expLocation = doc.vendor_name || doc.sub_category || doc.bill_number || '';

    if (authRemarks.length > 0) {
      authRemarks.forEach((r, idx) => {
        pushRemarkItem(
          doc,
          r,
          idx,
          'expense',
          expTitle,
          expLocation,
          sUser,
          fallbackDate
        );
      });
    } else if (doc.manager_remarks && doc.manager_remarks.trim()) {
      pushRemarkItem(
        doc,
        {
          _id: 'legacy',
          remark: doc.manager_remarks.trim(),
          user_name: 'Senior Manager',
          role: 'Manager',
          remark_type: 'instruction',
          priority: 'medium',
          status: 'pending_response',
          created_at: doc.updatedAt || doc.createdAt,
        },
        'legacy',
        'expense',
        expTitle,
        expLocation,
        sUser,
        fallbackDate
      );
    }
  }

  // 5. Security Gate: Only access directives created for the user, by the user, or for reporting subordinates
  const canAccessItem = (item) => {
    if (isAdmin) return true;

    const targetUserId = String(item.sales_user?._id || '');
    const authorUserId = String(item.senior_user?._id || '');

    // 1. Created for me (I am the target executive/user)
    if (targetUserId && targetUserId === selfId) return true;

    // 2. Created by me (I issued this directive)
    if (authorUserId && authorUserId === selfId) return true;

    // 3. For Manager / Coordinator: Created for one of my reporting junior subordinates
    if (isElevated && targetUserId && subordinateIdSet.has(targetUserId)) {
      return true;
    }

    return false;
  };

  let filtered = items.filter(canAccessItem);

  // Scope filter
  if (scope === 'mine') {
    filtered = filtered.filter((i) => String(i.sales_user?._id || '') === selfId);
  } else if (scope === 'team' && isElevated && !isAdmin) {
    filtered = filtered.filter((i) => {
      const targetUserId = String(i.sales_user?._id || '');
      const authorUserId = String(i.senior_user?._id || '');
      return authorUserId === selfId || (targetUserId !== selfId && subordinateIdSet.has(targetUserId));
    });
  }

  // Additional query filters

  if (query.remark_type && query.remark_type !== 'all') {
    filtered = filtered.filter((i) => i.remark_type === query.remark_type);
  }
  if (query.status && query.status !== 'all') {
    filtered = filtered.filter((i) => i.status === query.status);
  }
  if (query.priority && query.priority !== 'all') {
    filtered = filtered.filter((i) => i.priority === query.priority);
  }
  if (query.target_type && query.target_type !== 'all') {
    filtered = filtered.filter((i) => i.target_type === query.target_type);
  }
  if (query.sales_user && query.sales_user !== 'all') {
    filtered = filtered.filter((i) => String(i.sales_user._id) === String(query.sales_user));
  }
  if (query.date_from) {
    const fDate = new Date(query.date_from).getTime();
    filtered = filtered.filter((i) => {
      const d = i.plan_date ? new Date(i.plan_date).getTime() : new Date(i.created_at).getTime();
      return d >= fDate;
    });
  }
  if (query.date_to) {
    const tDate = new Date(query.date_to).getTime() + 86400000;
    filtered = filtered.filter((i) => {
      const d = i.plan_date ? new Date(i.plan_date).getTime() : new Date(i.created_at).getTime();
      return d <= tDate;
    });
  }
  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.remark.toLowerCase().includes(q) ||
        i.sales_user.name.toLowerCase().includes(q) ||
        i.senior_user.name.toLowerCase().includes(q)
    );
  }

  // Sort descending by created_at
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const stats = {
    total: filtered.length,
    appreciation_count: filtered.filter((i) => i.remark_type === 'appreciation').length,
    objection_count: filtered.filter((i) => i.remark_type === 'objection' && i.status !== 'resolved').length,
    total_objections_count: filtered.filter((i) => i.remark_type === 'objection').length,
    instruction_count: filtered.filter((i) => i.remark_type === 'instruction' && i.status !== 'resolved').length,
    total_instructions_count: filtered.filter((i) => i.remark_type === 'instruction').length,
    pending_response_count: filtered.filter((i) => i.status === 'pending_response').length,
    responded_count: filtered.filter((i) => i.status === 'responded').length,
    resolved_count: filtered.filter((i) => i.status === 'resolved').length,
  };

  return { items: filtered, stats };
}

async function addJuniorFollowup(body, user) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const { target_type, target_id, remark_id, response, action_status, attachments, attachment_details } = body;
  if (!target_type || !target_id || !response || !response.trim()) {
    throw new ApiError(400, 'target_type, target_id, and response are required');
  }

  let doc = null;
  if (target_type === 'plan') {
    doc = await WorkPlan.findById(target_id);
  } else if (target_type === 'visit') {
    doc = await WorkPlanVisit.findById(target_id);
  } else if (target_type === 'task') {
    doc = await WorkPlanWork.findById(target_id);
  } else if (target_type === 'expense') {
    doc = await WorkPlanExpense.findById(target_id);
  } else {
    throw new ApiError(400, `Invalid target_type: ${target_type}`);
  }

  if (!doc) {
    throw new ApiError(404, `${target_type} not found`);
  }

  if (!Array.isArray(doc.authority_remarks) || doc.authority_remarks.length === 0) {
    throw new ApiError(404, 'No authority remarks found on this target');
  }

  let remark = null;
  if (remark_id) {
    remark = doc.authority_remarks.find(
      (r) => String(r._id) === String(remark_id)
    );
  }
  if (!remark) {
    remark = doc.authority_remarks[doc.authority_remarks.length - 1];
  }

  if (!Array.isArray(remark.followup_remarks)) {
    remark.followup_remarks = [];
  }

  // Parse and resolve multiple attachments
  let parsedAttachments = [];
  let parsedDetails = [];

  const rawAttList = Array.isArray(attachments) ? attachments : [];
  const rawIdList = rawAttList
    .map((a) => (typeof a === 'string' ? a : a._id || a.id || a.attachment_id))
    .filter(Boolean);

  if (rawIdList.length > 0) {
    const { Attachment } = getModels();
    if (Attachment) {
      const attDocs = await Attachment.find({ _id: { $in: rawIdList } }).lean();
      parsedAttachments = attDocs.map((a) => a._id);
      parsedDetails = attDocs.map((a) => ({
        attachment_id: a._id,
        filename: a.filename || a.file_name || a.original_name || 'document',
        original_name: a.original_name || a.filename || a.file_name || 'document',
        mime_type: a.mime_type || a.mimetype || a.contentType || 'application/octet-stream',
        size: a.file_size || a.size || 0,
        url: `/api/work-planner/attachments/${a._id}/preview`,
      }));
    }
  }

  if (Array.isArray(attachment_details) && attachment_details.length > 0) {
    attachment_details.forEach((d) => {
      const existing = parsedDetails.find(
        (pd) => String(pd.attachment_id || '') === String(d.attachment_id || d._id || d.id || '')
      );
      if (!existing) {
        const attId = d.attachment_id || d._id || d.id;
        if (attId) parsedAttachments.push(attId);
        parsedDetails.push({
          attachment_id: attId || undefined,
          filename: d.filename || d.original_name || 'document',
          original_name: d.original_name || d.filename || 'document',
          mime_type: d.mime_type || 'application/octet-stream',
          size: d.size || 0,
          url: d.url || (attId ? `/api/work-planner/attachments/${attId}/preview` : ''),
        });
      }
    });
  }

  const uRole = getUserRole(user);
  const respondentRole = uRole === 'Senior Authority' ? 'Executive' : uRole;
  remark.followup_remarks.push({
    response: response.trim(),
    user: userId(user),
    user_name: user?.name || user?.email || 'Executive',
    role: respondentRole,
    action_status: action_status || 'completed',
    attachments: parsedAttachments,
    attachment_details: parsedDetails,
    created_at: new Date(),
  });

  if (remark.status === 'pending_response') {
    remark.status = 'responded';
  }

  await doc.save();

  notifyJuniorFollowupAdded({
    targetType: target_type,
    targetId: target_id,
    remark,
    followup: remark.followup_remarks[remark.followup_remarks.length - 1],
    actorUser: user,
  }).catch((err) => {
    console.error('[WorkPlanner] Error notifying junior followup:', err);
  });

  return { success: true, remark };
}

async function updateSeniorRemarkStatus(body, user) {
  if (!isWpElevated(user)) {
    throw new ApiError(403, 'Only higher authorities can update directive status');
  }
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense } = getModels();
  const { target_type, target_id, remark_id, status, resolution_remarks } = body;
  if (!target_type || !target_id || !status) {
    throw new ApiError(400, 'target_type, target_id, and status are required');
  }

  let doc = null;
  if (target_type === 'plan') {
    doc = await WorkPlan.findById(target_id);
  } else if (target_type === 'visit') {
    doc = await WorkPlanVisit.findById(target_id);
  } else if (target_type === 'task') {
    doc = await WorkPlanWork.findById(target_id);
  } else if (target_type === 'expense') {
    doc = await WorkPlanExpense.findById(target_id);
  } else {
    throw new ApiError(400, `Invalid target_type: ${target_type}`);
  }

  if (!doc) {
    throw new ApiError(404, `${target_type} not found`);
  }

  let remark = null;
  if (remark_id) {
    remark = doc.authority_remarks?.find(
      (r) => String(r._id) === String(remark_id)
    );
  }
  if (!remark && Array.isArray(doc.authority_remarks) && doc.authority_remarks.length > 0) {
    remark = doc.authority_remarks[doc.authority_remarks.length - 1];
  }

  if (!remark) {
    throw new ApiError(404, 'Authority remark not found');
  }

  remark.status = status;
  if (status === 'resolved') {
    remark.resolution_remarks = (resolution_remarks && resolution_remarks.trim()) || undefined;
    remark.resolved_at = new Date();
    remark.resolved_by = userId(user);
    remark.resolved_by_name = user?.name || user?.email || 'Senior Authority';
  } else if (status === 'pending_response') {
    remark.resolved_at = undefined;
    remark.resolved_by = undefined;
    remark.resolved_by_name = undefined;
  }

  await doc.save();

  if (status === 'resolved') {
    notifyDirectiveResolved({
      targetType: target_type,
      targetId: target_id,
      doc,
      remark,
      actorUser: user,
    }).catch((err) => {
      console.error('[WorkPlanner] Error notifying directive resolved:', err);
    });
  }

  return { success: true, remark };
}

module.exports = {
  list,
  get,
  create,
  update,
  remove,
  submit,
  approve,
  reject,
  completePlan,
  loadVisits,
  addVisit,
  updateVisit,
  removeVisit,
  addStandaloneVisit,
  updateStandaloneVisit,
  removeStandaloneVisit,
  checkIn,
  checkOut,
  completeVisit,
  listAllExpenses,
  listExpenses,
  addExpense,
  updateExpense,
  removeExpense,
  submitExpense,
  approveExpense,
  rejectExpense,
  submitAllExpenses,
  approveAllExpenses,
  rejectAllExpenses,
  stats,
  loadWorks,
  addWork,
  updateWork,
  removeWork,
  addStandaloneWork,
  updateStandaloneWork,
  removeStandaloneWork,
  getDayEndDraft,
  getUserSettings,
  updateUserSettings,
  getEligibleManagers,
  addWorkPlanAuthorityRemark,
  addVisitAuthorityRemark,
  addWorkAuthorityRemark,
  addExpenseAuthorityRemark,
  getWorkPlanDraft,
  saveWorkPlanDraft,
  deleteWorkPlanDraft,
  getSeniorRemarksFeed,
  addJuniorFollowup,
  updateSeniorRemarkStatus,
  userId,
};
