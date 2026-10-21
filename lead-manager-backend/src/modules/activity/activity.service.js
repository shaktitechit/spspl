/**
 * @fileoverview Activity logging helper for lead-manager-backend.
 * @module modules/activity/activity.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { getAuditContext } = require('../../middlewares/auditContext.middleware');

async function create(entry) {
  try {
    const ctx = getAuditContext();
    const { ActivityLog } = getModels();
    const row = await ActivityLog.create({
      actor: entry.actor,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      action: entry.action,
      message: entry.message,
      old_value: entry.old_value,
      new_value: entry.new_value,
      ip_address: entry.ip_address || ctx.ip_address,
      user_agent: entry.user_agent || ctx.user_agent,
    });
    return toPlain(row.toObject());
  } catch (err) {
    console.warn('[lead-manager activity] create failed:', err?.message || err);
    return null;
  }
}

async function list({ entity_type, entity_id } = {}) {
  try {
    const { ActivityLog } = getModels();
    const q = {};
    if (entity_type) q.entity_type = entity_type;
    if (entity_id) q.entity_id = entity_id;
    const rows = await ActivityLog.find(q).sort({ createdAt: -1 }).lean();
    return rows.map((r) => toPlain(r));
  } catch (err) {
    return [];
  }
}

module.exports = { create, list };
