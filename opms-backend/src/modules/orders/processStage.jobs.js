/**
 * Schedule async Order.process_stage refresh (BullMQ). Falls back to inline refresh if Redis is down.
 * @module modules/orders/processStage.jobs
 */
const { logger } = require('../../config/logger');
const processStageQueue = require('../../queues/processStage.queue');
const { refreshOrderProcessStage } = require('./orderListPage.service');

/**
 * @param {unknown} orderId
 * @param {string} [source] — caller label for logs (e.g. admin_approve, due_sheet_upload)
 */
async function scheduleProcessStageRefresh(orderId, source = 'workflow') {
  const oid = orderId != null ? String(orderId) : '';
  if (!oid) return;

  // Always refresh inline immediately so live API queries have zero delay
  try {
    const { refreshOrderProcessStage } = require('./orderListPage.service');
    await refreshOrderProcessStage(oid);
  } catch (inlineErr) {
    logger.warn?.(
      `[processStage] inline refresh failed for order ${oid}: ${inlineErr.message}`,
    );
  }

  try {
    await processStageQueue.enqueue({ orderId: oid, source });
  } catch (err) {
    // Redis down is fine since inline refresh already ran
  }
}

module.exports = {
  scheduleProcessStageRefresh,
};
