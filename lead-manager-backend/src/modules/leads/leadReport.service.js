/**
 * @fileoverview Lead analytics / reporting aggregates (dashboard, funnel, performance).
 * Visibility: lead_manager portal `manager` sees all (optional assignee filter);
 * `executive` only leads assigned to them.
 * @module modules/leads/leadReport.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { isLeadAdmin, isLeadManager, isLeadCoordinator, isLeadExecutive } = require('./lead.service');
const { getVisibleLeadUserIds } = require('../team/teamVisibility.service');

function toObjectId(id) {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/** Match leads where assigned_to equals userId. */
function assigneeMatchOr(userId) {
  const oid = toObjectId(userId);
  const sid = String(userId);
  return [
    { assigned_to: oid },
    { assigned_to: sid },
  ];
}

function leadAssignedToUser(lead, userId) {
  if (!lead) return false;
  const uid = String(userId);
  const targetId = typeof lead.assigned_to === 'object' ? String(lead.assigned_to?._id || lead.assigned_to) : String(lead.assigned_to);
  if (targetId === uid) return true;
  if (Array.isArray(lead.assigned_users)) {
    if (lead.assigned_users.some((u) => String(u?._id || u) === uid)) return true;
  }
  return false;
}

function singleAssigneeOr(userId) {
  const oid = toObjectId(userId);
  const sid = String(userId);
  return {
    $or: [
      { assigned_to: oid },
      { assigned_to: sid },
      { assigned_users: oid },
    ],
  };
}

function assigneeScopeOr(userIds) {
  const ids = [...new Set((userIds || []).map(String).filter(Boolean))];
  const oids = ids.map(toObjectId).filter(Boolean);
  return {
    $or: [
      { assigned_to: { $in: oids } },
      { assigned_to: { $in: ids } },
      { assigned_users: { $in: oids } },
    ],
  };
}

/**
 * Builds lead filter based on date ranges, period presets, sales rep filter, and user visibility permissions.
 */
async function buildLeadReportFilter(query = {}, user) {
  const q = { deletedAt: null };
  const andConditions = [];

  const assigneeId =
    query.assigned_to && query.assigned_to !== 'all'
      ? String(query.assigned_to)
      : query.sales_person && query.sales_person !== 'all'
        ? String(query.sales_person)
        : null;

  if (isLeadAdmin(user)) {
    // Admin sales report is global across all leads.
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        andConditions.push({ assigned_to: null });
      } else {
        andConditions.push(singleAssigneeOr(assigneeId));
      }
    }
  } else if (isLeadManager(user) || isLeadCoordinator(user)) {
    // Coordinator & Manager team report: leads assigned to the team
    const visibleIds = await getVisibleLeadUserIds(user);
    const teamIds = visibleIds && visibleIds.length > 0 ? visibleIds.map(String) : [String(user._id)];
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        andConditions.push({ assigned_to: null });
      } else if (!teamIds.includes(assigneeId)) {
        andConditions.push({ assigned_to: { $in: [] } });
      } else {
        andConditions.push(singleAssigneeOr(assigneeId));
      }
    } else {
      andConditions.push(assigneeScopeOr(teamIds));
    }
  } else {
    // Executive "my report": leads assigned to me OR created by me
    if (assigneeId && assigneeId !== String(user._id)) {
      andConditions.push({ assigned_to: { $in: [] } });
    } else {
      const userId = toObjectId(user._id);
      const userStr = String(user._id);
      andConditions.push({
        $or: [
          { assigned_to: userId },
          { assigned_to: userStr },
          { assigned_users: userId },
          { created_by: userId },
          { created_by: userStr },
        ],
      });
    }
  }

  if (query.department && query.department !== 'all') {
    andConditions.push({ department: String(query.department).trim().toLowerCase() });
  }

  // Date range / period presets
  if (query.from || query.to) {
    const dateCond = {};
    if (query.from) dateCond.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) dateCond.$lte = new Date(`${query.to}T23:59:59.999Z`);
    andConditions.push({ createdAt: dateCond });
  } else if (query.startDate || query.endDate || query.start_date || query.end_date) {
    const s = query.startDate || query.start_date;
    const e = query.endDate || query.end_date;
    const dateCond = {};
    if (s) dateCond.$gte = new Date(s);
    if (e) dateCond.$lte = new Date(e);
    andConditions.push({ createdAt: dateCond });
  } else if (query.period && query.period !== 'all_time') {
    const now = new Date();
    const dateCond = {};
    if (query.period === 'today') {
      dateCond.$gte = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      dateCond.$lte = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (query.period === 'this_week') {
      const day = now.getDay() || 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - day + 1);
      monday.setHours(0, 0, 0, 0);
      dateCond.$gte = monday;
      dateCond.$lte = now;
    } else if (query.period === 'this_month') {
      dateCond.$gte = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
      dateCond.$lte = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    } else if (query.period === 'last_month') {
      dateCond.$gte = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0));
      dateCond.$lte = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
    } else if (query.period === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      dateCond.$gte = new Date(Date.UTC(now.getFullYear(), qMonth, 1, 0, 0, 0));
      dateCond.$lte = new Date(Date.UTC(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999));
    } else if (query.period === 'this_year') {
      // Indian Financial Year: April 1 to March 31
      const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      dateCond.$gte = new Date(Date.UTC(startYear, 3, 1, 0, 0, 0));
      dateCond.$lte = new Date(Date.UTC(startYear + 1, 2, 31, 23, 59, 59, 999));
    }
    if (Object.keys(dateCond).length > 0) {
      andConditions.push({ createdAt: dateCond });
    }
  }

  if (query.status && query.status !== 'all') {
    andConditions.push({ status: query.status });
  }

  if (andConditions.length > 0) {
    q.$and = andConditions;
  }

  return q;
}

