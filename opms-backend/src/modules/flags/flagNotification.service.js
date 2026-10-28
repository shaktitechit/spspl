/**
 * @fileoverview Flag Notification & Email Dispatcher.
 * Dispatches real-time in-app notifications (via notification-service SSE)
 * and rich HTML email alerts (via message-service unified email pipeline).
 * Primary Assignee is in TO, Tagged Members are in CC.
 * @module modules/flags/flagNotification.service
 */
const { getModels } = require('../../data/mongoRegistry');
const notificationHelper = require('../../utils/notificationHelper');
const emailHelper = require('../../utils/emailHelper');
const { primaryOpmsRole } = require('../../middlewares/opmsAuth.middleware');

const WEB_BASE_URL = (
  process.env.PUBLIC_WEB_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'http://localhost:7002'
).replace(/\/$/, '');

/**
 * Resolves a user reference (ObjectId, string, or partial object) into full user details.
 */
async function resolveUser(userRef) {
  if (!userRef) return null;
  if (typeof userRef === 'object' && userRef.email && userRef.name) {
    return {
      _id: String(userRef._id || userRef.id),
      name: userRef.name || 'User',
      email: userRef.email,
      department: userRef.department || 'sales',
      opms_role: primaryOpmsRole(userRef) || 'admin',
    };
  }

  const userId = typeof userRef === 'object' ? userRef._id || userRef.id : userRef;
  if (!userId) return null;

  try {
    const { User } = getModels();
    if (User) {
      const u = await User.findById(userId).lean();
      if (u) {
        return {
          _id: String(u._id),
          name: u.name || u.username || 'User',
          email: u.email || '',
          department: u.department || 'sales',
          opms_role: primaryOpmsRole(u) || 'admin',
        };
      }
    }
  } catch (err) {
    console.warn(`[FlagNotification] Failed to resolve user ${userId}:`, err.message);
  }

  return {
    _id: String(userId),
    name: 'Team Member',
    email: '',
    department: 'sales',
    opms_role: 'admin',
  };
}

/**
 * Resolves multiple user references into an array of user objects.
 */
async function resolveUsers(userRefs) {
  if (!Array.isArray(userRefs) || userRefs.length === 0) return [];
  const list = await Promise.all(userRefs.map(resolveUser));
  return list.filter(Boolean);
}

/**
 * Helper to construct web portal deep links for an order flag.
 */
function getFlagPortalUrl(orderId, flagId, userRole = 'admin') {
  const role = userRole || 'admin';
  return `${WEB_BASE_URL}/${role}/order/${orderId}?openFlag=${flagId}`;
}

/**
 * Formats file attachments into an HTML block for email templates.
 */
function formatAttachmentsHtml(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  const itemsHtml = attachments
    .map((att) => {
      const name = att.original_name || att.file_name || 'Attachment';
      const sizeStr = att.size_bytes ? ` (${Math.round(att.size_bytes / 1024)} KB)` : '';
      const viewUrl = att.view_url || (att.file_id ? `${WEB_BASE_URL}/api/files/${att.file_id}/view` : '#');
      const downloadUrl = att.download_url || (att.file_id ? `${WEB_BASE_URL}/api/files/${att.file_id}/download` : '#');

      return `
        <li style="margin-bottom: 8px; font-size: 13px; color: #1e293b;">
          <strong>📄 ${name}</strong>${sizeStr} &nbsp;—&nbsp;
          <a href="${viewUrl}" style="color: #2563eb; text-decoration: underline; margin-right: 8px;" target="_blank">View</a>
          <a href="${downloadUrl}" style="color: #059669; text-decoration: underline;" target="_blank">Download</a>
        </li>
      `;
    })
    .join('');

  return `
    <div class="attachment-box" style="background-color: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px 16px; margin-bottom: 24px;">
      <div class="attachment-title" style="font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        Attached Files (${attachments.length})
      </div>
      <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
        ${itemsHtml}
      </ul>
    </div>
  `;
}

/**
 * Extract order identifier & party name from populated or raw order object.
 */
