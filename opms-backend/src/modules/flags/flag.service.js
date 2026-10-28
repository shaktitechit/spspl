/**
 * @fileoverview Flags: business rules, chat loop messaging, member resolution, and persistence helpers.
 * @module modules/flags/flag.service
 */
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');
const { hasOpmsAccess, getOpmsAccessRole, primaryOpmsRole } = require('../../middlewares/opmsAuth.middleware');
const { AUTH_SERVICE_URL, NOTIFICATION_SERVICE_URL, JWT_SECRET } = require('../../config/env');
const { uploadMulterFile, getFileMeta } = require('../../services/fileManagement/index');
const attachmentService = require('../attachments/attachment.service');
const flagNotificationService = require('./flagNotification.service');

const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

/**
 * Dispatch best-effort in-app notification to a user.
 */
async function sendFlagNotification(userId, payload) {
  if (!userId) return;
  try {
    const serviceToken = jwt.sign(
      { sub: 'backend-service', name: 'OPMS Backend' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    await axios.post(
      `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}/api/notifications/internal/create`,
      {
        userId: String(userId),
        payload: {
          title: payload.title || 'Flag Alert',
          message: payload.message || '',
          type: payload.type || 'flag_alert',
          module: 'flags',
          entity_type: payload.entity_type || 'flag',
          entity_id: payload.entity_id ? String(payload.entity_id) : undefined,
          link: payload.order_id ? `/order/${payload.order_id}` : undefined,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceToken}`,
        },
        timeout: 3000,
      }
    );
  } catch (err) {
    // Non-blocking notification failure
    console.warn(`[FlagService] In-app notification to ${userId} skipped:`, err.message);
  }
}

/**
 * Recomputes order aggregate fields based on active flags.
 * Flags with status 'open' or 'in_progress' are considered active.
 */
async function recomputeOrderFlagAggregates(orderId, session = null) {
  const { Order, OrderFlag } = getModels();

  const query = OrderFlag.find({ order: orderId });
  if (session) query.session(session);
  const flags = await query.lean();

  const active = flags.filter((f) => f.status === 'open' || f.status === 'in_progress');
  const blockingActive = active.filter((f) => f.blocks_order);

  let highest = 'none';
  for (const f of active) {
    const s = f.severity || 'medium';
    if (SEVERITY_RANK[s] > SEVERITY_RANK[highest]) highest = s;
  }

  const updateOptions = {};
  if (session) updateOptions.session = session;

  await Order.updateOne(
    { _id: orderId },
    {
      has_open_flags: blockingActive.length > 0,
      open_flag_count: active.length,
      highest_flag_severity: highest,
    },
    updateOptions
  );

  const getQuery = Order.findById(orderId);
  if (session) getQuery.session(session);
  const row = await getQuery.lean();
  return row ? toPlain(row) : null;
}

/**
 * Returns all active users who have OPMS portal access.
 */
async function listOpmsMembers(rawToken = null) {
  let users = [];
  try {
    const resp = await axios.get(`${AUTH_SERVICE_URL.replace(/\/$/, '')}/api/users`, {
      headers: rawToken ? { Authorization: `Bearer ${rawToken}` } : {},
      timeout: 4000,
    });
    const raw = resp.data;
    users = Array.isArray(raw) ? raw : (raw?.data || raw?.users || raw?.items || []);
  } catch (_err) {
    const { User } = getModels();
    if (User) {
      users = await User.find({ is_active: { $ne: false } }).lean();
    }
  }

  const opmsMembers = [];
  for (const u of users) {
    if (hasOpmsAccess(u)) {
      const role = getOpmsAccessRole(u);
      opmsMembers.push({
        _id: String(u._id || u.id),
        name: u.name || u.username || 'User',
        email: u.email || '',
        department: u.department || role || 'sales',
        opms_role: role || u.department || 'sales',
        is_active: u.is_active !== false,
      });
    }
  }
  return opmsMembers;
}

/**
 * List flags with flexible filters and populated references.
 */
async function list(query = {}, user = null) {
  const { OrderFlag } = getModels();
  const q = {};
  if (query.order) q.order = query.order;
  if (query.status) {
    if (query.status === 'active' || query.status === 'unresolved') {
      q.status = { $in: ['open', 'in_progress'] };
    } else if (query.status === 'resolved') {
      q.status = { $in: ['resolved', 'dismissed'] };
    } else {
      q.status = query.status;
    }
  }
  if (query.assigned_to) {
    if (query.assigned_to === 'me' && user) {
      q.$or = [{ assigned_to: user._id }, { tagged_members: user._id }];
    } else {
      q.assigned_to = query.assigned_to;
    }
  }
  if (query.raised_by) {
    if (query.raised_by === 'me' && user) {
      q.raised_by = user._id;
    } else {
      q.raised_by = query.raised_by;
    }
  }
  if (query.department) {
    q.department = query.department;
  }

  const rows = await OrderFlag.find(q)
    .populate('order', 'order_no order_number customer party status current_status')
    .populate('raised_by', 'name email department')
    .populate('assigned_to', 'name email department')
    .populate('tagged_members', 'name email department')
    .populate('resolved_by', 'name email department')
    .sort({ last_message_at: -1, createdAt: -1 })
    .lean();
  return rows.map(toPlain);
}

/**
 * Get single flag with populated relations.
 */
async function get(id) {
  const row = await getModels().OrderFlag.findById(id)
    .populate('order', 'order_no order_number customer party status current_status')
    .populate('raised_by', 'name email department')
    .populate('assigned_to', 'name email department')
    .populate('tagged_members', 'name email department')
    .populate('resolved_by', 'name email department')
    .lean();
  if (!row) throw new ApiError(404, 'Flag not found');
  return toPlain(row);
}

/**
 * Create a new flag assigned to an OPMS member, establishing the chat loop.
 */
async function create(body, user) {
  const { Order, OrderFlag, FlagMessage, User } = getModels();
  const order = await Order.findById(body.order).lean();
  if (!order) throw new ApiError(404, 'Order not found');

  const assignedToId = body.assigned_to || undefined;

  // Tagged members: array of ObjectIds
  let taggedMembers = [];
  if (Array.isArray(body.tagged_members)) {
    taggedMembers = body.tagged_members
      .map((id) => String(id).trim())
      .filter((id) => id && id !== String(user._id) && id !== String(assignedToId));
    // Deduplicate
    taggedMembers = [...new Set(taggedMembers)];
  }

  let department = body.department;
  if (!department && assignedToId && User) {
    try {
      const assignedUser = await User.findById(assignedToId).lean();
      if (assignedUser) {
        department = assignedUser.department || primaryOpmsRole(assignedUser);
      }
    } catch (_lookupErr) {
      // ignore
    }
  }
  if (!department) {
    department = primaryOpmsRole(user) || 'sales';
  }

  const initialText = (body.description || '').trim();
  const participants = [user._id];
  if (assignedToId && String(assignedToId) !== String(user._id)) {
    participants.push(assignedToId);
  }
  for (const tm of taggedMembers) {
    if (!participants.some((p) => String(p) === String(tm))) {
      participants.push(tm);
    }
  }

  const doc = await OrderFlag.create({
    order: body.order,
    flag_type: body.flag_type,
    severity: body.severity || 'medium',
    title: body.title,
    description: initialText,
    blocks_order: false,
    status: 'open',
    department,
    raised_by: user._id,
    assigned_to: assignedToId,
    tagged_members: taggedMembers,
    participants,
    message_count: initialText ? 1 : 0,
    last_message_at: new Date(),
    last_message_preview: initialText ? initialText.slice(0, 100) : 'Flag created',
    due_date: body.due_date || undefined,
  });

  // Seed the first message in the chat loop if description provided
  if (initialText) {
    await FlagMessage.create({
      flag: doc._id,
      order: body.order,
      sender: user._id,
      sender_name: user.name || 'User',
      sender_role: primaryOpmsRole(user),
      sender_department: user.department,
      message_type: 'text',
      content: initialText,
      read_by: [{ user: user._id, read_at: new Date() }],
    });
  }

  await recomputeOrderFlagAggregates(body.order);

  await activityService.create({
    actor: user._id,
    entity_type: 'flag',
    entity_id: doc._id.toString(),
    action: 'flagged',
    message: `Flag ${body.flag_type} raised: "${body.title}"`,
  });

  const populated = await get(doc._id);
  void flagNotificationService.notifyFlagCreated(populated, order, user);
  return populated;
}

/**
 * Generic patch helper for flag metadata.
 */
async function patch(id, patchData, user) {
  const row = await get(id);
  const next = { ...row, ...patchData };

  if (next.status === 'resolved' || next.status === 'dismissed') {
    next.resolved_by = user._id;
    next.resolved_at = new Date();
    if (!next.resolution_note && patchData.status) {
      next.resolution_note = patchData.resolution_note || '';
    }
  }

  const updated = await getModels().OrderFlag.findByIdAndUpdate(id, next, { new: true })
    .populate('order', 'order_no order_number customer party')
    .populate('raised_by', 'name email department')
    .populate('assigned_to', 'name email department')
    .populate('tagged_members', 'name email department')
    .populate('resolved_by', 'name email department')
    .lean();

  await recomputeOrderFlagAggregates(row.order);
  return toPlain(updated);
}

/**
 * List all messages in a flag's chat loop.
 */
async function listMessages(flagId, user) {
  const { OrderFlag, FlagMessage } = getModels();
  const flag = await OrderFlag.findById(flagId).lean();
  if (!flag) throw new ApiError(404, 'Flag not found');

  const rows = await FlagMessage.find({ flag: flagId })
    .populate('sender', 'name email department')
    .sort({ createdAt: 1 })
    .lean();

  // Mark unread messages as read asynchronously
  if (user?._id) {
    FlagMessage.updateMany(
      { flag: flagId, 'read_by.user': { $ne: user._id } },
      { $addToSet: { read_by: { user: user._id, read_at: new Date() } } }
    ).catch(() => {});
  }

  return rows.map(toPlain);
}

/**
 * Post a new message in the flag's chat loop.
 */
async function createMessage(flagId, body, user) {
  const { OrderFlag, FlagMessage } = getModels();
  const flag = await OrderFlag.findById(flagId);
  if (!flag) throw new ApiError(404, 'Flag not found');

  if (flag.status === 'resolved' || flag.status === 'dismissed') {
    throw new ApiError(400, 'This flag has been resolved. Further chat is closed.');
  }

  const content = (body.content || '').trim();
  if (!content && (!body.attachments || body.attachments.length === 0)) {
    throw new ApiError(400, 'Message content or attachment is required');
  }

  const msg = await FlagMessage.create({
    flag: flag._id,
    order: flag.order,
    sender: user._id,
    sender_name: user.name || 'User',
    sender_role: primaryOpmsRole(user),
    sender_department: user.department,
    message_type: body.message_type || (body.attachments?.length ? 'file' : 'text'),
    content,
    attachments: body.attachments || [],
    mentions: body.mentions || [],
    read_by: [{ user: user._id, read_at: new Date() }],
  });

  // Update parent flag
  flag.last_message_at = new Date();
  flag.last_message_preview = content ? content.slice(0, 100) : 'Sent an attachment';
  flag.message_count = (flag.message_count || 0) + 1;
  if (!flag.participants) flag.participants = [];
  if (!flag.participants.some((p) => String(p) === String(user._id))) {
    flag.participants.push(user._id);
  }
  await flag.save();

  const populated = await FlagMessage.findById(msg._id)
    .populate('sender', 'name email department')
    .lean();

  const parentOrder = await getModels().Order.findById(flag.order)
    .populate('party', 'legal_name trade_name name')
    .populate('customer', 'name')
    .lean();
  void flagNotificationService.notifyChatMessage(flag, msg, parentOrder, user);

  return toPlain(populated);
}

/**
 * Upload a file attachment for the flag chat loop via the filesystem API.
 */
async function uploadChatFile(flagId, file, user) {
  const { OrderFlag } = getModels();
  const flag = await OrderFlag.findById(flagId);
  if (!flag) throw new ApiError(404, 'Flag not found');

  if (flag.status === 'resolved' || flag.status === 'dismissed') {
    throw new ApiError(400, 'This flag has been resolved. Further chat and uploads are closed.');
  }

  const fileId = await uploadMulterFile(file, 'flag', String(flagId));
  const meta = await getFileMeta(fileId).catch(() => ({}));

  let attachment = null;
  try {
    attachment = await attachmentService.create(
      {
        original_name: meta?.originalName || file.originalname,
        file_name: meta?.originalName || file.originalname,
        mime_type: meta?.mimeType || file.mimetype,
        size: meta?.sizeBytes || file.size,
        storage_provider: 'minio',
        bucket: meta?.bucket || 'company-files',
        key: meta?.objectKey || fileId,
        filename: fileId,
        fileId: fileId,
        url: `/api/files/${fileId}/view`,
        entity_type: 'flag',
        entity_id: String(flagId),
        order: flag.order,
        remarks: `Flag Chat: ${file.originalname}`,
      },
      user
    );
  } catch (err) {
    console.warn('[FlagService] Attachment record creation note:', err.message);
  }

  return {
    attachment_id: attachment ? attachment._id : null,
    fileId,
    original_name: meta?.originalName || file.originalname,
    mime_type: meta?.mimeType || file.mimetype,
    size_bytes: meta?.sizeBytes || file.size,
    view_url: `/api/files/${fileId}/view`,
    download_url: `/api/files/${fileId}/download`,
    file_url: `/api/files/${fileId}/view`,
  };
}

/**
 * Update flag status (e.g. open -> in_progress -> resolved -> reopened) with chat event log.
 */
async function updateStatus(flagId, status, resolutionNote, user) {
  const { OrderFlag, FlagMessage } = getModels();
  const flag = await OrderFlag.findById(flagId);
  if (!flag) throw new ApiError(404, 'Flag not found');

  const oldStatus = flag.status;
  if (oldStatus === status) {
    return toPlain(flag.toObject());
  }

  flag.status = status;
  if (status === 'resolved' || status === 'dismissed') {
    flag.resolved_by = user._id;
    flag.resolved_at = new Date();
    if (resolutionNote) {
      flag.resolution_note = resolutionNote;
    }
  } else if (status === 'open' || status === 'in_progress') {
    flag.resolved_by = undefined;
    flag.resolved_at = undefined;
  }

  flag.last_message_at = new Date();
  flag.last_message_preview = `Status changed to ${status.replace('_', ' ')}`;
  flag.message_count = (flag.message_count || 0) + 1;
  if (!flag.participants) flag.participants = [];
  if (!flag.participants.some((p) => String(p) === String(user._id))) {
    flag.participants.push(user._id);
  }
  await flag.save();

  // Create status change event in the chat thread
  await FlagMessage.create({
    flag: flag._id,
    order: flag.order,
    sender: user._id,
    sender_name: user.name || 'User',
    sender_role: primaryOpmsRole(user),
    sender_department: user.department,
    message_type: 'status_change',
    content: resolutionNote || `Changed flag status from ${oldStatus.replace('_', ' ')} to ${status.replace('_', ' ')}`,
    status_change: {
      from_status: oldStatus,
      to_status: status,
    },
    read_by: [{ user: user._id, read_at: new Date() }],
  });

  await recomputeOrderFlagAggregates(flag.order);

  await activityService.create({
    actor: user._id,
    entity_type: 'flag',
    entity_id: flag._id.toString(),
    action: status === 'resolved' ? 'resolved' : 'updated',
    message: `Flag status updated to ${status}: ${resolutionNote || ''}`,
  });

  const updated = await get(flagId);
  const parentOrder = await getModels().Order.findById(flag.order)
    .populate('party', 'legal_name trade_name name')
    .populate('customer', 'name')
    .lean();
  void flagNotificationService.notifyFlagStatusChange(flag, parentOrder, user, status, oldStatus, resolutionNote);

  return updated;
}

module.exports = {
  recomputeOrderFlagAggregates,
  listOpmsMembers,
  list,
  get,
  create,
  patch,
  listMessages,
  createMessage,
  uploadChatFile,
  updateStatus,
};