/**
 * Get dashboard KPI counters for leads.
 */
async function getDashboardStats(query = {}, user) {
  const { Lead } = getModels();
  const q = await buildLeadReportFilter(query, user);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const allLeads = await Lead.find(q)
    .select('status estimated_value products.quantity next_follow_up_at lead_no company_name name')
    .lean();

  let totalLeads = allLeads.length;
  let newLeads = 0;
  let assignedLeads = 0;
  let followUpLeads = 0;
  let quotationLeads = 0;
  let wonLeads = 0;
  let lostLeads = 0;
  let convertedLeads = 0;
  let followUpsToday = 0;
  let overdueFollowUps = 0;
  let totalPipelineValue = 0;
  let totalWonValue = 0;
  let totalPipelineQuantity = 0;
  let totalWonQuantity = 0;

  for (const lead of allLeads) {
    const st = lead.status;
    const estVal = Number(lead.estimated_value) || 0;
    const leadQty = Array.isArray(lead.products)
      ? lead.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
      : 0;

    if (st === 'new') newLeads++;
    else if (st === 'assigned') assignedLeads++;
    else if (st === 'follow_up') followUpLeads++;
    else if (st === 'quotation') quotationLeads++;
    else if (st === 'won') wonLeads++;
    else if (st === 'lost') lostLeads++;
    else if (st === 'converted') convertedLeads++;

    if (lead.next_follow_up_at) {
      const followUpDate = new Date(lead.next_follow_up_at);
      if (followUpDate >= startOfToday && followUpDate <= endOfToday) {
        followUpsToday++;
      } else if (followUpDate < startOfToday && !['won', 'lost', 'converted'].includes(st)) {
        overdueFollowUps++;
      }
    }

    if (['new', 'assigned', 'follow_up', 'quotation'].includes(st)) {
      totalPipelineValue += estVal;
      totalPipelineQuantity += leadQty;
    } else if (['won', 'converted'].includes(st)) {
      totalWonValue += estVal;
      totalWonQuantity += leadQty;
    }
  }

  const qualifiedLeads = quotationLeads + wonLeads + convertedLeads;
  const totalDecided = wonLeads + convertedLeads + lostLeads;
  const winRate = totalDecided > 0
    ? Math.round(((wonLeads + convertedLeads) / totalDecided) * 1000) / 10
    : 0;
  const conversionRate = totalLeads > 0
    ? Math.round(((wonLeads + convertedLeads) / totalLeads) * 1000) / 10
    : 0;
  const avgDealSize = (wonLeads + convertedLeads) > 0
    ? Math.round(totalWonValue / (wonLeads + convertedLeads))
    : totalLeads > 0
    ? Math.round((totalPipelineValue + totalWonValue) / totalLeads)
    : 0;

  return {
    totalLeads,
    total_leads: totalLeads,
    newLeads,
    assignedLeads,
    followUpLeads,
    quotationLeads,
    wonLeads,
    lostLeads,
    convertedLeads,
    qualifiedLeads,
    followUpsToday,
    overdueFollowUps,
    totalPipelineValue,
    totalWonValue,
    totalPipelineQuantity,
    totalWonQuantity,
    win_rate: winRate,
    conversion_rate: conversionRate,
    avg_deal_size: avgDealSize,
    won_deals: {
      count: wonLeads + convertedLeads,
      value: totalWonValue,
      win_rate: winRate,
    },
    converted_accounts: {
      count: convertedLeads,
      value: totalWonValue,
      conversion_rate: conversionRate,
    },
    active_pipeline: {
      count: newLeads + assignedLeads + followUpLeads + quotationLeads,
      value: totalPipelineValue,
      quantity: totalPipelineQuantity,
    },
    status_breakdown: {
      new: { count: newLeads },
      assigned: { count: assignedLeads },
      follow_up: { count: followUpLeads },
      quotation: { count: quotationLeads },
      won: { count: wonLeads },
      converted: { count: convertedLeads },
      lost: { count: lostLeads },
    },
  };
}

/**
 * Get sales funnel metrics.
 */
