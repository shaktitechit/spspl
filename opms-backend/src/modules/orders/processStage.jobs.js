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

  try {
    await processStageQueue.enqueue({ orderId: oid, source });
  } catch (err) {
    logger.warn?.(
      `[processStage] queue unavailable (${source}), refreshing inline for order ${oid}: ${err.message}`,
    );
    await refreshOrderProcessStage(oid);
  }
}

module.exports = {
  scheduleProcessStageRefresh,
};
