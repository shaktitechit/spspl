/**
 * @fileoverview Notification helper for work-planner-backend.
 * Writes the in-app row through notification-service so device push is sent,
 * and falls back to the local collection when that service is unreachable.
 * @module modules/notifications/notification.service
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { NOTIFICATION_SERVICE_URL, JWT_SECRET } = require('../../config/env');

function asUserId(userId) {
  if (!userId) return '';
  if (typeof userId === 'object') return String(userId._id || userId.id || '');
  return String(userId);
}

async function publish(userId, payload) {
  if (!NOTIFICATION_SERVICE_URL || !JWT_SECRET) return null;
  const token = jwt.sign(
    { sub: 'work-planner-service', name: 'Work Planner' },
    JWT_SECRET,
    { expiresIn: '5m' }
  );
  const response = await axios.post(
    `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`,
    { userId, payload },
    {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 8000,
    }
  );
  return response.data?.data || null;
}

async function createForUser(userId, payload) {
  const id = asUserId(userId);
  if (!id) return null;
  try {
    const published = await publish(id, payload);
    if (published) return published;
  } catch (err) {
    console.warn('[work-planner notification] publish failed:', err?.message || err);
  }
  try {
    const { Notification } = getModels();
    const row = await Notification.create({
      user: id,
      title: payload.title,
      message: payload.message,
      type: payload.type || 'info',
      module: payload.module || 'work_planner',
      entity_type: payload.entity_type,
      entity_id: payload.entity_id || undefined,
      is_read: false,
    });
    return toPlain(row.toObject());
  } catch (err) {
    console.warn('[work-planner notification] createForUser failed:', err?.message || err);
    return null;
  }
}

async function listForUser(userId, { unreadOnly } = {}) {
  try {
    const { Notification } = getModels();
    const q = { user: asUserId(userId) };
    if (unreadOnly) q.is_read = false;
    const rows = await Notification.find(q).sort({ createdAt: -1 }).lean();
    return rows.map((r) => toPlain(r));
  } catch (err) {
    return [];
  }
}

async function markRead(userId, id) {
  try {
    const { Notification } = getModels();
    const row = await Notification.findOneAndUpdate(
      { _id: id, user: asUserId(userId) },
      { is_read: true, read_at: new Date() },
      { new: true }
    ).lean();
    return row ? toPlain(row) : null;
  } catch (err) {
    return null;
  }
}

module.exports = {
  createForUser,
  listForUser,
  markRead,
};