async function getSalesFunnel(query = {}, user) {
  const { Lead } = getModels();
  const q = await buildLeadReportFilter(query, user);

  const leads = await Lead.find(q).select('status estimated_value products.quantity').lean();
  const total = leads.length || 1;

  const stageDefs = [
    { key: 'new', label: 'New Inquiries', statuses: ['new'] },
    { key: 'assigned', label: 'Sales Assigned', statuses: ['assigned'] },
    { key: 'follow_up', label: 'Active Follow-Up', statuses: ['follow_up'] },
    { key: 'quotation', label: 'Quotation Submitted', statuses: ['quotation'] },
    { key: 'won', label: 'Deal Won', statuses: ['won'] },
    { key: 'converted', label: 'Converted to Account', statuses: ['converted'] },
  ];

  const stages = stageDefs.map((def) => {
    const matching = leads.filter((l) => def.statuses.includes(l.status));
    const count = matching.length;
    const estimatedValue = matching.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);
    const quantity = matching.reduce(
      (sum, l) =>
        sum +
        (Array.isArray(l.products)
          ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
          : 0),
      0
    );
    const percentage = total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0;

    return {
      key: def.key,
      label: def.label,
      count,
      quantity,
      estimated_value: estimatedValue,
      percentage,
    };
  });

  const lostLeads = leads.filter((l) => l.status === 'lost');
  const lostCount = lostLeads.length;
  const lostValue = lostLeads.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

  return {
    total_leads: leads.length,
    stages,
    drop_offs: {
      lost: {
        count: lostCount,
        value: lostValue,
      },
    },
  };
}

/**
 * Performance breakdown by sales executive / assignee.
 */
async function getSalesPerformance(query = {}, user) {
  const { Lead, LeadFollowUp, User } = getModels();

  const matchQ = await buildLeadReportFilter(query, user);

  const userFilter = {
    is_active: true,
  };
  if (isLeadAdmin(user)) {
    // Admin sees all portal users
  } else if (isLeadManager(user) || isLeadCoordinator(user)) {
    const visibleIds = await getVisibleLeadUserIds(user);
    const oids = (visibleIds || []).map(toObjectId).filter(Boolean);
    const sids = (visibleIds || []).map(String).filter(Boolean);
    userFilter._id = { $in: [...oids, ...sids] };
  } else {
    userFilter._id = user._id;
  }

  let assignees = await User.find(userFilter)
    .select('name email department portals portal_access')
    .lean();

  const leads = await Lead.find(matchQ)
    .select('assigned_to assigned_users created_by status estimated_value next_follow_up_at products')
    .lean();

  if (isLeadAdmin(user)) {
    const executives = assignees.filter((su) => {
      const portals = Array.isArray(su.portals)
        ? su.portals
        : Array.isArray(su.portal_access)
          ? su.portal_access
          : [];
      const portalAccess = portals.find(
        (p) => p && (p.portal_code === 'lead_manager' || p.portal === 'lead_manager')
      );
      return Boolean(
        portalAccess &&
          Array.isArray(portalAccess.access_roles) &&
          portalAccess.access_roles.length > 0
      );
    });

    if (executives.length > 0) {
      assignees = executives;
    } else {
      const leadAssigneeIds = new Set(
        leads
          .map((l) =>
            l.assigned_to
              ? String(typeof l.assigned_to === 'object' ? l.assigned_to._id || l.assigned_to : l.assigned_to)
              : null
          )
          .filter(Boolean)
      );
      assignees = assignees.filter(
        (su) => leadAssigneeIds.has(String(su._id))
      );
    }
  }

  const assigneeId =
    query.assigned_to && query.assigned_to !== 'all'
      ? String(query.assigned_to)
      : query.sales_person && query.sales_person !== 'all'
        ? String(query.sales_person)
        : null;

  if (assigneeId && assigneeId !== 'unassigned') {
    assignees = assignees.filter((su) => String(su._id) === assigneeId);
  }

  const followUps = await LeadFollowUp.find({ deletedAt: null })
    .select('created_by status follow_up_date lead')
    .lean();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const performance = assignees.map((su) => {
    const uidStr = String(su._id);
    const isExecutiveSelf = !isLeadAdmin(user) && !isLeadManager(user) && !isLeadCoordinator(user) && uidStr === String(user._id);
    const userLeads = leads.filter((l) => {
      if (leadAssignedToUser(l, uidStr)) return true;
      if (isExecutiveSelf) {
        const creatorId = typeof l.created_by === 'object' ? String(l.created_by?._id || l.created_by) : String(l.created_by);
        if (creatorId === uidStr) return true;
      }
      return false;
    });
    const totalLeads = userLeads.length;

    const qualifiedLeads = userLeads.filter((l) =>
      ['quotation', 'won', 'converted'].includes(l.status)
    ).length;

    const quotations = userLeads.filter((l) => l.status === 'quotation').length;
    const wonLeads = userLeads.filter((l) => ['won', 'converted'].includes(l.status)).length;
    const lostLeads = userLeads.filter((l) => l.status === 'lost').length;

    const decided = wonLeads + lostLeads;
    const winRate = decided > 0 ? Number(((wonLeads / decided) * 100).toFixed(1)) : 0;
    const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;

    const pipelineQty = userLeads
      .filter((l) =>
        ['new', 'assigned', 'follow_up', 'quotation'].includes(l.status)
      )
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const wonQty = userLeads
      .filter((l) => ['won', 'converted'].includes(l.status))
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const lostQty = userLeads
      .filter((l) => l.status === 'lost')
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const pipelineValue = userLeads
      .filter((l) =>
        ['new', 'assigned', 'follow_up', 'quotation'].includes(l.status)
      )
      .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    const wonValue = userLeads
      .filter((l) => ['won', 'converted'].includes(l.status))
      .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    const avgLeadValue = totalLeads > 0 ? Math.round((pipelineValue + wonValue) / totalLeads) : 0;

    const userFollowUps = followUps.filter((f) => String(f.created_by) === uidStr);
    const completedFollowups = userFollowUps.filter((f) => f.status === 'completed').length;
    const overdueFollowups = userLeads.filter(
      (l) =>
        l.next_follow_up_at &&
        new Date(l.next_follow_up_at) < startOfToday &&
        !['won', 'lost', 'converted'].includes(l.status)
    ).length;

    return {
      user_id: su._id,
      name: su.name,
      email: su.email,
      department: su.department,
      total_leads: totalLeads,
      qualified_leads: qualifiedLeads,
      quotations,
      won_leads: wonLeads,
      lost_leads: lostLeads,
      win_rate: winRate,
      conversion_rate: conversionRate,
      pipeline_qty: pipelineQty,
      pipeline_quantity: pipelineQty,
      won_qty: wonQty,
      won_quantity: wonQty,
      lost_qty: lostQty,
      lost_quantity: lostQty,
      pipeline_value: pipelineValue,
      won_value: wonValue,
      avg_lead_value: avgLeadValue,
      completed_followups: completedFollowups,
      overdue_followups: overdueFollowups,
    };
  });

  performance.sort((a, b) => b.won_value - a.won_value || b.total_leads - a.total_leads);
  return performance;
}