function extractOrderDetails(order) {
  if (!order) return { orderId: '', orderNo: 'N/A', customerName: 'Customer' };
  const orderId = String(order._id || order.id || order);
  const orderNo = order.order_no || order.order_number || orderId;

  let customerName = 'Customer';
  if (order.party && typeof order.party === 'object') {
    customerName = order.party.legal_name || order.party.trade_name || order.party.name || customerName;
  } else if (order.customer && typeof order.customer === 'object') {
    customerName = order.customer.name || customerName;
  } else if (order.party_name) {
    customerName = order.party_name;
  } else if (order.customer_name) {
    customerName = order.customer_name;
  }

  return { orderId, orderNo, customerName };
}

/**
 * Dispatch in-app notification via notification-service.
 */
async function dispatchInAppNotification(userId, payload) {
  if (!userId) return null;
  try {
    return await notificationHelper.createForUser(String(userId), {
      title: payload.title,
      message: payload.message,
      type: payload.type || 'info',
      module: 'flag',
      entity_type: 'flag',
      entity_id: payload.entity_id ? String(payload.entity_id) : undefined,
      link: payload.link,
      metadata: payload.metadata || {},
    });
  } catch (err) {
    console.warn(`[FlagNotification] In-app notification to ${userId} skipped:`, err.message);
    return null;
  }
}

/**
 * Dispatch rich HTML email alert via message-service auto-email queue.
 * Primary in TO, Tagged in CC.
 */
async function dispatchEmailAlert(recipientEmail, templateParams, ccEmails = []) {
  if (!recipientEmail || !recipientEmail.includes('@')) return null;
  try {
    return await emailHelper.shootAutoEmail({
      recipient: recipientEmail,
      templateName: emailHelper.EMAIL_TEMPLATES.FLAG_ALERT,
      templateParams,
      cc: ccEmails,
    });
  } catch (err) {
    console.warn(`[FlagNotification] Outbound email to ${recipientEmail} (CC: ${ccEmails.join(', ')}) failed:`, err.message);
    return null;
  }
}

/**
 * Event: Flag Created & Assigned
 * - In-App SSE Notification: Sent to Assignee & each Tagged Member.
 * - Outbound Email: Primary Assignee in TO, All Tagged Members in CC.
 */
