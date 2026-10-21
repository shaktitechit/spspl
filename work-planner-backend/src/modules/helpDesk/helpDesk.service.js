/**
 * @fileoverview Core business logic and database service for Help Desk module.
 * @module modules/helpDesk/helpDesk.service
 */

const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { logger } = require('../../utils/logger');
const {
  dispatchTicketCreatedNotification,
  dispatchReplyNotification,
  dispatchSolutionProposedNotification,
  dispatchTicketResolvedNotification,
  dispatchTicketReopenedNotification,
} = require('./helpDeskNotification.service');

const { withFreshViewUrl } = require('../../services/fileManagement');

function toPlain(doc) {
  if (!doc) return null;
  if (Array.isArray(doc)) return doc.map((d) => toPlain(d));
  if (typeof doc.toObject === 'function') return doc.toObject();
  return JSON.parse(JSON.stringify(doc));
}

function sanitizeAttachments(attachments, defaultUserId, defaultUserName = '') {
  if (!Array.isArray(attachments)) return [];
  return attachments
    .filter(Boolean)
    .map((att) => {
      let uId = att.uploaded_by;
      let uName = att.uploaded_by_name || '';
      if (uId && typeof uId === 'object' && uId._id) {
        uName = uName || uId.name || '';
        uId = uId._id;
      }
      const rawIdStr = String(uId || '').trim();
      const isValidObjId =
        rawIdStr &&
        mongoose.Types.ObjectId.isValid(rawIdStr) &&
        String(new mongoose.Types.ObjectId(rawIdStr)) === rawIdStr;

      const fallbackUserId =
        defaultUserId && mongoose.Types.ObjectId.isValid(String(defaultUserId))
          ? defaultUserId
          : null;

      return {
        file_id: att.file_id || att._id || '',
        filename: att.filename || '',
        original_name: att.original_name || att.filename || '',
        mime_type: att.mime_type || '',
        size: Number(att.size) || 0,
        url: att.url || '',
        uploaded_by: isValidObjId ? uId : fallbackUserId,
        uploaded_by_name:
          uName ||
          (!isValidObjId && typeof att.uploaded_by === 'string' && att.uploaded_by !== String(fallbackUserId)
            ? att.uploaded_by
            : defaultUserName),
        uploaded_at: att.uploaded_at ? new Date(att.uploaded_at) : new Date(),
      };
    });
}

async function hydrateTicketAttachments(ticket) {
  if (!ticket) return ticket;
  const out = { ...ticket };

  if (Array.isArray(out.attachments) && out.attachments.length > 0) {
    out.attachments = await Promise.all(
      out.attachments.map(async (att) => {
        if (!att) return att;
        return withFreshViewUrl(att);
      })
    );
  }

  if (out.proposed_solution && Array.isArray(out.proposed_solution.attachments)) {
    out.proposed_solution.attachments = await Promise.all(
      out.proposed_solution.attachments.map(async (att) => {
        if (!att) return att;
        return withFreshViewUrl(att);
      })
    );
  }

  if (Array.isArray(out.replies) && out.replies.length > 0) {
    out.replies = await Promise.all(
      out.replies.map(async (reply) => {
        if (!reply) return reply;
        const repOut = { ...reply };
        if (Array.isArray(repOut.attachments) && repOut.attachments.length > 0) {
          repOut.attachments = await Promise.all(
            repOut.attachments.map(async (att) => {
              if (!att) return att;
              return withFreshViewUrl(att);
            })
          );
        }
        return repOut;
      })
    );
  }

  return out;
}

/**
 * Generates sequential ticket number e.g. HD-2026-0001
 */