/**
 * Monthly / Periodic Pipeline & Conversion Trends.
 */
async function getLeadMonthlyTrends(query = {}, user) {
  const { Lead } = getModels();
  const filter = await buildLeadReportFilter(query, user);

  const leads = await Lead.find(filter)
    .select('createdAt status estimated_value products')
    .sort({ createdAt: 1 })
    .lean();

  const monthMap = new Map();

  for (const l of leads) {
    const d = l.createdAt ? new Date(l.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        period_key: key,
        period_label: label,
        total_leads: 0,
        pipeline_value: 0,
        won_count: 0,
        won_value: 0,
        converted_count: 0,
        converted_value: 0,
        lost_count: 0,
        lost_value: 0,
        quotation_count: 0,
      });
    }

    const m = monthMap.get(key);
    const estVal = Number(l.estimated_value) || 0;
    const st = l.status;

    m.total_leads += 1;
    m.pipeline_value += estVal;

    if (st === 'won' || st === 'converted') {
      m.won_count += 1;
      m.won_value += estVal;
      if (st === 'converted') {
        m.converted_count += 1;
        m.converted_value += estVal;
      }
    } else if (st === 'lost') {
      m.lost_count += 1;
      m.lost_value += estVal;
    } else if (st === 'quotation') {
      m.quotation_count += 1;
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.period_key.localeCompare(b.period_key));
}

/**
 * Top Demanded Products & Revenue Breakdown in Leads.
 */
async function getLeadProductBreakdown(query = {}, user) {
  const { Lead } = getModels();
  const filter = await buildLeadReportFilter(query, user);

  const leads = await Lead.find(filter)
    .select('products status createdAt estimated_value')
    .lean();

  const productMap = new Map();

  for (const l of leads) {
    const isWon = l.status === 'won' || l.status === 'converted';
    const isConverted = l.status === 'converted';

    if (Array.isArray(l.products)) {
      for (const p of l.products) {
        const pName = (p.name || p.product_name || 'Standard Product').trim();
        const qty = Number(p.quantity) || 1;
        const targetPrice = Number(p.target_price || p.price || 0);
        const estValue = Number(p.estimated_value || targetPrice * qty) || 0;

        if (!productMap.has(pName)) {
          productMap.set(pName, {
            product_name: pName,
            unit: p.unit || 'Nos',
            times_inquired: 0,
            total_quantity: 0,
            total_estimated_value: 0,
            won_quantity: 0,
            won_value: 0,
            converted_quantity: 0,
            converted_value: 0,
          });
        }

        const prod = productMap.get(pName);
        prod.times_inquired += 1;
        prod.total_quantity += qty;
        prod.total_estimated_value += estValue;

        if (isWon) {
          prod.won_quantity += qty;
          prod.won_value += estValue;
        }
        if (isConverted) {
          prod.converted_quantity += qty;
          prod.converted_value += estValue;
        }
      }
    }
  }

  const productList = Array.from(productMap.values()).map((p) => {
    p.avg_unit_price = p.total_quantity > 0 ? Math.round(p.total_estimated_value / p.total_quantity) : 0;
    return p;
  });

  productList.sort((a, b) => b.total_estimated_value - a.total_estimated_value);
  return productList.slice(0, 50);
}

/**
 * Get lead sources performance report.
 */