async function notifyFlagCreated(flag, order, raiserRef) {
  try {
    const { orderId, orderNo, customerName } = extractOrderDetails(order);
    const raiser = (await resolveUser(raiserRef)) || { name: 'Team Member' };
    const assignee = await resolveUser(flag.assigned_to);
    const taggedMembers = await resolveUsers(flag.tagged_members);

    const flagTitle = flag.title || 'Flag Alert';
    const severity = (flag.severity || 'medium').toUpperCase();
    const taggedNames = taggedMembers.map((m) => m.name);

    // 1. In-App Notification to Primary Assignee
    if (assignee && assignee._id && assignee._id !== raiser._id) {
      void dispatchInAppNotification(assignee._id, {
        title: `🚩 Flag Assigned: ${flagTitle}`,
        message: `${raiser.name} assigned an issue flag to you on Order #${orderNo}: "${flag.description || flagTitle}"`,
        type: flag.severity === 'critical' ? 'error' : 'warning',
        entity_id: flag._id,
        link: `/${assignee.opms_role || 'admin'}/order/${orderId}?openFlag=${flag._id}`,
        metadata: { order_id: orderId, flag_id: flag._id, severity: flag.severity },
      });
    }

    // 2. In-App Notification to Tagged Collaborators
    for (const member of taggedMembers) {
      if (member._id === raiser._id || (assignee && member._id === assignee._id)) continue;
      void dispatchInAppNotification(member._id, {
        title: `🏷️ Tagged in Flag: ${flagTitle}`,
        message: `${raiser.name} tagged you in flag "${flagTitle}" on Order #${orderNo}`,
        type: 'info',
        entity_id: flag._id,
        link: `/${member.opms_role || 'admin'}/order/${orderId}?openFlag=${flag._id}`,
        metadata: { order_id: orderId, flag_id: flag._id, severity: flag.severity },
      });
    }

    // 3. Email Alert: Primary Assignee in TO, All Tagged Members in CC
    const primaryEmail = assignee?.email && assignee.email.includes('@') ? assignee.email : null;
    const taggedEmails = taggedMembers
      .map((m) => m.email)
      .filter((e) => Boolean(e && e.includes('@') && e !== primaryEmail && e !== raiser.email));

    const toEmail = primaryEmail || (taggedEmails.length > 0 ? taggedEmails[0] : null);
    const ccEmails = primaryEmail ? taggedEmails : taggedEmails.slice(1);
    const primaryName = assignee?.name || (taggedMembers[0]?.name) || 'Team Member';
    const primaryRole = assignee?.opms_role || (taggedMembers[0]?.opms_role) || 'admin';
    const primaryUrl = getFlagPortalUrl(orderId, flag._id, primaryRole);

    if (toEmail) {
      void dispatchEmailAlert(
        toEmail,
        {
          subject: `🚩 Flag Assigned: ${flagTitle} - Order #${orderNo}`,
          recipientName: primaryName,
          badgeText: `FLAG ASSIGNED • ${severity}`,
          alertHeadline: `New Flag Assigned on Order #${orderNo}`,
          introDescription: `${raiser.name} has raised an issue flag on Order #${orderNo} and assigned ${assignee?.name || 'the team'} to review and resolve it.`,
          orderNo,
          customerName,
          flagTitle,
          severityLevel: severity,
          raisedByName: raiser.name,
          assignedToName: assignee?.name ? `${assignee.name} (${assignee.email || ''})` : 'Unassigned',
          taggedMembersNames: taggedNames.length ? taggedNames.join(', ') : 'None',
          messageSectionTitle: 'Flag Description & Details',
          messageBody: flag.description || flagTitle,
          attachmentsBlock: '',
          actionUrl: primaryUrl,
        },
        ccEmails
      );
    }
  } catch (err) {
    console.error('[FlagNotification] notifyFlagCreated error:', err.message);
  }
}

/**
 * Event: Chat Message / File Upload in Flag Thread
 * - In-App Notification: Sent to all conversation participants.
 * - Outbound Email: Primary Assignee in TO, Tagged Members in CC.
 */
