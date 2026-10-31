/**
 * @fileoverview Request-scoped audit context (IP / user-agent) via AsyncLocalStorage.
 * @module middlewares/auditContext.middleware
 */
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || undefined;
}

function auditContextMiddleware(req, res, next) {
  storage.run(
    {
      ip_address: clientIp(req),
      user_agent: req.headers?.['user-agent'] || undefined,
    },
    next
  );
}

function getAuditContext() {
  return storage.getStore() || {};
}

module.exports = {
  auditContextMiddleware,
  getAuditContext,
};