async function getLeadSourcePerformance(query = {}, user) {
  const { Lead, LeadSource } = getModels();
  const q = await buildLeadReportFilter(query, user);

  const [leads, sources] = await Promise.all([
    Lead.find(q).select('source status estimated_value products').lean(),
    LeadSource.find({ deletedAt: null, is_active: true }).select('name').lean(),
  ]);

  const sourceMap = new Map();
  sources.forEach((s) => sourceMap.set(s.name, s.name));

  leads.forEach((l) => {
    if (l.source && !sourceMap.has(l.source)) {
      sourceMap.set(l.source, l.source);
    }
  });

  const report = Array.from(sourceMap.values()).map((srcName) => {
    const srcLeads = leads.filter((l) => l.source === srcName);
    const totalLeads = srcLeads.length;

    const qualifiedLeads = srcLeads.filter((l) =>
      ['quotation', 'won', 'converted'].includes(l.status)
    ).length;

    const wonLeads = srcLeads.filter((l) => ['won', 'converted'].includes(l.status)).length;
    const lostLeads = srcLeads.filter((l) => l.status === 'lost').length;

    const conversionRate = totalLeads > 0 ? Number(((wonLeads / totalLeads) * 100).toFixed(1)) : 0;

    const pipelineQty = srcLeads
      .filter((l) =>
        ['new', 'assigned', 'follow_up', 'quotation'].includes(l.status)
      )
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const wonQty = srcLeads
      .filter((l) => ['won', 'converted'].includes(l.status))
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const lostQty = srcLeads
      .filter((l) => l.status === 'lost')
      .reduce(
        (sum, l) =>
          sum +
          (Array.isArray(l.products)
            ? l.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
            : 0),
        0
      );

    const pipelineValue = srcLeads
      .filter((l) =>
        ['new', 'assigned', 'follow_up', 'quotation'].includes(l.status)
      )
      .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    const wonValue = srcLeads
      .filter((l) => ['won', 'converted'].includes(l.status))
      .reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0);

    return {
      source: srcName,
      total_leads: totalLeads,
      qualified_leads: qualifiedLeads,
      won_leads: wonLeads,
      lost_leads: lostLeads,
      conversion_rate: conversionRate,
      pipeline_qty: pipelineQty,
      pipeline_quantity: pipelineQty,
      won_qty: wonQty,
      won_quantity: wonQty,
      lost_qty: lostQty,
      lost_quantity: lostQty,
      pipeline_value: pipelineValue,
      won_value: wonValue,
    };
  });

  report.sort((a, b) => b.total_leads - a.total_leads);
  return report;
}

/**
 * Get comprehensive follow-ups analytics report covering both Leads and Quotations.
 */