async function notifyChatMessage(flag, message, order, senderRef) {
  try {
    const { orderId, orderNo, customerName } = extractOrderDetails(order);
    const sender = (await resolveUser(senderRef)) || { name: 'Team Member' };
    const assignee = await resolveUser(flag.assigned_to);
    const raiser = await resolveUser(flag.raised_by);
    const taggedMembers = await resolveUsers(flag.tagged_members);

    // Build unique recipient map for in-app SSE notifications
    const recipientMap = new Map();
    if (assignee && assignee._id && assignee._id !== sender._id) {
      recipientMap.set(assignee._id, assignee);
    }
    if (raiser && raiser._id && raiser._id !== sender._id) {
      recipientMap.set(raiser._id, raiser);
    }
    for (const tm of taggedMembers) {
      if (tm && tm._id && tm._id !== sender._id) {
        recipientMap.set(tm._id, tm);
      }
    }

    if (Array.isArray(message.mentions)) {
      const mentions = await resolveUsers(message.mentions);
      for (const m of mentions) {
        if (m && m._id && m._id !== sender._id) {
          recipientMap.set(m._id, m);
        }
      }
    }

    const flagTitle = flag.title || 'Flag Alert';
    const severity = (flag.severity || 'medium').toUpperCase();
    const taggedNames = taggedMembers.map((m) => m.name);
    const attachmentsHtml = formatAttachmentsHtml(message.attachments);

    let contentSnippet = message.content || '';
    if (!contentSnippet && message.attachments?.length) {
      contentSnippet = `📎 Shared ${message.attachments.length} file attachment(s)`;
    }

    // 1. Dispatch in-app notifications
    for (const recipient of recipientMap.values()) {
      void dispatchInAppNotification(recipient._id, {
        title: `💬 Flag Reply: ${flagTitle}`,
        message: `${sender.name}: "${contentSnippet.slice(0, 100)}"`,
        type: 'info',
        entity_id: flag._id,
        link: `/${recipient.opms_role || 'admin'}/order/${orderId}?openFlag=${flag._id}`,
        metadata: { order_id: orderId, flag_id: flag._id },
      });
    }

    // 2. Dispatch email: Primary Assignee in TO, Tagged Members in CC
    // If Primary Assignee is the sender, the Raiser is in TO, Tagged Members in CC.
    let toUser = null;
    if (assignee && assignee.email && assignee._id !== sender._id) {
      toUser = assignee;
    } else if (raiser && raiser.email && raiser._id !== sender._id) {
      toUser = raiser;
    } else if (taggedMembers.length > 0) {
      toUser = taggedMembers.find((m) => m.email && m._id !== sender._id);
    }

    if (toUser && toUser.email) {
      const ccUsers = [
        ...(raiser && raiser._id !== sender._id && raiser._id !== toUser._id ? [raiser] : []),
        ...(assignee && assignee._id !== sender._id && assignee._id !== toUser._id ? [assignee] : []),
        ...taggedMembers.filter((m) => m._id !== sender._id && m._id !== toUser._id),
      ];

      const ccEmails = Array.from(
        new Set(
          ccUsers
            .map((u) => u.email)
            .filter((e) => Boolean(e && e.includes('@') && e !== toUser.email && e !== sender.email))
        )
      );

      const targetUrl = getFlagPortalUrl(orderId, flag._id, toUser.opms_role);

      void dispatchEmailAlert(
        toUser.email,
        {
          subject: `💬 ${sender.name} replied to Flag: ${flagTitle} (Order #${orderNo})`,
          recipientName: toUser.name,
          badgeText: `FLAG CHAT REPLY • ${severity}`,
          alertHeadline: `New Message on Flag: ${flagTitle}`,
          introDescription: `${sender.name} posted a new reply in the discussion thread for Order #${orderNo}.`,
          orderNo,
          customerName,
          flagTitle,
          severityLevel: severity,
          raisedByName: raiser?.name || 'Team Member',
          assignedToName: assignee?.name ? `${assignee.name} (${assignee.email || ''})` : 'Unassigned',
          taggedMembersNames: taggedNames.length ? taggedNames.join(', ') : 'None',
          messageSectionTitle: `Message from ${sender.name}`,
          messageBody: message.content || 'See attached file(s) below.',
          attachmentsBlock: attachmentsHtml,
          actionUrl: targetUrl,
        },
        ccEmails
      );
    }
  } catch (err) {
    console.error('[FlagNotification] notifyChatMessage error:', err.message);
  }
}

/**
 * Event: Flag Status Change (Resolved, Dismissed, Reopened, etc.)
 * - In-App Notification: Sent to all conversation participants.
 * - Outbound Email: Primary Assignee in TO, Tagged Members in CC.
 */
