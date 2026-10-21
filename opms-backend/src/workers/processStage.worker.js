/**
 * @fileoverview Recomputes Order.process_stage after workflow / approval / dispatch changes.
 * @module workers/processStage.worker
 */
const { Worker } = require('bullmq');
const connection = require('../config/redis');
const { logger } = require('../config/logger');

function start() {
  const worker = new Worker(
    'processStage',
    async (job) => {
      const { orderId, source } = job.data || {};
      if (!orderId) throw new Error('processStage job requires orderId');

      const { refreshOrderProcessStage } = require('../modules/orders/orderListPage.service');
      const stage = await refreshOrderProcessStage(orderId);

      logger.info(
        `[ProcessStage Worker] order=${orderId} stage=${stage ?? 'null'} source=${source || 'unknown'}`,
      );
      return { orderId, stage, source };
    },
    {
      connection,
      concurrency: 5,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      `[ProcessStage Worker] Job ${job ? job.id : 'unknown'} failed: ${err.message}`,
    );
  });

  return worker;
}

module.exports = { start };
