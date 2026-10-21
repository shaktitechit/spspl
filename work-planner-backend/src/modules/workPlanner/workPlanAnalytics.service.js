/**
 * @fileoverview 360° Work Plan Analytics & Metric Aggregation Service
 * Harvests complete work plan records, visit logs, task progression, senior remarks, and day-end submissions.
 * @module modules/workPlanner/workPlanAnalytics.service
 */

const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { isWpAdmin, isWpManager, isWpCoordinator } = require('./workPlanner.constants');
const { getVisibleSalesUserIds, canAccessSalesUser } = require('./teamVisibility.service');

function asObjectId(id) {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  try {
    return new mongoose.Types.ObjectId(String(id));
  } catch {
    return null;
  }
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Harvests and calculates raw quantitative and qualitative metrics for an individual
 * across the specified date range (or for a specific work plan).
 */
async function harvestIndividualPlanData(targetUserId, fromDate, toDate, planId = null) {
  const { WorkPlan, WorkPlanVisit, WorkPlanWork, WorkPlanExpense, User } = getModels();

  const userOid = asObjectId(targetUserId);
  if (!userOid) throw new Error('Invalid target user ID');

  const userDoc = await User.findById(userOid).select('name email department portals roles').lean();
  const userName = userDoc?.name || 'Executive';
  const userEmail = userDoc?.email || '';
  const userDept = userDoc?.department || 'Sales';

  // Date filters
  const start = fromDate ? startOfDay(fromDate) : startOfDay(new Date(Date.now() - 30 * 86400000));
  const end = toDate ? endOfDay(toDate) : endOfDay(new Date());

  const planMatch = {
    sales_user: userOid,
    deletedAt: null,
    ...(planId ? { _id: asObjectId(planId) } : { plan_date: { $gte: start, $lte: end } }),
  };

  const plans = await WorkPlan.find(planMatch)
    .populate('discussed_manager_id', 'name email department')
    .sort({ plan_date: 1 })
    .lean();

  const planIds = plans.map((p) => p._id);

  // Fetch visits and works associated with these plans (or standalone on these dates)
  const visitMatch = {
    deletedAt: null,
    $or: [
      { work_plan: { $in: planIds } },
      { sales_user: userOid, plan_date: { $gte: start, $lte: end } },
    ],
  };

  const workMatch = {
    deletedAt: null,
    $or: [
      { work_plan: { $in: planIds } },
      { sales_user: userOid, plan_date: { $gte: start, $lte: end } },
    ],
  };

  const expenseMatch = {
    work_plan: { $in: planIds },
  };

  const [visits, works, expenses] = await Promise.all([
    WorkPlanVisit.find(visitMatch).sort({ plan_date: 1, sequence: 1 }).lean(),
    WorkPlanWork.find(workMatch).sort({ plan_date: 1, sequence: 1 }).lean(),
    WorkPlanExpense.find(expenseMatch).lean(),
  ]);

  // --- 1. Compute Plan Metrics ---
  const totalPlans = plans.length;
  let completedPlans = 0;
  let submittedPlans = 0;
  let approvedPlans = 0;
  let rejectedPlans = 0;
  let plannedPlans = 0;

  let leavePlansCount = 0;
  let wfhCount = 0;
  let wfoCount = 0;
  let visitsOnlyCount = 0;
  let tasksAndVisitsCount = 0;

  let managerDiscussedCount = 0;
  const discussionMethods = { on_call: 0, on_direct_meeting: 0, on_email: 0, other: 0 };

  let dayEndSubmittedCount = 0;
  let dayEndOnTimeCount = 0; // submitted before 21:00 (9 PM)
  const recentDayEndNotes = [];
  const seniorDirectives = [];

  const detailedWorkPlansLog = [];
  const detailedVisitsLog = [];
  const detailedTasksLog = [];

  plans.forEach((p) => {
    if (p.status === 'completed') completedPlans++;
    else if (p.status === 'submitted') submittedPlans++;
    else if (p.status === 'approved') approvedPlans++;
    else if (p.status === 'rejected') rejectedPlans++;
    else plannedPlans++;

    const pType = p.plan_type || 'Visits';
    if (pType === 'Leave') leavePlansCount++;
    else if (pType === 'Work From Home') wfhCount++;
    else if (pType === 'Work From Office') wfoCount++;
    else if (pType === 'Tasks & Visits') tasksAndVisitsCount++;
    else visitsOnlyCount++;

    if (p.is_discussed_with_manager) {
      managerDiscussedCount++;
      if (p.discussion_method && discussionMethods[p.discussion_method] !== undefined) {
        discussionMethods[p.discussion_method]++;
      }
    }

    let cleanDayEndBody = '';
    if (p.day_end && p.day_end.completed_at) {
      dayEndSubmittedCount++;
      const compDate = new Date(p.day_end.completed_at);
      if (compDate.getHours() < 21) {
        dayEndOnTimeCount++;
      }
      cleanDayEndBody = (p.day_end.body_html || '').replace(/<[^>]+>/g, ' ').trim();
      if (p.day_end.subject || cleanDayEndBody) {
        recentDayEndNotes.push({
          date: p.plan_date ? p.plan_date.toISOString().slice(0, 10) : '',
          subject: p.day_end.subject || 'Day End Report',
          body: cleanDayEndBody.slice(0, 500),
        });
      }
    }

    const planAuthorityRemarks = Array.isArray(p.authority_remarks)
      ? p.authority_remarks.map((ar) => ({
          remark: ar.remark,
          author: ar.user_name || 'Manager',
          role: ar.role || 'Authority',
          date: ar.created_at ? new Date(ar.created_at).toISOString().slice(0, 10) : '',
        }))
      : [];

    planAuthorityRemarks.forEach((ar) => {
      seniorDirectives.push({
        target: 'Work Plan',
        date: ar.date,
        remark: ar.remark,
        role: ar.role,
        author: ar.author,
      });
    });

    detailedWorkPlansLog.push({
      date: p.plan_date ? p.plan_date.toISOString().slice(0, 10) : '',
      plan_type: p.plan_type || 'Visits',
      location: p.location || '',
      planner_remarks: p.remarks || '',
      is_discussed_with_manager: Boolean(p.is_discussed_with_manager),
      discussed_manager: p.discussed_manager_name || p.discussed_manager_id?.name || '',
      discussion_method: p.discussion_method || '',
      status: p.status,
      manager_remarks: p.manager_remarks || '',
      authority_remarks: planAuthorityRemarks,
      day_end_subject: p.day_end?.subject || '',
      day_end_summary: cleanDayEndBody.slice(0, 300),
    });
  });

  const planCompletionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;
  const managerDiscussedRate = totalPlans > 0 ? Math.round((managerDiscussedCount / totalPlans) * 100) : 0;
  const dayEndTimelinessRate = dayEndSubmittedCount > 0 ? Math.round((dayEndOnTimeCount / dayEndSubmittedCount) * 100) : 100;
  const totalExpensesAmount = expenses.reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);

  // --- 2. Compute Visit Metrics & Full Log ---
  const totalVisits = visits.length;
  let completedVisits = 0;
  let inProgressVisits = 0;
  let pendingVisits = 0;
  let cancelledVisits = 0;

  let newPartiesCount = 0;
  let existingPartiesCount = 0;

  let checkedInCount = 0;
  let checkedOutCount = 0;
  let geoCompliantCheckInsCount = 0;
  let totalDurationMinutes = 0;
  let durationCalculatedCount = 0;

  const meetingOutcomes = {
    order_received: 0,
    new_product_introduced: 0,
    meeting_with_purchase: 0,
    meeting_with_doctor: 0,
    meeting_with_engineer: 0,
    meeting_with_finance: 0,
  };

  visits.forEach((v) => {
    if (v.status === 'completed') completedVisits++;
    else if (v.status === 'in_progress' || v.status === 'checked_in') inProgressVisits++;
    else if (v.status === 'pending') pendingVisits++;
    else if (['cancelled', 'skipped'].includes(v.status)) cancelledVisits++;

    const pType = v.party_type || (v.party ? 'existing' : 'new_party');
    if (['new_party', 'new_lead', 'facility', 'enquiry'].includes(pType)) {
      newPartiesCount++;
    } else {
      existingPartiesCount++;
    }

    if (v.actual_check_in) checkedInCount++;
    if (v.actual_check_out) checkedOutCount++;

    if (v.check_in_lat && v.check_in_lng) {
      geoCompliantCheckInsCount++;
    }

    let meetingDurationMin = null;
    if (v.actual_check_in && v.actual_check_out) {
      const dur = (new Date(v.actual_check_out).getTime() - new Date(v.actual_check_in).getTime()) / 60000;
      if (dur > 0 && dur < 480) {
        totalDurationMinutes += dur;
        durationCalculatedCount++;
        meetingDurationMin = Math.round(dur);
      }
    }

    if (v.order_received) meetingOutcomes.order_received++;
    if (v.new_product_introduced) meetingOutcomes.new_product_introduced++;
    if (v.meeting_with_purchase) meetingOutcomes.meeting_with_purchase++;
    if (v.meeting_with_doctor) meetingOutcomes.meeting_with_doctor++;
    if (v.meeting_with_engineer) meetingOutcomes.meeting_with_engineer++;
    if (v.meeting_with_finance) meetingOutcomes.meeting_with_finance++;

    const visitAuthorityRemarks = Array.isArray(v.authority_remarks)
      ? v.authority_remarks.map((ar) => ({
          remark: ar.remark,
          author: ar.user_name || 'Manager',
          role: ar.role || 'Authority',
          date: ar.created_at ? new Date(ar.created_at).toISOString().slice(0, 10) : '',
        }))
      : [];

    visitAuthorityRemarks.forEach((ar) => {
      seniorDirectives.push({
        target: `Visit (${v.party_name || 'Client'})`,
        date: ar.date,
        remark: ar.remark,
        role: ar.role,
        author: ar.author,
      });
    });

    detailedVisitsLog.push({
      date: v.plan_date ? new Date(v.plan_date).toISOString().slice(0, 10) : '',
      party_name: v.party_name || (typeof v.party === 'object' ? v.party?.party_name : 'Client Visit'),
      party_type: pType,
      contact_person: v.contact_person || '',
      contact_number: v.contact_number || '',
      contact_email: v.contact_email || '',
      planned_purpose: v.purpose || '',
      planned_notes: v.notes || '',
      address: v.address || '',
      status: v.status,
      actual_check_in: v.actual_check_in ? new Date(v.actual_check_in).toLocaleTimeString() : null,
      actual_check_out: v.actual_check_out ? new Date(v.actual_check_out).toLocaleTimeString() : null,
      duration_minutes: meetingDurationMin,
      check_in_geo_address: v.check_in_address || '',
      outcome_notes: v.outcome || '',
      planner_pending_remarks: v.pending_remarks || '',
      planner_in_progress_remarks: v.in_progress_remarks || '',
      manager_remarks: v.manager_remarks || '',
      senior_authority_remarks: visitAuthorityRemarks,
      key_achievements: {
        order_received: Boolean(v.order_received),
        new_product_introduced: Boolean(v.new_product_introduced),
        decision_maker_meeting: Boolean(v.meeting_with_purchase || v.meeting_with_doctor || v.meeting_with_engineer || v.meeting_with_finance),
      },
    });
  });

  const visitCompletionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 100) : 0;
  const newPartyRatio = totalVisits > 0 ? Math.round((newPartiesCount / totalVisits) * 100) : 0;
  const geoComplianceRate = checkedInCount > 0 ? Math.round((geoCompliantCheckInsCount / checkedInCount) * 100) : (totalVisits > 0 ? 0 : 100);
  const avgDurationMinutes = durationCalculatedCount > 0 ? Math.round(totalDurationMinutes / durationCalculatedCount) : 0;

  // --- 3. Compute Task Metrics & Full Log ---
  const totalTasks = works.length;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let pendingTasks = 0;
  let cancelledTasks = 0;

  let rolloverTasksCount = 0;
  let templateTasksCount = 0;
  let adHocTasksCount = 0;

  works.forEach((w) => {
    if (w.status === 'completed') completedTasks++;
    else if (w.status === 'in_progress') inProgressTasks++;
    else if (w.status === 'pending') pendingTasks++;
    else if (['cancelled', 'skipped'].includes(w.status)) cancelledTasks++;

    const isRollover = Boolean(w.is_from_previous_plan || (w.pending_remarks && w.pending_remarks.toLowerCase().includes('rollover')));
    if (isRollover) {
      rolloverTasksCount++;
    }

    if (w.is_template_task) {
      templateTasksCount++;
    } else {
      adHocTasksCount++;
    }

    const taskAuthorityRemarks = Array.isArray(w.authority_remarks)
      ? w.authority_remarks.map((ar) => ({
          remark: ar.remark,
          author: ar.user_name || 'Manager',
          role: ar.role || 'Authority',
          date: ar.created_at ? new Date(ar.created_at).toISOString().slice(0, 10) : '',
        }))
      : [];

    taskAuthorityRemarks.forEach((ar) => {
      seniorDirectives.push({
        target: `Task (${w.title})`,
        date: ar.date,
        remark: ar.remark,
        role: ar.role,
        author: ar.author,
      });
    });

    detailedTasksLog.push({
      date: w.plan_date ? new Date(w.plan_date).toISOString().slice(0, 10) : '',
      title_head: w.title,
      description: w.description || '',
      status: w.status,
      is_template: Boolean(w.is_template_task),
      is_rollover_task: isRollover,
      planned_start_time: w.planned_start_time ? new Date(w.planned_start_time).toLocaleTimeString() : null,
      planned_end_time: w.planned_end_time ? new Date(w.planned_end_time).toLocaleTimeString() : null,
      planner_completion_remarks: w.completion_remarks || '',
      planner_pending_remarks: w.pending_remarks || '',
      planner_in_progress_remarks: w.in_progress_remarks || '',
      manager_remarks: w.manager_remarks || '',
      senior_authority_remarks: taskAuthorityRemarks,
    });
  });

  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const rolloverRate = totalTasks > 0 ? Math.round((rolloverTasksCount / totalTasks) * 100) : 0;
  const templateRate = totalTasks > 0 ? Math.round((templateTasksCount / totalTasks) * 100) : 0;

  return {
    executive: {
      id: String(userOid),
      name: userName,
      email: userEmail,
      department: userDept,
    },
    period: {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
      daysCovered: Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000)),
    },
    planMetrics: {
      totalPlans,
      completedPlans,
      submittedPlans,
      approvedPlans,
      rejectedPlans,
      plannedPlans,
      leavePlansCount,
      wfhCount,
      wfoCount,
      visitsOnlyCount,
      tasksAndVisitsCount,
      planCompletionRate,
      managerDiscussedCount,
      managerDiscussedRate,
      discussionMethods,
      dayEndSubmittedCount,
      dayEndOnTimeCount,
      dayEndTimelinessRate,
      totalExpensesAmount,
      authorityRemarksCount: seniorDirectives.filter((d) => d.target === 'Work Plan').length,
    },
    visitMetrics: {
      totalVisits,
      completedVisits,
      inProgressVisits,
      pendingVisits,
      cancelledVisits,
      visitCompletionRate,
      newPartiesCount,
      existingPartiesCount,
      newPartyRatio,
      checkedInCount,
      checkedOutCount,
      geoCompliantCheckInsCount,
      geoComplianceRate,
      avgDurationMinutes,
      meetingOutcomes,
      sampleVisits: detailedVisitsLog.slice(0, 15),
      authorityRemarksCount: seniorDirectives.filter((d) => d.target.startsWith('Visit')).length,
    },
    taskMetrics: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      cancelledTasks,
      taskCompletionRate,
      rolloverTasksCount,
      rolloverRate,
      templateTasksCount,
      adHocTasksCount,
      templateRate,
      sampleTasks: detailedTasksLog.slice(0, 15),
      authorityRemarksCount: seniorDirectives.filter((d) => d.target.startsWith('Task')).length,
    },
    holisticContext: {
      recentDayEndNotes: recentDayEndNotes.slice(0, 10),
      seniorDirectives: seniorDirectives.slice(0, 20),
    },
    qualitativeRecords: {
      workPlans: detailedWorkPlansLog.slice(-30),
      visits: detailedVisitsLog.slice(-50),
      tasks: detailedTasksLog.slice(-50),
      seniorDirectives: seniorDirectives.slice(-30),
      dayEndNarratives: recentDayEndNotes.slice(-15),
    },
  };
}

module.exports = {
  harvestIndividualPlanData,
};