async function notifyFlagStatusChange(flag, order, actorRef, newStatus, oldStatus, note) {
  try {
    const { orderId, orderNo, customerName } = extractOrderDetails(order);
    const actor = (await resolveUser(actorRef)) || { name: 'Team Member' };
    const assignee = await resolveUser(flag.assigned_to);
    const raiser = await resolveUser(flag.raised_by);
    const taggedMembers = await resolveUsers(flag.tagged_members);

    const recipientMap = new Map();
    if (assignee && assignee._id && assignee._id !== actor._id) {
      recipientMap.set(assignee._id, assignee);
    }
    if (raiser && raiser._id && raiser._id !== actor._id) {
      recipientMap.set(raiser._id, raiser);
    }
    for (const tm of taggedMembers) {
      if (tm && tm._id && tm._id !== actor._id) {
        recipientMap.set(tm._id, tm);
      }
    }

    const flagTitle = flag.title || 'Flag Alert';
    const severity = (flag.severity || 'medium').toUpperCase();
    const taggedNames = taggedMembers.map((m) => m.name);

    const isResolved = newStatus === 'resolved' || newStatus === 'dismissed';
    const isReopened = (oldStatus === 'resolved' || oldStatus === 'dismissed') && (newStatus === 'open' || newStatus === 'in_progress');

    let badgeText = `STATUS: ${newStatus.toUpperCase()}`;
    let subjectHeadline = `Flag Status Updated: ${flagTitle}`;
    let alertHeadline = `Flag status has been changed to ${newStatus.replace('_', ' ')}`;
    let inAppType = 'info';

    if (isResolved) {
      badgeText = 'FLAG RESOLVED';
      subjectHeadline = `✅ Flag Resolved: ${flagTitle} - Order #${orderNo}`;
      alertHeadline = `Flag Resolved by ${actor.name}`;
      inAppType = 'success';
    } else if (isReopened) {
      badgeText = 'FLAG REOPENED';
      subjectHeadline = `🔄 Flag Reopened: ${flagTitle} - Order #${orderNo}`;
      alertHeadline = `Flag Reopened by ${actor.name}`;
      inAppType = 'warning';
    }

    // 1. Dispatch in-app notifications
    for (const recipient of recipientMap.values()) {
      void dispatchInAppNotification(recipient._id, {
        title: isResolved ? `✅ Flag Resolved: ${flagTitle}` : `🔄 Flag Status: ${newStatus}`,
        message: `${actor.name} updated flag status to "${newStatus.replace('_', ' ')}" on Order #${orderNo}.${note ? ` Note: ${note}` : ''}`,
        type: inAppType,
        entity_id: flag._id,
        link: `/${recipient.opms_role || 'admin'}/order/${orderId}?openFlag=${flag._id}`,
        metadata: { order_id: orderId, flag_id: flag._id, status: newStatus },
      });
    }

    // 2. Dispatch email: Primary in TO, Tagged in CC
    let toUser = null;
    if (assignee && assignee.email && assignee._id !== actor._id) {
      toUser = assignee;
    } else if (raiser && raiser.email && raiser._id !== actor._id) {
      toUser = raiser;
    } else if (taggedMembers.length > 0) {
      toUser = taggedMembers.find((m) => m.email && m._id !== actor._id);
    }

    if (toUser && toUser.email) {
      const ccUsers = [
        ...(raiser && raiser._id !== actor._id && raiser._id !== toUser._id ? [raiser] : []),
        ...(assignee && assignee._id !== actor._id && assignee._id !== toUser._id ? [assignee] : []),
        ...taggedMembers.filter((m) => m._id !== actor._id && m._id !== toUser._id),
      ];

      const ccEmails = Array.from(
        new Set(
          ccUsers
            .map((u) => u.email)
            .filter((e) => Boolean(e && e.includes('@') && e !== toUser.email && e !== actor.email))
        )
      );

      const targetUrl = getFlagPortalUrl(orderId, flag._id, toUser.opms_role);

      void dispatchEmailAlert(
        toUser.email,
        {
          subject: subjectHeadline,
          recipientName: toUser.name,
          badgeText,
          alertHeadline,
          introDescription: `${actor.name} updated the status of flag "${flagTitle}" on Order #${orderNo} from ${oldStatus} to ${newStatus}.`,
          orderNo,
          customerName,
          flagTitle,
          severityLevel: severity,
          raisedByName: raiser?.name || 'Team Member',
          assignedToName: assignee?.name ? `${assignee.name} (${assignee.email || ''})` : 'Unassigned',
          taggedMembersNames: taggedNames.length ? taggedNames.join(', ') : 'None',
          messageSectionTitle: isResolved ? 'Resolution Summary & Notes' : 'Update Notes',
          messageBody: note || `Flag marked as ${newStatus.replace('_', ' ')}.`,
          attachmentsBlock: '',
          actionUrl: targetUrl,
        },
        ccEmails
      );
    }
  } catch (err) {
    console.error('[FlagNotification] notifyFlagStatusChange error:', err.message);
  }
}

module.exports = {
  notifyFlagCreated,
  notifyChatMessage,
  notifyFlagStatusChange,
  resolveUser,
  resolveUsers,
};