async function generateTicketNumber() {
  const { HelpTicket } = getModels();
  const year = new Date().getFullYear();
  const prefix = `HD-${year}-`;

  const lastTicket = await HelpTicket.findOne(
    { ticket_number: new RegExp(`^${prefix}`) },
    { ticket_number: 1 },
    { sort: { createdAt: -1 } }
  ).lean();

  let nextSeq = 1;
  if (lastTicket?.ticket_number) {
    const parts = lastTicket.ticket_number.split('-');
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

/**
 * Creates a new help ticket and notifies all tagged collaborators.
 */
async function createTicket(user, payload) {
  const { HelpTicket, User } = getModels();
  const userId = user._id || user.id;

  if (!payload.title || !payload.title.trim()) {
    throw new Error('Ticket title/subject is required');
  }
  if (!payload.description || !payload.description.trim()) {
    throw new Error('Ticket description is required');
  }

  // Creator snapshot
  const creatorDoc = await User.findById(userId).lean();
  const creatorSnapshot = {
    name: creatorDoc?.name || user.name || 'User',
    email: creatorDoc?.email || user.email || '',
    department: creatorDoc?.department || user.department || '',
    role: user.role || user.wp_role || 'Executive',
  };

  // Process tagged users
  const rawTaggedIds = Array.isArray(payload.tagged_user_ids)
    ? payload.tagged_user_ids
    : Array.isArray(payload.tagged_users)
      ? payload.tagged_users.map((t) => (typeof t === 'object' ? t.user || t._id || t.id : t))
      : [];

  const distinctTaggedIds = [
    ...new Set(
      rawTaggedIds
        .map((id) => String(id).trim())
        .filter((id) => id && id !== String(userId) && mongoose.Types.ObjectId.isValid(id))
    ),
  ];

  const taggedUsersData = [];
  if (distinctTaggedIds.length > 0) {
    const taggedDocs = await User.find({ _id: { $in: distinctTaggedIds }, is_active: { $ne: false } }).lean();
    for (const doc of taggedDocs) {
      taggedUsersData.push({
        user: doc._id,
        name: doc.name,
        email: doc.email,
        department: doc.department || '',
        role: doc.role || doc.wp_role || '',
        tagged_at: new Date(),
        acknowledged_at: null,
      });
    }
  }

  const ticketNumber = await generateTicketNumber();

  const ticket = await HelpTicket.create({
    ticket_number: ticketNumber,
    title: payload.title.trim(),
    description: payload.description.trim(),
    category: payload.category || 'general_requirement',
    priority: payload.priority || 'medium',
    status: 'open',
    created_by: userId,
    creator_snapshot: creatorSnapshot,
    company_id: user.company_id || creatorDoc?.company_id || null,
    tagged_users: taggedUsersData,
    member_read_state: [
      {
        user: userId,
        last_read_at: new Date(),
        last_read_reply_id: null,
      },
    ],
    related_entity: payload.related_entity || { entity_type: 'none' },
    attachments: sanitizeAttachments(payload.attachments, userId, creatorSnapshot.name),
    due_date: payload.due_date ? new Date(payload.due_date) : null,
    last_activity_at: new Date(),
  });

  const plainTicket = toPlain(ticket);

  // Dispatch notifications & emails asynchronously
  dispatchTicketCreatedNotification(plainTicket).catch((err) => {
    logger.error(`[HelpDeskService] Failed to dispatch creation notification: ${err.message}`);
  });

  return plainTicket;
}

function isSuperAdmin(user) {
  if (!user) return false;
  const role = String(user.role || user.wp_role || user.department || '').toLowerCase().trim();
  if (role === 'super_admin' || role === 'admin') return true;
  if (Array.isArray(user.role_codes) && user.role_codes.includes('super_admin')) return true;
  if (
    Array.isArray(user.roles) &&
    user.roles.some((r) => String(r.code || r.name || r).toLowerCase() === 'super_admin')
  ) {
    return true;
  }
  return false;
}

/**
 * Queries tickets with rich filters, scoping, and pagination.
 * Strict Access Guard: Non-super-admin users can ONLY list tickets they created or are tagged in.
 */
async function listTickets(user, query = {}) {
  const { HelpTicket, HelpTicketReply } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const conditions = [{ deletedAt: null }];

  // Access / Scope control:
  // Non-super-admins MUST ONLY see tickets they created or are tagged in.
  const scope = query.scope || 'all';
  if (scope === 'tagged') {
    conditions.push({ 'tagged_users.user': userId });
  } else if (scope === 'created') {
    conditions.push({ created_by: userId });
  } else if (scope === 'needs_my_approval') {
    conditions.push({ created_by: userId, status: 'solution_proposed' });
  } else {
    // scope === 'all' or any default
    if (!superAdmin) {
      conditions.push({
        $or: [{ created_by: userId }, { 'tagged_users.user': userId }],
      });
    }
  }

  // Status Filter
  if (query.status && query.status !== 'all') {
    if (query.status === 'active') {
      conditions.push({ status: { $in: ['open', 'in_progress', 'solution_proposed', 'reopened'] } });
    } else {
      conditions.push({ status: query.status });
    }
  }

  // Priority Filter
  if (query.priority && query.priority !== 'all') {
    conditions.push({ priority: query.priority });
  }

  // Category Filter
  if (query.category && query.category !== 'all') {
    conditions.push({ category: query.category });
  }

  // Date Range
  if (query.from || query.to) {
    const dateCond = {};
    if (query.from) dateCond.$gte = new Date(query.from);
    if (query.to) dateCond.$lte = new Date(`${query.to}T23:59:59.999Z`);
    conditions.push({ createdAt: dateCond });
  }

  // Search Filter (safely AND-ed with access condition)
  if (query.search && query.search.trim()) {
    const q = query.search.trim();
    const regex = new RegExp(q, 'i');
    conditions.push({
      $or: [
        { ticket_number: regex },
        { title: regex },
        { description: regex },
        { 'creator_snapshot.name': regex },
        { 'tagged_users.name': regex },
        { 'related_entity.entity_title': regex },
        { 'related_entity.entity_code': regex },
      ],
    });
  }

  const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

  const [total, tickets] = await Promise.all([
    HelpTicket.countDocuments(filter),
    HelpTicket.find(filter)
      .sort({ last_activity_at: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const ticketIds = tickets.map((t) => t._id);
  const replies = ticketIds.length > 0
    ? await HelpTicketReply.find({ ticket: { $in: ticketIds } })
        .sort({ createdAt: -1 })
        .lean()
    : [];

  const repliesByTicket = {};
  for (const r of replies) {
    const tId = String(r.ticket);
    if (!repliesByTicket[tId]) {
      repliesByTicket[tId] = [];
    }
    repliesByTicket[tId].push(r);
  }

  const hydratedTickets = await Promise.all(
    toPlain(tickets).map(async (t) => {
      const tId = String(t._id);
      const tReplies = repliesByTicket[tId] || [];
      const myReadEntry = (t.member_read_state || []).find(
        (s) => String(s.user?._id || s.user) === userId
      );

      let lastReadAt = myReadEntry?.last_read_at ? new Date(myReadEntry.last_read_at) : null;
      if (!lastReadAt) {
        if (String(t.created_by?._id || t.created_by) === userId) {
          lastReadAt = new Date(t.createdAt);
        } else {
          const taggedRec = (t.tagged_users || []).find(
            (tu) => String(tu.user?._id || tu.user) === userId
          );
          lastReadAt = taggedRec?.tagged_at ? new Date(taggedRec.tagged_at) : new Date(0);
        }
      }

      // Calculate unseen messages (excluding messages posted by self)
      const unseenCount = tReplies.filter((r) => {
        const isMyMsg = String(r.user?._id || r.user) === userId;
        if (isMyMsg) return false;
        return new Date(r.createdAt) > lastReadAt;
      }).length;

      const latestReply = tReplies[0] || null;
      const latestPreview = latestReply
        ? {
            message: latestReply.message,
            user_name: latestReply.user_snapshot?.name || 'User',
            createdAt: latestReply.createdAt,
            reply_type: latestReply.reply_type,
          }
        : null;

      const hydrated = await hydrateTicketAttachments(t);
      return {
        ...hydrated,
        unseen_messages_count: unseenCount,
        latest_reply_preview: latestPreview,
      };
    })
  );

  return {
    data: hydratedTickets,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Gets a single ticket with full details, replies stream, read receipts, and access flags.
 * Strict Access Guard: Non-super-admins cannot view tickets they are not creator or tagged in.
 */
async function getTicketById(user, ticketId) {
  const { HelpTicket, HelpTicketReply } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Invalid ticket ID format');
  }

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null }).lean();
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by?._id || ticket.created_by) === userId;
  const isTagged = (ticket.tagged_users || []).some((t) => String(t.user?._id || t.user) === userId);

  // Strict Access Guard
  if (!isCreator && !isTagged && !superAdmin) {
    throw new Error('Access denied: You can only view help tickets that you created or are tagged on.');
  }

  const replies = await HelpTicketReply.find({ ticket: ticketId }).sort({ createdAt: 1 }).lean();

  const canResolve = isCreator || superAdmin;
  const canProposeSolution = isTagged || isCreator || superAdmin;
  const canAcknowledge = isTagged && ticket.status === 'open';
  const canReopen = isCreator && (ticket.status === 'solution_proposed' || ticket.status === 'resolved');

  // Enhance tagged users with their member_read_state
  const readStateMap = {};
  for (const s of ticket.member_read_state || []) {
    const sUserId = String(s.user?._id || s.user);
    readStateMap[sUserId] = s.last_read_at;
  }

  const enhancedTaggedUsers = (ticket.tagged_users || []).map((tu) => {
    const tuUserId = String(tu.user?._id || tu.user);
    return {
      ...tu,
      last_read_at: readStateMap[tuUserId] || null,
    };
  });

  const combined = {
    ...toPlain(ticket),
    tagged_users: enhancedTaggedUsers,
    creator_last_read_at: readStateMap[String(ticket.created_by?._id || ticket.created_by)] || null,
    replies: toPlain(replies),
    permissions: {
      isCreator,
      isTagged,
      canResolve,
      canProposeSolution,
      canAcknowledge,
      canReopen,
    },
  };

  return await hydrateTicketAttachments(combined);
}

/**
 * Marks ticket and all messages as read for the current user.
 */
async function markTicketAsRead(user, ticketId) {
  const { HelpTicket, HelpTicketReply } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  if (!mongoose.Types.ObjectId.isValid(ticketId)) {
    throw new Error('Invalid ticket ID format');
  }

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by?._id || ticket.created_by) === userId;
  const isTagged = (ticket.tagged_users || []).some((t) => String(t.user?._id || t.user) === userId);

  if (!isCreator && !isTagged && !superAdmin) {
    throw new Error('Access denied');
  }

  const now = new Date();

  // Find latest reply ID
  const latestReply = await HelpTicketReply.findOne({ ticket: ticketId })
    .sort({ createdAt: -1 })
    .select('_id')
    .lean();

  if (!Array.isArray(ticket.member_read_state)) {
    ticket.member_read_state = [];
  }

  const existingIdx = ticket.member_read_state.findIndex(
    (s) => String(s.user?._id || s.user) === userId
  );

  if (existingIdx >= 0) {
    ticket.member_read_state[existingIdx].last_read_at = now;
    ticket.member_read_state[existingIdx].last_read_reply_id = latestReply?._id || null;
  } else {
    ticket.member_read_state.push({
      user: userId,
      last_read_at: now,
      last_read_reply_id: latestReply?._id || null,
    });
  }

  await ticket.save();

  // Update all replies where user is not yet in read_by
  await HelpTicketReply.updateMany(
    {
      ticket: ticketId,
      'read_by.user': { $ne: userId },
    },
    {
      $push: {
        read_by: {
          user: userId,
          name: user.name || 'User',
          role: user.role || user.wp_role || '',
          read_at: now,
        },
      },
    }
  );

  return {
    success: true,
    ticket_id: ticketId,
    last_read_at: now,
    unseen_count: 0,
  };
}

/**
 * Adds a message or reply to the ticket discussion thread.
 */
async function addReply(user, ticketId, payload) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  if (!payload.message || !payload.message.trim()) {
    throw new Error('Reply message content is required');
  }

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by?._id || ticket.created_by) === userId;
  const isTagged = (ticket.tagged_users || []).some((t) => String(t.user?._id || t.user) === userId);

  // Strict Access Guard
  if (!isCreator && !isTagged && !superAdmin) {
    throw new Error('Access denied: You can only reply to help tickets that you created or are tagged on.');
  }

  const userDoc = await User.findById(userId).lean();
  const userSnapshot = {
    name: userDoc?.name || user.name || 'User',
    email: userDoc?.email || user.email || '',
    department: userDoc?.department || user.department || '',
    role: user.role || user.wp_role || 'Executive',
  };

  const replyType = payload.reply_type || 'comment';
  const now = new Date();

  const reply = await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: userSnapshot,
    message: payload.message.trim(),
    reply_type: replyType,
    attachments: sanitizeAttachments(payload.attachments, userId, userSnapshot.name),
    metadata: payload.metadata || {},
    read_by: [
      {
        user: userId,
        name: userSnapshot.name,
        role: userSnapshot.role,
        read_at: now,
      },
    ],
  });

  // If ticket was open and tagged user is replying, move to in_progress
  if (ticket.status === 'open') {
    ticket.status = 'in_progress';
  }

  // Update author's read state
  if (!Array.isArray(ticket.member_read_state)) {
    ticket.member_read_state = [];
  }
  const existingIdx = ticket.member_read_state.findIndex(
    (s) => String(s.user?._id || s.user) === userId
  );
  if (existingIdx >= 0) {
    ticket.member_read_state[existingIdx].last_read_at = now;
    ticket.member_read_state[existingIdx].last_read_reply_id = reply._id;
  } else {
    ticket.member_read_state.push({
      user: userId,
      last_read_at: now,
      last_read_reply_id: reply._id,
    });
  }

  ticket.replies_count = (ticket.replies_count || 0) + 1;
  ticket.last_activity_at = now;
  await ticket.save();

  const plainReply = toPlain(reply);
  const plainTicket = toPlain(ticket);

  // Dispatch reply notifications
  dispatchReplyNotification(plainTicket, plainReply).catch((err) => {
    logger.error(`[HelpDeskService] Failed to dispatch reply notification: ${err.message}`);
  });

  return plainReply;
}

