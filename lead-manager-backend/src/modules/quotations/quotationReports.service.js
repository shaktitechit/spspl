/**
 * @fileoverview Quotation Analytics & Reporting Service.
 * Provides commercial pipeline analytics, sales performance scorecards, funnel conversions, monthly trends, and top products.
 * @module modules/quotations/quotationReports.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { isLeadAdmin } = require('../leads/lead.service');

function toObjectId(id) {
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/**
 * Builds quotation filter based on date ranges, sales rep filter, and user visibility permissions.
 */
async function buildReportFilter(query = {}, user) {
  const q = { deletedAt: null };
  const andConditions = [];

  // Role visibility: Admins see all quotations. Managers/Coordinators see their downline team.
  if (user && !isLeadAdmin(user)) {
    const { getVisibleLeadUserIds } = require('../team/teamVisibility.service');
    const visibleIds = await getVisibleLeadUserIds(user);
    if (visibleIds && Array.isArray(visibleIds) && visibleIds.length > 0) {
      const objIds = visibleIds.map(toObjectId);
      andConditions.push({
        $or: [
          { created_by: { $in: objIds } },
          { sales_person_user: { $in: objIds } },
          { signatory_user: { $in: objIds } },
        ],
      });
    } else {
      const userId = toObjectId(user._id);
      andConditions.push({
        $or: [
          { created_by: userId },
          { sales_person_user: userId },
          { signatory_user: userId },
        ],
      });
    }
  }

  if (query.sales_person && query.sales_person !== 'all') {
    const spId = toObjectId(query.sales_person);
    andConditions.push({
      $or: [
        { sales_person_user: spId },
        { created_by: spId },
      ],
    });
  }

  // Date range filter
  if (query.from || query.to) {
    const dateCond = {};
    if (query.from) dateCond.$gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) dateCond.$lte = new Date(`${query.to}T23:59:59.999Z`);
    andConditions.push({
      $or: [
        { quotation_date: dateCond },
        { quotation_date: null, createdAt: dateCond },
      ],
    });
  } else if (query.startDate || query.endDate || query.start_date || query.end_date) {
    const s = query.startDate || query.start_date;
    const e = query.endDate || query.end_date;
    const dateCond = {};
    if (s) dateCond.$gte = new Date(s);
    if (e) dateCond.$lte = new Date(e);
    andConditions.push({
      $or: [
        { quotation_date: dateCond },
        { quotation_date: null, createdAt: dateCond },
      ],
    });
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
      andConditions.push({
        $or: [
          { quotation_date: dateCond },
          { quotation_date: null, createdAt: dateCond },
        ],
      });
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
 * 1. Comprehensive Quotation Summary Report & Commercial KPIs
 */
async function getQuotationSummaryReport(query = {}, user) {
  const { LeadQuotation } = getModels();
  const filter = await buildReportFilter(query, user);

  const quotes = await LeadQuotation.find(filter)
    .select('quotation_no version status approval_status grand_total subtotal total_discount total_gst items valid_until quotation_date customer_name created_by conversion sales_person_user sales_person_name')
    .lean();

  let totalCount = quotes.length;
  let totalGrossValue = 0;
  let totalDiscountValue = 0;
  let totalNetQuotedValue = 0;

  // Status counters & values
  const statusSummary = {
    draft: { count: 0, value: 0 },
    pending_approval: { count: 0, value: 0 },
    approved: { count: 0, value: 0 },
    sent: { count: 0, value: 0 },
    in_negotiation: { count: 0, value: 0 },
    accepted: { count: 0, value: 0 },
    converted: { count: 0, value: 0 },
    expired: { count: 0, value: 0 },
    rejected: { count: 0, value: 0 },
    on_hold: { count: 0, value: 0 },
  };

  let totalWonValue = 0; // accepted + converted
  let totalWonCount = 0;
  let totalConvertedValue = 0;
  let totalConvertedCount = 0;
  let activeNegotiationValue = 0; // sent + in_negotiation + approved
  let activeNegotiationCount = 0;

  for (const q of quotes) {
    const st = q.status || 'draft';
    const gTotal = Number(q.grand_total) || 0;
    const disc = Number(q.total_discount) || 0;

    totalNetQuotedValue += gTotal;
    totalDiscountValue += disc;
    totalGrossValue += gTotal + disc;

    if (statusSummary[st]) {
      statusSummary[st].count += 1;
      statusSummary[st].value += gTotal;
    }

    if (st === 'accepted') {
      totalWonCount += 1;
      totalWonValue += gTotal;
    } else if (st === 'converted') {
      totalWonCount += 1;
      totalWonValue += gTotal;
      totalConvertedCount += 1;
      totalConvertedValue += gTotal;
    } else if (st === 'sent' || st === 'in_negotiation' || st === 'approved') {
      activeNegotiationCount += 1;
      activeNegotiationValue += gTotal;
    }
  }

  const avgDiscountPercent = totalGrossValue > 0
    ? Math.round((totalDiscountValue / totalGrossValue) * 1000) / 10
    : 0;

  const totalDecided = totalWonCount + (statusSummary.rejected?.count || 0) + (statusSummary.expired?.count || 0);
  const winRate = totalDecided > 0
    ? Math.round((totalWonCount / totalDecided) * 1000) / 10
    : 0;

  const conversionRate = totalWonCount > 0
    ? Math.round((totalConvertedCount / totalWonCount) * 1000) / 10
    : 0;

  const overallConversionRate = totalCount > 0
    ? Math.round((totalConvertedCount / totalCount) * 1000) / 10
    : 0;

  const avgDealSize = totalCount > 0
    ? Math.round(totalNetQuotedValue / totalCount)
    : 0;

  const avgWonDealSize = totalWonCount > 0
    ? Math.round(totalWonValue / totalWonCount)
    : 0;

  return {
    total_quotations: totalCount,
    total_gross_value: totalGrossValue,
    total_discount_value: totalDiscountValue,
    total_net_value: totalNetQuotedValue,
    avg_discount_percent: avgDiscountPercent,
    avg_deal_size: avgDealSize,
    avg_won_deal_size: avgWonDealSize,
    won_deals: {
      count: totalWonCount,
      value: totalWonValue,
      win_rate: winRate,
    },
    converted_orders: {
      count: totalConvertedCount,
      value: totalConvertedValue,
      conversion_rate: conversionRate,
      overall_conversion_rate: overallConversionRate,
    },
    active_negotiations: {
      count: activeNegotiationCount,
      value: activeNegotiationValue,
    },
    status_breakdown: statusSummary,
  };
}

/**
 * 2. Sales Rep / Executive Commercial Performance Scorecard
 */
async function getQuotationSalesPerformance(query = {}, user) {
  const { LeadQuotation, User } = getModels();
  const filter = await buildReportFilter(query, user);

  const quotes = await LeadQuotation.find(filter)
    .populate('sales_person_user', 'name email department phone designation')
    .populate('created_by', 'name email department phone designation')
    .lean();

  // Pre-load all sales users to match by name if sales_person_user is not populated
  const allUsers = await User.find({ is_active: true }).select('name email department').lean();
  const userByNameMap = new Map();
  for (const u of allUsers) {
    userByNameMap.set(u.name.toLowerCase().trim(), u);
  }

  const repMap = new Map();

  for (const q of quotes) {
    let repId = 'unassigned';
    let repName = 'Unassigned / Direct';
    let repEmail = '';
    let repDept = 'Sales';

    if (q.sales_person_user && q.sales_person_user.name) {
      repId = String(q.sales_person_user._id);
      repName = q.sales_person_user.name;
      repEmail = q.sales_person_user.email || '';
      repDept = q.sales_person_user.department || 'Sales';
    } else if (q.sales_person_name && q.sales_person_name.trim()) {
      const match = userByNameMap.get(q.sales_person_name.toLowerCase().trim());
      if (match) {
        repId = String(match._id);
        repName = match.name;
        repEmail = match.email || '';
        repDept = match.department || 'Sales';
      } else {
        repId = `name_${q.sales_person_name.trim().toLowerCase()}`;
        repName = q.sales_person_name.trim();
        repEmail = q.sales_person_email || '';
        repDept = 'Sales';
      }
    } else if (q.created_by && q.created_by.name) {
      repId = String(q.created_by._id);
      repName = q.created_by.name;
      repEmail = q.created_by.email || '';
      repDept = q.created_by.department || 'Sales';
    }

    if (!repMap.has(repId)) {
      repMap.set(repId, {
        user_id: repId.startsWith('name_') || repId === 'unassigned' ? null : repId,
        name: repName,
        email: repEmail,
        department: repDept,
        total_quotations: 0,
        total_quoted_value: 0,
        total_discount_value: 0,
        total_gross_value: 0,
        won_count: 0,
        won_value: 0,
        converted_count: 0,
        converted_value: 0,
        expired_count: 0,
        expired_value: 0,
        rejected_count: 0,
        rejected_value: 0,
        pending_count: 0,
        in_negotiation_count: 0,
        win_rate: 0,
        avg_discount_percent: 0,
      });
    }

    const rep = repMap.get(repId);
    const gTotal = Number(q.grand_total) || 0;
    const disc = Number(q.total_discount) || 0;
    const st = q.status;

    rep.total_quotations += 1;
    rep.total_quoted_value += gTotal;
    rep.total_discount_value += disc;
    rep.total_gross_value += gTotal + disc;

    if (st === 'accepted') {
      rep.won_count += 1;
      rep.won_value += gTotal;
    } else if (st === 'converted') {
      rep.won_count += 1;
      rep.won_value += gTotal;
      rep.converted_count += 1;
      rep.converted_value += gTotal;
    } else if (st === 'expired') {
      rep.expired_count += 1;
      rep.expired_value += gTotal;
    } else if (st === 'rejected') {
      rep.rejected_count += 1;
      rep.rejected_value += gTotal;
    } else if (st === 'in_negotiation' || st === 'sent' || st === 'approved') {
      rep.in_negotiation_count += 1;
    } else if (st === 'pending_approval' || q.approval_status === 'pending_approval') {
      rep.pending_count += 1;
    }
  }

  const performanceList = Array.from(repMap.values()).map((rep) => {
    const decided = rep.won_count + rep.rejected_count + rep.expired_count;
    rep.win_rate = decided > 0 ? Math.round((rep.won_count / decided) * 1000) / 10 : 0;
    rep.avg_discount_percent = rep.total_gross_value > 0
      ? Math.round((rep.total_discount_value / rep.total_gross_value) * 1000) / 10
      : 0;
    return rep;
  });

  // Sort by Won Value descending, then total quoted value
  performanceList.sort((a, b) => b.won_value - a.won_value || b.total_quoted_value - a.total_quoted_value);

  return performanceList;
}

/**
 * 3. Monthly / Periodic Performance & Trend Breakdown
 */
async function getQuotationMonthlyTrends(query = {}, user) {
  const { LeadQuotation } = getModels();
  const filter = await buildReportFilter(query, user);

  const quotes = await LeadQuotation.find(filter)
    .select('quotation_date createdAt status grand_total total_discount')
    .sort({ quotation_date: 1, createdAt: 1 })
    .lean();

  const monthMap = new Map();

  for (const q of quotes) {
    const d = q.quotation_date ? new Date(q.quotation_date) : q.createdAt ? new Date(q.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    if (!monthMap.has(key)) {
      monthMap.set(key, {
        period_key: key,
        period_label: label,
        total_quotations: 0,
        total_quoted_value: 0,
        won_count: 0,
        won_value: 0,
        converted_count: 0,
        converted_value: 0,
        expired_count: 0,
        expired_value: 0,
        rejected_count: 0,
      });
    }

    const m = monthMap.get(key);
    const gTotal = Number(q.grand_total) || 0;
    const st = q.status;

    m.total_quotations += 1;
    m.total_quoted_value += gTotal;

    if (st === 'accepted' || st === 'converted') {
      m.won_count += 1;
      m.won_value += gTotal;
      if (st === 'converted') {
        m.converted_count += 1;
        m.converted_value += gTotal;
      }
    } else if (st === 'expired') {
      m.expired_count += 1;
      m.expired_value += gTotal;
    } else if (st === 'rejected') {
      m.rejected_count += 1;
    }
  }

  return Array.from(monthMap.values()).sort((a, b) => a.period_key.localeCompare(b.period_key));
}

/**
 * 4. Top Quoted Products & Revenue Potential Breakdown
 */
async function getQuotationProductBreakdown(query = {}, user) {
  const { LeadQuotation } = getModels();
  const filter = await buildReportFilter(query, user);

  const quotes = await LeadQuotation.find(filter)
    .select('items status quotation_date grand_total')
    .lean();

  const productMap = new Map();

  for (const q of quotes) {
    const isWon = q.status === 'accepted' || q.status === 'converted';
    const isConverted = q.status === 'converted';

    if (Array.isArray(q.items)) {
      for (const item of q.items) {
        const pName = (item.product_name || 'Standard Item').trim();
        const qty = Number(item.quantity) || 1;
        const rate = Number(item.rate) || 0;
        const lineTotal = Number(item.line_total || item.taxable_amount || (rate * qty)) || 0;
        const discAmt = Number(item.discount_amount) || 0;

        if (!productMap.has(pName)) {
          productMap.set(pName, {
            product_name: pName,
            hsn_code: item.hsn_code || '',
            unit: item.unit || 'Nos',
            times_quoted: 0,
            total_quantity: 0,
            total_quoted_value: 0,
            total_base_rate_value: 0,
            total_discount_value: 0,
            won_quantity: 0,
            won_value: 0,
            converted_quantity: 0,
            converted_value: 0,
          });
        }

        const p = productMap.get(pName);
        p.times_quoted += 1;
        p.total_quantity += qty;
        p.total_quoted_value += lineTotal;
        p.total_base_rate_value += rate * qty;
        p.total_discount_value += discAmt;

        if (isWon) {
          p.won_quantity += qty;
          p.won_value += lineTotal;
        }
        if (isConverted) {
          p.converted_quantity += qty;
          p.converted_value += lineTotal;
        }
      }
    }
  }

  const productList = Array.from(productMap.values()).map((p) => {
    p.avg_unit_price = p.total_quantity > 0 ? Math.round(p.total_base_rate_value / p.total_quantity) : 0;
    delete p.total_base_rate_value;
    return p;
  });

  // Sort by Total Quoted Value descending
  productList.sort((a, b) => b.total_quoted_value - a.total_quoted_value);

  return productList.slice(0, 50); // Top 50 products
}

/**
 * 5. Commercial Pipeline Stage Conversion Funnel
 */
async function getQuotationConversionFunnel(query = {}, user) {
  const summary = await getQuotationSummaryReport(query, user);
  const total = summary.total_quotations || 0;
  const sb = summary.status_breakdown || {};

  const created = total;
  const approved = created - (sb.draft?.count || 0) - (sb.pending_approval?.count || 0);
  const won = summary.won_deals?.count || 0;
  const converted = summary.converted_orders?.count || 0;
  const engaged = (sb.approved?.count || 0) + (sb.sent?.count || 0) + (sb.in_negotiation?.count || 0) + won;

  const funnelStages = [
    {
      stage: 'Created Proposals',
      key: 'created',
      count: created,
      value: summary.total_net_value,
      percentage: 100,
      description: 'All generated commercial proposals',
    },
    {
      stage: 'Signatory Approved',
      key: 'approved',
      count: Math.max(0, approved),
      value: Math.max(0, summary.total_net_value - (sb.draft?.value || 0) - (sb.pending_approval?.value || 0)),
      percentage: created > 0 ? Math.round((Math.max(0, approved) / created) * 1000) / 10 : 0,
      description: 'Passed internal financial & signatory authorization',
    },
    {
      stage: 'Active Engagement',
      key: 'engaged',
      count: Math.max(0, engaged),
      value: (sb.approved?.value || 0) + (sb.sent?.value || 0) + (sb.in_negotiation?.value || 0) + summary.won_deals.value,
      percentage: created > 0 ? Math.round((Math.max(0, engaged) / created) * 1000) / 10 : 0,
      description: 'In active customer negotiation and pricing review',
    },
    {
      stage: 'Client Accepted (Won)',
      key: 'won',
      count: won,
      value: summary.won_deals.value,
      percentage: created > 0 ? Math.round((won / created) * 1000) / 10 : 0,
      description: 'Customer approved pricing terms and confirmed intent',
    },
    {
      stage: 'Order Converted',
      key: 'converted',
      count: converted,
      value: summary.converted_orders.value,
      percentage: created > 0 ? Math.round((converted / created) * 1000) / 10 : 0,
      description: 'Formally transitioned into a fulfillment Order',
    },
  ];

  return {
    funnel: funnelStages,
    drop_offs: {
      expired: {
        count: sb.expired?.count || 0,
        value: sb.expired?.value || 0,
      },
      rejected: {
        count: sb.rejected?.count || 0,
        value: sb.rejected?.value || 0,
      },
      on_hold: {
        count: sb.on_hold?.count || 0,
        value: sb.on_hold?.value || 0,
      },
    },
  };
}

module.exports = {
  getQuotationSummaryReport,
  getQuotationSalesPerformance,
  getQuotationMonthlyTrends,
  getQuotationProductBreakdown,
  getQuotationConversionFunnel,
};
