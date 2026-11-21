/**
 * @fileoverview Express Controller for IndiaMART Pull API Integration.
 * @module modules/integrations/indiamart/indiamartPull.controller
 */
const service = require('./indiamartPull.service');
const { logger } = require('../../../utils/logger');

/**
 * Triggers an on-demand manual pull from IndiaMART.
 */
async function triggerPull(req, res, next) {
  try {
    const actorId = req.user?._id || null;

    const result = await service.runLeadPull({
      triggerType: 'MANUAL',
      actorId,
    });

    if (!result.success) {
      const statusCode = result.status === 'RATE_LIMITED'
        ? 429
        : (result.http_code === 401 ? 401 : 400);

      return res.status(statusCode).json({
        success: false,
        message: result.message || 'IndiaMART sync failed',
        data: result,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (err) {
    logger.error('[IndiaMart Pull Controller] Trigger pull failed:', err);
    next(err);
  }
}

/**
 * Returns current status of IndiaMART Pull integration.
 */
async function getStatus(req, res, next) {
  try {
    const status = await service.getIntegrationStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Returns paginated logs of past Pull sync executions.
 */
async function getLogs(req, res, next) {
  try {
    const { page, limit, status } = req.query;
    const result = await service.listSyncLogs({ page, limit, status });
    return res.json({
      success: true,
      data: result.logs,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  triggerPull,
  getStatus,
  getLogs,
};