/**
 * Dynamically tags additional users into an ongoing help ticket.
 */
async function tagUsers(user, ticketId, payload) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by) === userId;
  const isTagged = (ticket.tagged_users || []).some((t) => String(t.user?._id || t.user) === userId);

  // Strict Access Guard
  if (!isCreator && !isTagged && !superAdmin) {
    throw new Error('Access denied: You can only tag collaborators on help tickets you are involved with.');
  }

  const rawIds = Array.isArray(payload.user_ids) ? payload.user_ids : [];
  const existingIds = new Set((ticket.tagged_users || []).map((t) => String(t.user)));

  const newValidIds = rawIds
    .map((id) => String(id).trim())
    .filter((id) => id && !existingIds.has(id) && mongoose.Types.ObjectId.isValid(id));

  if (newValidIds.length === 0) {
    return toPlain(ticket);
  }

  const newDocs = await User.find({ _id: { $in: newValidIds }, is_active: { $ne: false } }).lean();
  const newlyAdded = [];

  for (const doc of newDocs) {
    const entry = {
      user: doc._id,
      name: doc.name,
      email: doc.email,
      department: doc.department || '',
      role: doc.role || doc.wp_role || '',
      tagged_at: new Date(),
      acknowledged_at: null,
    };
    ticket.tagged_users.push(entry);
    newlyAdded.push(entry);
  }

  ticket.last_activity_at = new Date();
  await ticket.save();

  // Create timeline reply for tagged users
  const userDoc = await User.findById(userId).lean();
  const taggedNames = newlyAdded.map((u) => u.name).join(', ');

  await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: userDoc?.name || user.name || 'User',
      email: userDoc?.email || '',
      department: userDoc?.department || '',
    },
    message: `Tagged additional collaborator(s): ${taggedNames}`,
    reply_type: 'users_tagged',
    metadata: { newly_tagged_names: newlyAdded.map((u) => u.name) },
  });

  const plainTicket = toPlain(ticket);

  // Notify newly tagged users
  dispatchTicketCreatedNotification({
    ...plainTicket,
    tagged_users: newlyAdded,
  }).catch((err) => {
    logger.error(`[HelpDeskService] Failed to notify newly tagged users: ${err.message}`);
  });

  return plainTicket;
}

