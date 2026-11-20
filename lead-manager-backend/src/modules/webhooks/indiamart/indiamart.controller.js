/**
 * @fileoverview Express Controller for IndiaMART Push Webhook API.
 * @module modules/webhooks/indiamart/indiamart.controller
 */
const service = require('./indiamart.service');
const { logger } = require('../../../utils/logger');

/**
 * Ingestion handler for IndiaMART Push API POST requests.
 */
async function handlePush(req, res) {
  try {
    const secretToken =
      req.params.token ||
      req.query.token ||
      req.headers['x-webhook-token'] ||
      req.headers['x-api-key'] ||
      '';

    const clientIp =
      req.headers['x-forwarded-for'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip ||
      '';

    const result = await service.processWebhook({
      payload: req.body,
      headers: req.headers,
      ipAddress: Array.isArray(clientIp) ? clientIp[0] : String(clientIp).split(',')[0].trim(),
      secretToken,
    });

    return res.status(result.httpStatus).json(result.response);
  } catch (err) {
    logger.error('[IndiaMart Webhook] Unexpected error handling push lead:', err);
    return res.status(500).json({
      CODE: 500,
      STATUS: 'FAILED',
      MESSAGE: 'Internal server error while processing IndiaMART lead push',
      ERROR: err.message,
    });
  }
}

/**
 * Health check endpoint to verify webhook listener readiness.
 */
function healthCheck(req, res) {
  return res.json({
    status: 'ok',
    service: 'indiamart-webhook-listener',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Administrative endpoint to view webhook delivery and troubleshooting logs.
 */
async function getLogs(req, res, next) {
  try {
    const { limit, page, status } = req.query;
    const result = await service.listWebhookLogs({ limit, page, status });
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
  handlePush,
  healthCheck,
  getLogs,
};
