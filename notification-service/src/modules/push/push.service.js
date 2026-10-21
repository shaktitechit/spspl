/**
 * @fileoverview Web Push: store subscriptions and send via web-push.
 * @module modules/push/push.service
 */
const axios = require('axios');
const webpush = require('web-push');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
} = require('../../config/env');

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:noreply@localhost',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
  return true;
}

function getVapidPublicKey() {
  if (!VAPID_PUBLIC_KEY) {
    throw new ApiError(503, 'Web Push is not configured (missing VAPID_PUBLIC_KEY)');
  }
  return VAPID_PUBLIC_KEY;
}

function normalizeSubscription(body) {
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = body?.keys?.p256dh ?? body?.p256dh;
  const auth = body?.keys?.auth ?? body?.auth;
  if (!endpoint || !p256dh || !auth) {
    throw new ApiError(400, 'Invalid push subscription: endpoint, keys.p256dh, and keys.auth are required');
  }
  return {
    endpoint,
    expirationTime: body.expirationTime ?? null,
    keys: {
      p256dh: String(p256dh),
      auth: String(auth),
    },
  };
}

/**
 * Upsert a browser push subscription for the authenticated user.
 * @param {string} userId
 * @param {object} body - PushSubscription JSON from the browser
 * @param {string} [userAgent]
 */
async function subscribe(userId, body, userAgent) {
  const { PushSubscription } = getModels();
  const sub = normalizeSubscription(body);

  const row = await PushSubscription.findOneAndUpdate(
    { endpoint: sub.endpoint },
    {
      user: userId,
      endpoint: sub.endpoint,
      expirationTime: sub.expirationTime,
      keys: sub.keys,
      userAgent: userAgent || undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return toPlain(row);
}

/**
 * Remove a push subscription (current user's endpoint only).
 * @param {string} userId
 * @param {string} endpoint
 */
async function unsubscribe(userId, endpoint) {
  const { PushSubscription } = getModels();
  const ep = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!ep) throw new ApiError(400, 'endpoint is required');

  const result = await PushSubscription.deleteOne({ user: userId, endpoint: ep });
  return { deleted: result.deletedCount > 0 };
}

/**
 * Send a web-push notification to all subscriptions for a user.
 * No-ops when VAPID is not configured or the user has no subscriptions.
 * Gone/expired subscriptions (410/404) are removed automatically.
 *
 * @param {string} userId
 * @param {{ title: string, body?: string, data?: object, url?: string }} payload
 */
async function sendToUser(userId, payload) {
  if (!ensureVapidConfigured()) {
    return { sent: 0, skipped: true, reason: 'vapid_not_configured' };
  }

  const { PushSubscription } = getModels();
  const rows = await PushSubscription.find({ user: userId }).lean();
  if (!rows.length) {
    return { sent: 0, failed: 0 };
  }

  const title = payload.title || process.env.COMPANY_NAME || 'Notification';
  const body = payload.body || payload.message || '';
  const data = {
    ...(payload.data || {}),
    url: payload.url || payload.data?.url || '/',
  };

  const notificationPayload = JSON.stringify({
    title,
    body,
    data,
  });

  let sent = 0;
  let failed = 0;
  const staleEndpoints = [];

  await Promise.all(
    rows.map(async (row) => {
      const subscription = {
        endpoint: row.endpoint,
        expirationTime: row.expirationTime ?? undefined,
        keys: {
          p256dh: row.keys.p256dh,
          auth: row.keys.auth,
        },
      };
      try {
        await webpush.sendNotification(subscription, notificationPayload, {
          TTL: 60 * 60,
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          staleEndpoints.push(row.endpoint);
        } else {
          console.warn('[push] sendNotification failed', {
            userId: String(userId),
            status,
            message: err?.message,
          });
        }
      }
    })
  );

  if (staleEndpoints.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: staleEndpoints } });
  }

  return { sent, failed, removed: staleEndpoints.length };
}

function isExpoPushToken(token) {
  return /^Expo(nent)?PushToken\[.+\]$/.test(token);
}

/**
 * Store the signed-in device's Expo push token.
 * The same token is moved if the user signs in on a device that belonged to someone else.
 */
async function registerDevice(userId, token, platform) {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!isExpoPushToken(value)) {
    throw new ApiError(400, 'A device push token is required');
  }
  const { DevicePushToken } = getModels();
  const row = await DevicePushToken.findOneAndUpdate(
    { token: value },
    { user: userId, token: value, platform: platform || '' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return toPlain(row);
}

async function unregisterDevice(userId, token) {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!value) throw new ApiError(400, 'token is required');
  const { DevicePushToken } = getModels();
  const result = await DevicePushToken.deleteOne({ user: userId, token: value });
  return { deleted: result.deletedCount > 0 };
}

/**
 * Deliver a native notification through Expo's push service.
 * Missing tokens are a no-op. Unregistered tokens are removed.
 */
async function sendExpoToUser(userId, payload) {
  const { DevicePushToken } = getModels();
  const rows = await DevicePushToken.find({ user: userId }).lean();
  if (!rows.length) return { sent: 0, failed: 0 };

  const messages = rows.map((row) => ({
    to: row.token,
    title: payload.title || 'Work plan',
    body: payload.body || payload.message || '',
    sound: 'default',
    priority: 'high',
    channelId: 'work-plans',
    data: payload.data || {},
  }));

  let sent = 0;
  let failed = 0;
  const stale = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const response = await axios.post('https://exp.host/--/api/v2/push/send', chunk, {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      validateStatus: () => true,
    });
    const tickets = Array.isArray(response.data?.data) ? response.data.data : [];
    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok') {
        sent += 1;
        return;
      }
      failed += 1;
      const error = ticket?.details?.error || ticket?.message;
      if (error === 'DeviceNotRegistered') stale.push(chunk[index].to);
    });
  }
  if (stale.length) {
    await DevicePushToken.deleteMany({ token: { $in: stale } });
  }
  return { sent, failed, removed: stale.length };
}

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  sendToUser,
  sendExpoToUser,
  registerDevice,
  unregisterDevice,
  ensureVapidConfigured,
};