/**
 * Acknowledges ticket by a tagged collaborator and moves to in_progress.
 */
async function acknowledgeTicket(user, ticketId) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const taggedItem = (ticket.tagged_users || []).find((t) => String(t.user) === userId);
  if (!taggedItem) {
    throw new Error('Only tagged collaborators can acknowledge this ticket');
  }

  taggedItem.acknowledged_at = new Date();
  if (ticket.status === 'open') {
    ticket.status = 'in_progress';
  }
  ticket.last_activity_at = new Date();
  await ticket.save();

  const userDoc = await User.findById(userId).lean();
  await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: userDoc?.name || user.name || 'Collaborator',
      email: userDoc?.email || '',
      department: userDoc?.department || '',
    },
    message: `Acknowledged help request and started working on requirements.`,
    reply_type: 'status_change',
    metadata: { previous_status: 'open', new_status: 'in_progress' },
  });

  return toPlain(ticket);
}

/**
 * Proposes a solution / deliverables and alerts the creator for resolution confirmation.
 */
async function proposeSolution(user, ticketId, payload) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  if (!payload.solution_text || !payload.solution_text.trim()) {
    throw new Error('Solution / deliverable explanation is required');
  }

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by) === userId;
  const isTagged = (ticket.tagged_users || []).some((t) => String(t.user?._id || t.user) === userId);

  // Strict Access Guard
  if (!isCreator && !isTagged && !superAdmin) {
    throw new Error('Access denied: You can only propose solutions for help tickets you are involved with.');
  }

  const userDoc = await User.findById(userId).lean();
  const solutionData = {
    solution_text: payload.solution_text.trim(),
    proposed_by: userId,
    proposed_by_name: userDoc?.name || user.name || 'Collaborator',
    proposed_at: new Date(),
    attachments: sanitizeAttachments(payload.attachments, userId, userDoc?.name || user.name || 'Collaborator'),
  };

  ticket.proposed_solution = solutionData;
  ticket.status = 'solution_proposed';
  ticket.last_activity_at = new Date();
  await ticket.save();

  const reply = await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: userDoc?.name || user.name || 'Collaborator',
      email: userDoc?.email || '',
      department: userDoc?.department || '',
    },
    message: `Proposed Solution: ${payload.solution_text.trim()}`,
    reply_type: 'solution_proposal',
    attachments: solutionData.attachments,
    metadata: { new_status: 'solution_proposed' },
  });

  const plainTicket = toPlain(ticket);

  // Dispatch notification to Creator
  dispatchSolutionProposedNotification(plainTicket, solutionData).catch((err) => {
    logger.error(`[HelpDeskService] Failed to dispatch solution proposed notification: ${err.message}`);
  });

  return plainTicket;
}

