/**
 * @fileoverview Express Controller for 360° Work Plan Analytics & AI Caliber Assessment
 * @module modules/workPlanner/workPlanAnalytics.controller
 */

const { canAccessSalesUser, getVisibleSalesUserIds } = require('./teamVisibility.service');
const { getOrGenerateCaliberAnalysis } = require('./workPlanAiAnalytics.service');
const { harvestIndividualPlanData } = require('./workPlanAnalytics.service');
const { getModels } = require('../../data/mongoRegistry');
const { isWpAdmin, isWpElevated } = require('./workPlanner.constants');

function userId(user) {
  return user?._id || user?.id;
}

/**
 * GET /api/work-planner/analytics/caliber
 * Fetches or generates 360° Caliber assessment for an individual.
 */
async function getCaliberAnalytics(req, res) {
  try {
    const actor = req.user;
    const targetUserId = req.query.sales_user || req.query.user_id || String(userId(actor));

    // Security & Hierarchy check
    if (!(await canAccessSalesUser(actor, targetUserId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have authorization to view analytics for this team member',
      });
    }

    const fromDate = req.query.from;
    const toDate = req.query.to;
    const planId = req.query.plan_id || null;
    const force = req.query.force === 'true';

    const result = await getOrGenerateCaliberAnalysis(
      targetUserId,
      fromDate,
      toDate,
      planId,
      force,
      actor
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error fetching caliber analytics:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve 360° caliber analytics',
    });
  }
}

/**
 * POST /api/work-planner/analytics/caliber/regenerate
 * Forces on-demand AI recalculation and updates the cache.
 */
async function regenerateCaliberAnalytics(req, res) {
  try {
    const actor = req.user;
    const targetUserId = req.body.sales_user || req.body.user_id || String(userId(actor));

    if (!(await canAccessSalesUser(actor, targetUserId))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have authorization to regenerate analytics for this team member',
      });
    }

    const fromDate = req.body.from;
    const toDate = req.body.to;
    const planId = req.body.plan_id || null;

    const result = await getOrGenerateCaliberAnalysis(
      targetUserId,
      fromDate,
      toDate,
      planId,
      true, // force regeneration
      actor
    );

    return res.status(200).json({
      success: true,
      data: result,
      message: '360° AI Caliber Assessment recalculated and updated successfully',
    });
  } catch (err) {
    console.error('Error regenerating caliber analytics:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to regenerate AI caliber analytics',
    });
  }
}

/**
 * GET /api/work-planner/analytics/plan/:id/ai-analysis
 * Single Work Plan AI Analysis for Plan Detail Page.
 */
async function getSinglePlanAiAnalysis(req, res) {
  try {
    const actor = req.user;
    const planId = req.params.id;
    const { WorkPlan } = getModels();

    const plan = await WorkPlan.findById(planId).lean();
    if (!plan || plan.deletedAt) {
      return res.status(404).json({ success: false, message: 'Work plan not found' });
    }

    if (!(await canAccessSalesUser(actor, plan.sales_user))) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view analytics for this work plan',
      });
    }

    const force = req.query.force === 'true';
    const result = await getOrGenerateCaliberAnalysis(
      plan.sales_user,
      null,
      null,
      planId,
      force,
      actor
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('Error fetching single plan AI analysis:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to generate work plan AI analysis',
    });
  }
}

/**
 * GET /api/work-planner/analytics/team-overview
 * Returns team members' quantitative benchmark summaries for managers/admins.
 */
async function getTeamOverview(req, res) {
  try {
    const actor = req.user;
    const visibleIds = await getVisibleSalesUserIds(actor);
    const { User, WorkPlanAnalyticsCache } = getModels();

    let userQuery = { is_active: true };
    if (visibleIds !== null) {
      userQuery._id = { $in: visibleIds.map((id) => new (require('mongoose').Types.ObjectId)(id)) };
    }

    const users = await User.find(userQuery).select('name email department').lean();

    const fromDate = req.query.from;
    const toDate = req.query.to;

    // Harvest metrics for all visible members in parallel
    const summaries = await Promise.all(
      users.map(async (u) => {
        try {
          const harvested = await harvestIndividualPlanData(u._id, fromDate, toDate);
          
          // Check if cached AI score exists
          const cached = await WorkPlanAnalyticsCache.findOne({
            sales_user: u._id,
          }).sort({ createdAt: -1 }).lean();

          return {
            user: {
              _id: String(u._id),
              name: u.name,
              email: u.email,
              department: u.department,
            },
            planMetrics: {
              totalPlans: harvested.planMetrics.totalPlans,
              planCompletionRate: harvested.planMetrics.planCompletionRate,
              managerDiscussedRate: harvested.planMetrics.managerDiscussedRate,
              dayEndTimelinessRate: harvested.planMetrics.dayEndTimelinessRate,
            },
            visitMetrics: {
              totalVisits: harvested.visitMetrics.totalVisits,
              visitCompletionRate: harvested.visitMetrics.visitCompletionRate,
              newPartyRatio: harvested.visitMetrics.newPartyRatio,
              geoComplianceRate: harvested.visitMetrics.geoComplianceRate,
            },
            taskMetrics: {
              totalTasks: harvested.taskMetrics.totalTasks,
              taskCompletionRate: harvested.taskMetrics.taskCompletionRate,
              rolloverRate: harvested.taskMetrics.rolloverRate,
            },
            caliberScore: cached?.ai_assessment?.overallCaliberReport?.score || null,
            caliberTier: cached?.ai_assessment?.overallCaliberReport?.tier || null,
          };
        } catch (e) {
          return null;
        }
      })
    );

    return res.status(200).json({
      success: true,
      data: summaries.filter(Boolean),
    });
  } catch (err) {
    console.error('Error fetching team overview:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to retrieve team analytics overview',
    });
  }
}

module.exports = {
  getCaliberAnalytics,
  regenerateCaliberAnalytics,
  getSinglePlanAiAnalysis,
  getTeamOverview,
};
