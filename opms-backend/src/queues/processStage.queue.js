/**
 * @fileoverview BullMQ queue for Order.process_stage refresh after workflow changes.
 * @module queues/processStage.queue
 */
const { Queue } = require('bullmq');
const connection = require('../config/redis');

const queueName = 'processStage';

const queue = new Queue(queueName, {
  connection,
});

/**
 * @param {{ orderId: string, source?: string }} payload
 */
async function enqueue(payload) {
  const orderId = payload?.orderId ? String(payload.orderId) : null;
  if (!orderId) return;

  try {
    await queue.add(
      'refresh',
      { orderId, source: payload.source || 'unknown' },
      {
        jobId: `refresh_process_stage__${orderId}__${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    );
  } catch (err) {
    const msg = String(err?.message || err);
    if (/Job.*already exists|duplicate/i.test(msg)) return;
    throw err;
  }
}

module.exports = {
  queueName,
  queue,
  enqueue,
};