/**
 * Confirms resolution and closes ticket — EXCLUSIVELY BY CREATOR (or Admin).
 */
async function resolveTicket(user, ticketId, payload = {}) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by) === userId;
  const elevatedRole = ['admin', 'super_admin'].includes(String(user.role || user.wp_role).toLowerCase());

  if (!isCreator && !elevatedRole) {
    throw new Error('Only the creator of this help ticket has the authority to confirm resolution and close the ticket.');
  }

  const userDoc = await User.findById(userId).lean();
  const resolverName = userDoc?.name || user.name || 'Creator';

  ticket.status = 'resolved';
  ticket.resolution_details = {
    resolved_at: new Date(),
    resolved_by: userId,
    resolved_by_name: resolverName,
    resolution_notes: payload.resolution_notes ? payload.resolution_notes.trim() : 'Resolution confirmed by creator.',
    satisfaction_rating: typeof payload.satisfaction_rating === 'number' ? Math.min(5, Math.max(1, payload.satisfaction_rating)) : null,
  };
  ticket.last_activity_at = new Date();
  await ticket.save();

  const ratingStr = ticket.resolution_details.satisfaction_rating ? ` (Rated: ${ticket.resolution_details.satisfaction_rating}/5 ⭐)` : '';
  await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: resolverName,
      email: userDoc?.email || '',
      department: userDoc?.department || '',
    },
    message: `Marked as Resolved by ${resolverName}${ratingStr}. ${ticket.resolution_details.resolution_notes}`,
    reply_type: 'resolution_note',
    metadata: { new_status: 'resolved', rating: ticket.resolution_details.satisfaction_rating },
  });

  const plainTicket = toPlain(ticket);

  // Dispatch resolution notification to all tagged collaborators
  dispatchTicketResolvedNotification(plainTicket, resolverName).catch((err) => {
    logger.error(`[HelpDeskService] Failed to dispatch resolved notification: ${err.message}`);
  });

  return plainTicket;
}