async function getFollowUpAnalyticsReport(query = {}, user) {
  const { LeadFollowUp } = getModels();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const q = { deletedAt: null };

  // Period / Date filters on follow_up_date
  if (query.from_date || query.to_date || query.from || query.to) {
    q.follow_up_date = {};
    const fromStr = query.from_date || query.from;
    const toStr = query.to_date || query.to;
    if (fromStr) {
      const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
      if (!isNaN(fromDate.getTime())) q.follow_up_date.$gte = fromDate;
    }
    if (toStr) {
      const toDate = new Date(`${toStr}T23:59:59.999Z`);
      if (!isNaN(toDate.getTime())) q.follow_up_date.$lte = toDate;
    }
  } else if (query.period) {
    const p = String(query.period).toLowerCase();
    if (p === 'today') {
      q.follow_up_date = { $gte: startOfToday, $lte: endOfToday };
    } else if (p === 'this_week') {
      const dayOfWeek = now.getDay();
      const firstDay = new Date(now);
      firstDay.setDate(now.getDate() - dayOfWeek);
      firstDay.setHours(0, 0, 0, 0);
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      lastDay.setHours(23, 59, 59, 999);
      q.follow_up_date = { $gte: firstDay, $lte: lastDay };
    } else if (p === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      q.follow_up_date = { $gte: firstDay, $lte: lastDay };
    } else if (p === 'this_quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstDay = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
      const lastDay = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59, 999);
      q.follow_up_date = { $gte: firstDay, $lte: lastDay };
    }
  }

  // Type filter
  if (query.type && query.type !== 'all') {
    q.type = query.type;
  }

  // Status filter
  if (query.status && query.status !== 'all') {
    q.status = query.status;
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

  function followUpMatchesRepUser(fu, targetUserId) {
    const leadAssignee = fu.lead?.assigned_to?._id
      ? String(fu.lead.assigned_to._id)
      : fu.lead?.assigned_to
        ? String(fu.lead.assigned_to)
        : null;
    const inAssignedUsers = Array.isArray(fu.lead?.assigned_users) && fu.lead.assigned_users.some((u) => String(u?._id || u) === targetUserId);
    const qRep = fu.quotation?.sales_person_user?._id
      ? String(fu.quotation.sales_person_user._id)
      : fu.quotation?.sales_person_user
        ? String(fu.quotation.sales_person_user)
        : null;
    return (
      leadAssignee === targetUserId ||
      inAssignedUsers ||
      qRep === targetUserId
    );
  }

  // Executives do NOT have quotation access - strictly filter to Leads follow-ups
  if (!hasQuotationAccess) {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'lead') {
    q.quotation = null;
    q.lead = { $ne: null };
  } else if (query.entity_type === 'quotation') {
    q.quotation = { $ne: null };
  }

  // Fetch follow-ups populated with lead, quotation, created_by, completed_by
  const rows = await LeadFollowUp.find(q)
    .populate({
      path: 'lead',
      select: 'lead_no name company_name phone email status priority estimated_value assigned_to assigned_users created_by party_id requirement_details',
      populate: [
        { path: 'party_id', select: 'party_name legal_name district state mobile email' },
        { path: 'assigned_to', select: 'name email department' },
        { path: 'assigned_users', select: 'name email department' },
        { path: 'created_by', select: 'name email department' },
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
    .sort({ follow_up_date: -1 })
    .lean();

  function followUpMatchesCreatorUser(fu, targetUserId) {
    const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
    const leadCreator = fu.lead?.created_by?._id ? String(fu.lead.created_by._id) : (fu.lead?.created_by ? String(fu.lead.created_by) : null);
    const qCreator = fu.quotation?.created_by?._id ? String(fu.quotation.created_by._id) : (fu.quotation?.created_by ? String(fu.quotation.created_by) : null);
    return fuCreator === targetUserId || leadCreator === targetUserId || qCreator === targetUserId;
  }

  // Filter based on user scope
  let filtered = rows;
  const scope = String(query.scope || '').toLowerCase().trim();

  if (!isAdmin) {
    if (isMgr || isCoord) {
      // Manager / Coordinator: own + reporting downline (by assigned OR created)
      filtered = rows.filter((fu) => {
        if (fu.quotation) {
          const qCreator = fu.quotation?.created_by?._id ? String(fu.quotation.created_by._id) : (fu.quotation?.created_by ? String(fu.quotation.created_by) : null);
          const qRep = fu.quotation?.sales_person_user?._id ? String(fu.quotation.sales_person_user._id) : (fu.quotation?.sales_person_user ? String(fu.quotation.sales_person_user) : null);
          const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
          return teamSet.has(qCreator) || teamSet.has(qRep) || teamSet.has(fuCreator);
        }
        if (fu.lead) {
          const leadAssignee = fu.lead?.assigned_to?._id ? String(fu.lead.assigned_to._id) : (fu.lead?.assigned_to ? String(fu.lead.assigned_to) : null);
          const inAssignedUsers = Array.isArray(fu.lead?.assigned_users) && fu.lead.assigned_users.some((u) => teamSet.has(String(u?._id || u)));
          const leadCreator = fu.lead?.created_by?._id ? String(fu.lead.created_by._id) : (fu.lead?.created_by ? String(fu.lead.created_by) : null);
          const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
          return teamSet.has(leadAssignee) || inAssignedUsers || teamSet.has(leadCreator) || teamSet.has(fuCreator);
        }
        return false;
      });
    } else {
      // Executive: strictly see follow-ups where assigned or created
      filtered = rows.filter((fu) => {
        if (fu.quotation) {
          const qRep = fu.quotation?.sales_person_user?._id ? String(fu.quotation.sales_person_user._id) : (fu.quotation?.sales_person_user ? String(fu.quotation.sales_person_user) : null);
          const qCreator = fu.quotation?.created_by?._id ? String(fu.quotation.created_by._id) : (fu.quotation?.created_by ? String(fu.quotation.created_by) : null);
          const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
          return qRep === userIdStr || qCreator === userIdStr || fuCreator === userIdStr;
        }
        const leadAssignee = fu.lead?.assigned_to?._id ? String(fu.lead.assigned_to._id) : (fu.lead?.assigned_to ? String(fu.lead.assigned_to) : null);
        const inAssignedUsers = Array.isArray(fu.lead?.assigned_users) && fu.lead.assigned_users.some((u) => String(u?._id || u) === userIdStr);
        const leadCreator = fu.lead?.created_by?._id ? String(fu.lead.created_by._id) : (fu.lead?.created_by ? String(fu.lead.created_by) : null);
        const fuCreator = fu.created_by?._id ? String(fu.created_by._id) : (fu.created_by ? String(fu.created_by) : null);
        return leadAssignee === userIdStr || inAssignedUsers || leadCreator === userIdStr || fuCreator === userIdStr;
      });
    }
  }

  // View Scope: "mine" vs "team"
  if (scope === 'mine' || scope === 'me') {
    filtered = filtered.filter((fu) => followUpMatchesRepUser(fu, userIdStr) || followUpMatchesCreatorUser(fu, userIdStr));
  }

  // Filter by assigned_to
  if (query.assigned_to && query.assigned_to !== 'all') {
    const targetUserId = String(query.assigned_to);
    filtered = filtered.filter((fu) => followUpMatchesRepUser(fu, targetUserId));
  }

  // Filter by created_by
  if (query.created_by && query.created_by !== 'all') {
    const targetUserId = String(query.created_by);
    filtered = filtered.filter((fu) => followUpMatchesCreatorUser(fu, targetUserId));
  }

  // Compute Summary KPIs
  let totalFollowups = filtered.length;
  let completedCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let rescheduledCount = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let upcomingCount = 0;
  let onTimeCompletedCount = 0;
  let leadFollowupsCount = 0;
  let quotationFollowupsCount = 0;

  // Track channels & outcomes
  const channelMap = {
    call: { type: 'call', label: 'Phone Call', total: 0, completed: 0, pending: 0, overdue: 0 },
    meeting: { type: 'meeting', label: 'Meeting / Discussion', total: 0, completed: 0, pending: 0, overdue: 0 },
    whatsapp: { type: 'whatsapp', label: 'WhatsApp', total: 0, completed: 0, pending: 0, overdue: 0 },
    email: { type: 'email', label: 'Email Outreach', total: 0, completed: 0, pending: 0, overdue: 0 },
    visit: { type: 'visit', label: 'Field Visit', total: 0, completed: 0, pending: 0, overdue: 0 },
    demo: { type: 'demo', label: 'Product Demo', total: 0, completed: 0, pending: 0, overdue: 0 },
    other: { type: 'other', label: 'Other Touchpoint', total: 0, completed: 0, pending: 0, overdue: 0 },
  };

  const outcomeMap = {};
  const repMap = {};
  const trendMap = {};

  for (const item of filtered) {
    const fDate = new Date(item.follow_up_date);
    const isPast = fDate < startOfToday;
    const isToday = fDate >= startOfToday && fDate <= endOfToday;
    const isFuture = fDate > endOfToday;

    if (item.quotation) {
      quotationFollowupsCount++;
    } else if (item.lead) {
      leadFollowupsCount++;
    }

    if (item.status === 'completed') {
      completedCount++;
      if (item.completed_at) {
        const cDate = new Date(item.completed_at);
        const dueLimit = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate(), 23, 59, 59, 999);
        if (cDate <= dueLimit) {
          onTimeCompletedCount++;
        }
      } else {
        onTimeCompletedCount++;
      }

      if (item.outcome) {
        const outKey = String(item.outcome).trim();
        if (outKey) {
          outcomeMap[outKey] = (outcomeMap[outKey] || 0) + 1;
        }
      }
    } else if (item.status === 'cancelled') {
      cancelledCount++;
    } else if (item.status === 'rescheduled') {
      rescheduledCount++;
    } else {
      pendingCount++;
      if (isPast) overdueCount++;
      else if (isToday) dueTodayCount++;
      else if (isFuture) upcomingCount++;
    }

    // Channel stats
    const cType = channelMap[item.type] ? item.type : 'other';
    channelMap[cType].total++;
    if (item.status === 'completed') {
      channelMap[cType].completed++;
    } else if (item.status === 'pending') {
      channelMap[cType].pending++;
      if (isPast) channelMap[cType].overdue++;
    }

    // Rep stats — lead assignee or quotation sales rep first
    const repUser =
      item.lead?.assigned_to ||
      item.quotation?.sales_person_user ||
      item.created_by;
    const repId = repUser?._id ? String(repUser._id) : 'unassigned';
    const repName = repUser?.name || 'Unassigned';
    const repEmail = repUser?.email || '—';
    const repDept = repUser?.department || 'Sales';

    if (!repMap[repId]) {
      repMap[repId] = {
        user_id: repId,
        name: repName,
        email: repEmail,
        department: repDept,
        total_scheduled: 0,
        completed: 0,
        on_time: 0,
        pending: 0,
        overdue: 0,
        lead_count: 0,
        quotation_count: 0,
      };
    }
    repMap[repId].total_scheduled++;
    if (item.quotation) repMap[repId].quotation_count++;
    else if (item.lead) repMap[repId].lead_count++;

    if (item.status === 'completed') {
      repMap[repId].completed++;
      if (item.completed_at) {
        const cDate = new Date(item.completed_at);
        const dueLimit = new Date(fDate.getFullYear(), fDate.getMonth(), fDate.getDate(), 23, 59, 59, 999);
        if (cDate <= dueLimit) repMap[repId].on_time++;
      } else {
        repMap[repId].on_time++;
      }
    } else if (item.status === 'pending') {
      repMap[repId].pending++;
      if (isPast) repMap[repId].overdue++;
    }

    // Daily Trend stats
    const dateKey = !isNaN(fDate.getTime()) ? fDate.toISOString().slice(0, 10) : 'Unknown';
    if (!trendMap[dateKey]) {
      trendMap[dateKey] = {
        date: dateKey,
        scheduled: 0,
        completed: 0,
        overdue: 0,
        pending: 0,
      };
    }
    trendMap[dateKey].scheduled++;
    if (item.status === 'completed') trendMap[dateKey].completed++;
    else if (item.status === 'pending') {
      trendMap[dateKey].pending++;
      if (isPast) trendMap[dateKey].overdue++;
    }
  }

  const onTimeRate = completedCount > 0 ? Math.round((onTimeCompletedCount / completedCount) * 100) : 100;
  const completionRate = totalFollowups > 0 ? Math.round((completedCount / totalFollowups) * 100) : 0;

  const channelBreakdown = Object.values(channelMap).map((ch) => ({
    type: ch.type,
    label: ch.label,
    total_count: ch.total,
    completed_count: ch.completed,
    pending_count: ch.pending,
    overdue_count: ch.overdue,
    completion_rate: ch.total > 0 ? Math.round((ch.completed / ch.total) * 100) : 0,
    share_percent: totalFollowups > 0 ? Math.round((ch.total / totalFollowups) * 100) : 0,
  }));

  const outcomeBreakdown = Object.entries(outcomeMap)
    .map(([outcome, count]) => ({
      outcome,
      count,
      percent: completedCount > 0 ? Math.round((count / completedCount) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const repScorecard = Object.values(repMap)
    .map((r) => ({
      ...r,
      on_time_rate: r.completed > 0 ? Math.round((r.on_time / r.completed) * 100) : 100,
      completion_rate: r.total_scheduled > 0 ? Math.round((r.completed / r.total_scheduled) * 100) : 0,
    }))
    .sort((a, b) => b.total_scheduled - a.total_scheduled);

  const dailyTrends = Object.values(trendMap).sort((a, b) => a.date.localeCompare(b.date));

  // Build flattened detailed records
  const detailedRecords = filtered.map((fu) => {
    const isPast = new Date(fu.follow_up_date) < startOfToday;
    const isDueToday = new Date(fu.follow_up_date) >= startOfToday && new Date(fu.follow_up_date) <= endOfToday;
    const isQuotation = Boolean(fu.quotation);

    const leadObj = fu.lead;
    const quoteObj = fu.quotation;

    const contactPerson =
      quoteObj?.kind_attn ||
      leadObj?.name ||
      (typeof leadObj?.party_id === 'object' ? leadObj.party_id?.party_name : '') ||
      '—';

    const companyName =
      (typeof quoteObj?.party_id === 'object' ? quoteObj.party_id?.party_name : '') ||
      (typeof leadObj?.party_id === 'object' ? leadObj.party_id?.party_name : '') ||
      quoteObj?.customer_name ||
      leadObj?.company_name ||
      '—';

    const phone = quoteObj?.phone || leadObj?.phone || (typeof leadObj?.party_id === 'object' ? leadObj.party_id?.mobile : '') || '—';
    const email = quoteObj?.email || leadObj?.email || (typeof leadObj?.party_id === 'object' ? leadObj.party_id?.email : '') || '—';
    const city = (typeof leadObj?.party_id === 'object' ? leadObj.party_id?.district : '') || '—';

    const repName = fu.created_by?.name || leadObj?.assigned_to?.name || quoteObj?.sales_person_name || 'Unassigned';

    let displayStatus = fu.status;
    if (fu.status === 'pending' && isPast) displayStatus = 'overdue';
    else if (fu.status === 'pending' && isDueToday) displayStatus = 'due_today';

    return {
      _id: String(fu._id),
      entity_type: isQuotation ? 'quotation' : 'lead',
      entity_ref_no: isQuotation ? quoteObj?.quotation_no || 'QUOTE' : leadObj?.lead_no || 'LEAD',
      lead_id: leadObj?._id ? String(leadObj._id) : null,
      quotation_id: quoteObj?._id ? String(quoteObj._id) : null,
      customer_name: contactPerson,
      company_name: companyName,
      phone,
      email,
      city,
      rep_name: repName,
      type: fu.type,
      status: fu.status,
      display_status: displayStatus,
      follow_up_date: fu.follow_up_date ? new Date(fu.follow_up_date).toISOString() : null,
      follow_up_time: fu.follow_up_time || '—',
      completed_at: fu.completed_at ? new Date(fu.completed_at).toISOString() : null,
      outcome: fu.outcome || '—',
      notes: fu.notes || '—',
      commercial_value: isQuotation ? (quoteObj?.grand_total || 0) : (leadObj?.estimated_value || 0),
    };
  });

  return {
    summary: {
      total_followups: totalFollowups,
      completed_count: completedCount,
      pending_count: pendingCount,
      cancelled_count: cancelledCount,
      rescheduled_count: rescheduledCount,
      overdue_count: overdueCount,
      due_today_count: dueTodayCount,
      upcoming_count: upcomingCount,
      on_time_completed_count: onTimeCompletedCount,
      on_time_rate: onTimeRate,
      completion_rate: completionRate,
      lead_followups_count: leadFollowupsCount,
      quotation_followups_count: quotationFollowupsCount,
    },
    channel_breakdown: channelBreakdown,
    outcome_breakdown: outcomeBreakdown,
    rep_scorecard: repScorecard,
    daily_trends: dailyTrends,
    detailed_records: detailedRecords,
  };
}

module.exports = {
  getDashboardStats,
  getSalesFunnel,
  getSalesPerformance,
  getSourcePerformance: getLeadSourcePerformance,
  getLeadSourcePerformance,
  getLeadMonthlyTrends,
  getLeadProductBreakdown,
  getFollowUpAnalyticsReport,
};
