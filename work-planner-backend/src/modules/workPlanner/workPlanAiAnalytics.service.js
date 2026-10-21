/**
 * @fileoverview OpenAI-Powered 360° Work Plan & Individual Caliber Intelligence Engine
 * Generates an in-depth 360° caliber assessment, a dedicated field visits report, and a dedicated task execution report.
 * @module modules/workPlanner/workPlanAiAnalytics.service
 */

const axios = require('axios');
const { getModels } = require('../../data/mongoRegistry');
const { OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL } = require('../../config/env');

/**
 * Generates a fallback evaluation using algorithmic heuristics if OpenAI is unavailable or API key is not configured.
 */
function generateFallbackAssessment(data) {
  const p = data.planMetrics;
  const v = data.visitMetrics;
  const t = data.taskMetrics;

  const planScore = Math.round(
    (p.planCompletionRate * 0.4) +
    (p.managerDiscussedRate * 0.3) +
    (p.dayEndTimelinessRate * 0.3)
  );

  const visitScore = v.totalVisits > 0
    ? Math.round((v.visitCompletionRate * 0.4) + (v.geoComplianceRate * 0.3) + (Math.min(100, v.newPartyRatio * 2) * 0.3))
    : 70;

  const taskScore = t.totalTasks > 0
    ? Math.round((t.taskCompletionRate * 0.6) + (Math.max(0, 100 - t.rolloverRate * 1.5) * 0.4))
    : 75;

  const overallScore = Math.round((planScore * 0.3) + (visitScore * 0.35) + (taskScore * 0.35));

  const getTier = (s) => {
    if (s >= 88) return 'Exceptional';
    if (s >= 75) return 'High Performer';
    if (s >= 60) return 'Consistent';
    if (s >= 45) return 'Needs Coaching';
    return 'At Risk';
  };

  const getArchetype = () => {
    if (v.totalVisits >= 5 && t.totalTasks >= 5 && Math.abs(visitScore - taskScore) <= 15) {
      return 'Balanced Commercial Operator';
    }
    if (visitScore > taskScore + 15) {
      return 'High-Field Hunter (Needs Desk Follow-up)';
    }
    if (taskScore > visitScore + 15) {
      return 'Desk Specialist (Needs Field Expansion)';
    }
    return 'Emerging Operator';
  };

  return {
    overallCaliberReport: {
      score: overallScore,
      tier: getTier(overallScore),
      executiveSummary: `${data.executive.name} has maintained an overall work plan execution score of ${overallScore}/100 over the evaluated ${data.period.daysCovered} days (${data.period.from} to ${data.period.to}). Demonstrates ${p.planCompletionRate}% plan completion rate with ${p.managerDiscussedRate}% pre-planning manager alignment.`,
      dimensionRatings: {
        planningRigor: Math.min(10, Math.max(1, Math.round(p.planCompletionRate / 10))),
        executionDiscipline: Math.min(10, Math.max(1, Math.round(visitScore / 10))),
        clientEngagement: Math.min(10, Math.max(1, Math.round((v.visitCompletionRate + v.newPartyRatio) / 20))),
        taskVelocity: Math.min(10, Math.max(1, Math.round(taskScore / 10))),
        reportingTransparency: Math.min(10, Math.max(1, Math.round(p.dayEndTimelinessRate / 10))),
        seniorCoachability: p.authorityRemarksCount > 0 ? 8 : 7,
      },
      coreStrengths: [
        `Achieved ${p.planCompletionRate}% completion rate across scheduled work plans.`,
        v.totalVisits > 0 ? `Successfully conducted ${v.completedVisits} client meetings with ${v.geoComplianceRate}% GPS compliance.` : 'Consistently logged daily activities.',
        t.totalTasks > 0 ? `Resolved ${t.completedTasks} tasks with a rollover control rate of ${Math.max(0, 100 - t.rolloverRate)}%.` : 'Maintains daily task routine.',
      ],
      criticalBlindSpots: [
        p.managerDiscussedRate < 80 ? 'Pre-planning alignment with reporting manager can be made more proactive.' : 'Ensure day-end report narratives capture rich strategic details.',
        t.rolloverRate > 20 ? `Task rollover rate stands at ${t.rolloverRate}%, indicating carry-over backlog.` : 'Increase new account prospecting ratio.',
      ],
      growthTrajectory: overallScore >= 75 ? 'Accelerating towards leadership and strategic account ownership.' : 'Steady operational growth with room for proactive commercial drive.',
    },
    visitsReport: {
      score: visitScore,
      tier: visitScore >= 80 ? 'Top Rainmaker' : visitScore >= 65 ? 'Steady Representative' : 'Needs Focus',
      commercialAcumenSummary: `Executed ${v.completedVisits} of ${v.totalVisits} planned visits. New prospect acquisition represents ${v.newPartyRatio}% of total field engagements.`,
      pipelineDynamicsAnalysis: `Active field balance: ${v.newPartiesCount} new prospects vs ${v.existingPartiesCount} existing clients serviced.`,
      geoDisciplineCritique: `GPS check-in compliance is ${v.geoComplianceRate}%, with an estimated average on-site meeting duration of ${v.avgDurationMinutes} minutes.`,
      meetingOutcomesCritique: `Logged ${v.meetingOutcomes.order_received} orders received and ${v.meetingOutcomes.new_product_introduced} new product introductions.`,
      keyStrengths: [
        `Maintained ${v.visitCompletionRate}% visit follow-through.`,
        `Engaged with ${v.newPartiesCount} new accounts.`,
      ],
      areasForImprovement: [
        'Ensure check-in and check-out timestamps are consistently captured on site.',
        'Deepen meeting outcome documentation to capture next follow-up milestones.',
      ],
    },
    tasksReport: {
      score: taskScore,
      tier: taskScore >= 80 ? 'Velocity Master' : taskScore >= 65 ? 'Reliable Executor' : 'Operational Bottleneck',
      operationalVelocitySummary: `Completed ${t.completedTasks} of ${t.totalTasks} scheduled operational tasks (${t.taskCompletionRate}% completion rate).`,
      throughputCritique: `Managed ${t.adHocTasksCount} strategic ad-hoc tasks alongside ${t.templateTasksCount} recurring template duties.`,
      rolloverDiagnosis: t.rolloverRate > 0 ? `${t.rolloverTasksCount} tasks (${t.rolloverRate}%) experienced multi-day rollovers before resolution.` : 'Zero task rollover backlog detected.',
      initiativeVsRoutineCritique: `Proactive/ad-hoc tasks account for ${t.totalTasks > 0 ? Math.round((t.adHocTasksCount / t.totalTasks) * 100) : 0}% of total workload.`,
      keyStrengths: [
        `Maintained ${t.taskCompletionRate}% operational completion.`,
        `Balanced core template tasks with ad-hoc field requirements.`,
      ],
      areasForImprovement: [
        'Reduce task rollover by breaking down complex tasks into smaller sub-milestones.',
        'Enhance completion remarks to specify concrete outputs delivered.',
      ],
    },
    crossTrackSynergy: {
      balanceIndex: Math.round(100 - Math.abs(visitScore - taskScore)),
      archetype: getArchetype(),
      synergyVerdict: `${data.executive.name} demonstrates a balanced balance index of ${Math.round(100 - Math.abs(visitScore - taskScore))}/100 between customer-facing meetings and backend task execution.`,
    },
    managerCoachingPlaybook: {
      confidentialDirectives: [
        `Conduct a weekly 15-minute alignment check to review upcoming pipeline and pending task backlog.`,
        `Encourage deeper contact person documentation (capturing phone and email for key decision makers).`,
        `Acknowledge punctuality and provide specific coaching on new account conversions.`,
      ],
      thirtyDayMilestones: [
        `Maintain a 90%+ work plan completion rate.`,
        `Keep task rollover rate below 15%.`,
        `Achieve at least 30% new client representation in weekly field plans.`,
      ],
      suggestedCadence: 'Weekly 1-on-1 performance review with bi-weekly field ride-alongs.',
    },
    executiveActionPlan: {
      primaryGoals: [
        `Consistently submit daily Day-End reports prior to 9:00 PM.`,
        `Complete all scheduled client visits with GPS check-in/out verification.`,
        `Resolve rolled-over tasks within 24 hours of postponement.`,
      ],
      dailyHabits: [
        `Review scheduled visits at 9:00 AM and confirm pre-meeting objectives.`,
        `Capture contact details and meeting outcomes immediately upon exiting meetings.`,
      ],
      weeklyCheckpoints: [
        `Friday evening review of task rollover rate and planning for the upcoming week.`,
      ],
    },
    isAiGenerated: false,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Main AI Evaluation Function using OpenAI Chat Completions API with structured JSON output.
 */
async function generateAiCaliberAnalysis(harvestedData) {
  if (!OPENAI_API_KEY || OPENAI_API_KEY.trim().length < 10) {
    console.warn('[WorkPlanAi] OPENAI_API_KEY is not configured in environment. Using data-driven algorithmic assessment.');
    return generateFallbackAssessment(harvestedData);
  }

  const systemPrompt = `You are an elite Chief Operating Officer & Executive Talent Assessment Auditor analyzing an employee's professional caliber based on their Work Planner records.
Your evaluation MUST go beyond surface numbers and thoroughly analyze:
1. TASK HEADS & DESCRIPTIONS: Evaluate task title clarity, complexity of planned work, executive completion remarks (whether results are concrete or vague), and reasons cited for task rollovers/delays.
2. VISIT HEADS, PURPOSES & OUTCOMES: Evaluate client name and type, planned agendas, decision-maker seniority (doctors, purchase managers, engineers), on-site meeting outcomes, and commercial follow-up commitments.
3. SENIOR AUTHORITY REMARKS & COACHABILITY: Scrutinize how the executive interacts with and acts upon feedback, corrective directives, and remarks given by Reporting Managers and Portal Admins across plans, visits, and tasks.
4. COMPLETE WORK PLAN INTEGRITY: Assess daily planning intent remarks, manager pre-discussion rigor, and narrative depth in Day-End submissions.

You MUST respond strictly with valid JSON conforming to the following structure:
{
  "overallCaliberReport": {
    "score": <number 0-100>,
    "tier": <"Exceptional" | "High Performer" | "Consistent" | "Needs Coaching" | "At Risk">,
    "executiveSummary": <string, 3-4 deep analytical sentences evaluating qualitative task execution, visit outcomes, and senior alignment>,
    "dimensionRatings": {
      "planningRigor": <number 1-10>,
      "executionDiscipline": <number 1-10>,
      "clientEngagement": <number 1-10>,
      "taskVelocity": <number 1-10>,
      "reportingTransparency": <number 1-10>,
      "seniorCoachability": <number 1-10>
    },
    "coreStrengths": [<string>, <string>, <string>],
    "criticalBlindSpots": [<string>, <string>],
    "growthTrajectory": <string>
  },
  "visitsReport": {
    "score": <number 0-100>,
    "tier": <"Top Rainmaker" | "Strong Field Driver" | "Steady Representative" | "Inconsistent Field Presence" | "Critical Focus Needed">,
    "commercialAcumenSummary": <string>,
    "pipelineDynamicsAnalysis": <string, analyzing new prospect hunting vs existing account farming based on visit logs>,
    "geoDisciplineCritique": <string, analyzing GPS check-in accuracy, time investment, and location fidelity>,
    "meetingOutcomesCritique": <string, evaluating quality of recorded meeting outcomes, decision-maker meetings, and senior visit remarks>,
    "keyStrengths": [<string>, <string>],
    "areasForImprovement": [<string>, <string>]
  },
  "tasksReport": {
    "score": <number 0-100>,
    "tier": <"Velocity Master" | "High Throughput" | "Reliable Executor" | "Prone to Rollovers" | "Operational Bottleneck">,
    "operationalVelocitySummary": <string>,
    "throughputCritique": <string, analyzing task heads, descriptions, and completion remarks>,
    "rolloverDiagnosis": <string, diagnosing specific task heads prone to delays, pending remarks, and carry-over bottlenecks>,
    "initiativeVsRoutineCritique": <string, analyzing proactive ad-hoc initiatives vs routine template duties>,
    "keyStrengths": [<string>, <string>],
    "areasForImprovement": [<string>, <string>]
  },
  "crossTrackSynergy": {
    "balanceIndex": <number 0-100>,
    "archetype": <"Balanced Commercial Operator" | "High-Field Hunter (Needs Desk Follow-up)" | "Desk Specialist (Needs Field Expansion)" | "Emerging Operator">,
    "synergyVerdict": <string>
  },
  "managerCoachingPlaybook": {
    "confidentialDirectives": [<string>, <string>, <string>],
    "thirtyDayMilestones": [<string>, <string>, <string>],
    "suggestedCadence": <string>
  },
  "executiveActionPlan": {
    "primaryGoals": [<string>, <string>, <string>],
    "dailyHabits": [<string>, <string>],
    "weeklyCheckpoints": [<string>]
  }
}`;

  const userPrompt = `Analyze the complete Work Planner performance record for:
Employee: ${harvestedData.executive.name} (${harvestedData.executive.department})
Period: ${harvestedData.period.from} to ${harvestedData.period.to} (${harvestedData.period.daysCovered} days)

==================================================
1. QUANTITATIVE BENCHMARKS
==================================================
Plan Metrics: ${JSON.stringify(harvestedData.planMetrics, null, 2)}
Visit Metrics: ${JSON.stringify(harvestedData.visitMetrics, null, 2)}
Task Metrics: ${JSON.stringify(harvestedData.taskMetrics, null, 2)}

==================================================
2. SENIOR AUTHORITY DIRECTIVES & MANAGER REMARKS
==================================================
${JSON.stringify(harvestedData.qualitativeRecords?.seniorDirectives || harvestedData.holisticContext?.seniorDirectives || [], null, 2)}

==================================================
3. DETAILED WORK PLANS & DAY-END SUBMISSIONS
==================================================
${JSON.stringify(harvestedData.qualitativeRecords?.workPlans || [], null, 2)}

==================================================
4. DETAILED FIELD VISITS LOG (Heads, Purposes, Outcomes, Check-in Locations & Remarks)
==================================================
${JSON.stringify(harvestedData.qualitativeRecords?.visits || harvestedData.visitMetrics?.sampleVisits || [], null, 2)}

==================================================
5. DETAILED WORK TASKS LOG (Heads, Descriptions, Completion Remarks & Rollover Reasons)
==================================================
${JSON.stringify(harvestedData.qualitativeRecords?.tasks || harvestedData.taskMetrics?.sampleTasks || [], null, 2)}

Please deliver a rigorous, qualitative, and actionable 360° caliber assessment in JSON format.`;

  try {
    const response = await axios.post(
      `${OPENAI_BASE_URL}/chat/completions`,
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 3500,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const rawContent = response.data?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('Empty response from OpenAI');

    const parsedJson = JSON.parse(rawContent);
    return {
      ...parsedJson,
      isAiGenerated: true,
      aiModel: OPENAI_MODEL,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[WorkPlanAi] OpenAI API error:', err?.response?.data || err.message);
    console.warn('[WorkPlanAi] Falling back to algorithmic 360° assessment.');
    return generateFallbackAssessment(harvestedData);
  }
}

/**
 * Retrieves cached analysis or runs fresh harvest & AI assessment.
 */
async function getOrGenerateCaliberAnalysis(targetUserId, fromDate, toDate, planId = null, forceRegenerate = false, actingUser = null) {
  const { WorkPlanAnalyticsCache } = getModels();

  const userOid = new (require('mongoose').Types.ObjectId)(String(targetUserId));
  const planOid = planId ? new (require('mongoose').Types.ObjectId)(String(planId)) : null;

  const fromStr = fromDate || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const toStr = toDate || new Date().toISOString().slice(0, 10);
  const scopeKey = planId ? `plan_${planId}` : `range_${fromStr}_${toStr}`;

  if (!forceRegenerate) {
    const cached = await WorkPlanAnalyticsCache.findOne({
      sales_user: userOid,
      scope_key: scopeKey,
    }).lean();

    if (cached && cached.ai_assessment) {
      return {
        executive: cached.metrics_snapshot.executive,
        period: cached.metrics_snapshot.period,
        planMetrics: cached.metrics_snapshot.planMetrics,
        visitMetrics: cached.metrics_snapshot.visitMetrics,
        taskMetrics: cached.metrics_snapshot.taskMetrics,
        assessment: cached.ai_assessment,
        cachedAt: cached.updatedAt || cached.createdAt,
        isCached: true,
      };
    }
  }

  // Harvest raw metrics
  const { harvestIndividualPlanData } = require('./workPlanAnalytics.service');
  const harvested = await harvestIndividualPlanData(targetUserId, fromStr, toStr, planId);

  // Generate AI analysis
  const aiResult = await generateAiCaliberAnalysis(harvested);

  // Upsert into cache (expires in 24 hours)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await WorkPlanAnalyticsCache.findOneAndUpdate(
    { sales_user: userOid, scope_key: scopeKey },
    {
      sales_user: userOid,
      plan_id: planOid,
      from_date: new Date(fromStr),
      to_date: new Date(toStr),
      scope_key: scopeKey,
      metrics_snapshot: {
        executive: harvested.executive,
        period: harvested.period,
        planMetrics: harvested.planMetrics,
        visitMetrics: harvested.visitMetrics,
        taskMetrics: harvested.taskMetrics,
      },
      ai_assessment: aiResult,
      generated_by: actingUser?._id || actingUser?.id || userOid,
      expires_at: expiresAt,
    },
    { upsert: true, new: true }
  );

  return {
    executive: harvested.executive,
    period: harvested.period,
    planMetrics: harvested.planMetrics,
    visitMetrics: harvested.visitMetrics,
    taskMetrics: harvested.taskMetrics,
    assessment: aiResult,
    cachedAt: new Date().toISOString(),
    isCached: false,
  };
}

module.exports = {
  generateAiCaliberAnalysis,
  getOrGenerateCaliberAnalysis,
};