/**
 * Reopens ticket by Creator if proposed solution was insufficient.
 */
async function reopenTicket(user, ticketId, payload = {}) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  const isCreator = String(ticket.created_by) === userId;
  const elevatedRole = ['admin', 'super_admin'].includes(String(user.role || user.wp_role).toLowerCase());

  if (!isCreator && !elevatedRole) {
    throw new Error('Only the creator of this help ticket can request revisions and reopen the ticket.');
  }

  const reason = payload.reason ? payload.reason.trim() : 'Revisions requested by creator.';
  const userDoc = await User.findById(userId).lean();
  const reopenerName = userDoc?.name || user.name || 'Creator';

  ticket.status = 'reopened';
  ticket.reopen_history.push({
    reopened_at: new Date(),
    reopened_by: userId,
    reopened_by_name: reopenerName,
    reason,
  });
  ticket.last_activity_at = new Date();
  await ticket.save();

  await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: reopenerName,
      email: userDoc?.email || '',
      department: userDoc?.department || '',
    },
    message: `Reopened Ticket: ${reason}`,
    reply_type: 'reopen_reason',
    metadata: { previous_status: ticket.status, new_status: 'reopened', reason },
  });

  const plainTicket = toPlain(ticket);

  // Dispatch reopen notifications
  dispatchTicketReopenedNotification(plainTicket, reopenerName, reason).catch((err) => {
    logger.error(`[HelpDeskService] Failed to dispatch reopened notification: ${err.message}`);
  });

  return plainTicket;
}

/**
 * Cancels ticket by Creator.
 */
async function cancelTicket(user, ticketId, payload = {}) {
  const { HelpTicket, HelpTicketReply, User } = getModels();
  const userId = String(user._id || user.id);

  const ticket = await HelpTicket.findOne({ _id: ticketId, deletedAt: null });
  if (!ticket) {
    throw new Error('Help ticket not found');
  }

  if (String(ticket.created_by) !== userId) {
    throw new Error('Only the ticket creator can cancel this ticket.');
  }

  const reason = payload.reason ? payload.reason.trim() : 'Cancelled by creator.';
  ticket.status = 'cancelled';
  ticket.last_activity_at = new Date();
  await ticket.save();

  const userDoc = await User.findById(userId).lean();
  await HelpTicketReply.create({
    ticket: ticketId,
    user: userId,
    user_snapshot: {
      name: userDoc?.name || user.name || 'Creator',
      email: userDoc?.email || '',
    },
    message: `Cancelled ticket: ${reason}`,
    reply_type: 'status_change',
    metadata: { new_status: 'cancelled', reason },
  });

  return toPlain(ticket);
}

/**
 * Returns summary KPI metrics for the Help Desk dashboard.
 */
async function getHelpDeskStats(user) {
  const { HelpTicket } = getModels();
  const userId = String(user._id || user.id);
  const superAdmin = isSuperAdmin(user);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const userInvolvement = superAdmin
    ? {}
    : { $or: [{ created_by: userId }, { 'tagged_users.user': userId }] };

  const [
    taggedToMeOpen,
    createdByMeOpen,
    solutionProposedWaitingMe,
    resolvedThisMonth,
    urgentCount,
    totalAllOpen,
  ] = await Promise.all([
    HelpTicket.countDocuments({
      'tagged_users.user': userId,
      status: { $in: ['open', 'in_progress', 'reopened'] },
      deletedAt: null,
    }),
    HelpTicket.countDocuments({
      created_by: userId,
      status: { $in: ['open', 'in_progress', 'reopened'] },
      deletedAt: null,
    }),
    HelpTicket.countDocuments({
      created_by: userId,
      status: 'solution_proposed',
      deletedAt: null,
    }),
    HelpTicket.countDocuments({
      ...userInvolvement,
      status: 'resolved',
      'resolution_details.resolved_at': { $gte: startOfMonth },
      deletedAt: null,
    }),
    HelpTicket.countDocuments({
      ...userInvolvement,
      priority: 'urgent',
      status: { $in: ['open', 'in_progress', 'reopened'] },
      deletedAt: null,
    }),
    HelpTicket.countDocuments({
      ...userInvolvement,
      status: { $in: ['open', 'in_progress', 'solution_proposed', 'reopened'] },
      deletedAt: null,
    }),
  ]);

  return {
    tagged_to_me_open: taggedToMeOpen,
    created_by_me_open: createdByMeOpen,
    solution_proposed_waiting_me: solutionProposedWaitingMe,
    resolved_this_month: resolvedThisMonth,
    urgent_count: urgentCount,
    total_all_open: totalAllOpen,
  };
}

/**
 * List all active users across company/departments for collaborator tagging and assignment in Help Desk.
 */
async function listUsers(actor) {
  const { User } = getModels();
  const docs = await User.find({ is_active: { $ne: false } })
    .select('_id name email phone department roles role_codes portals wp_role')
    .sort({ name: 1 })
    .lean();
  return docs;
}

module.exports = {
  generateTicketNumber,
  createTicket,
  listTickets,
  getTicketById,
  markTicketAsRead,
  addReply,
  tagUsers,
  acknowledgeTicket,
  proposeSolution,
  resolveTicket,
  reopenTicket,
  cancelTicket,
  getHelpDeskStats,
  listUsers,
};
