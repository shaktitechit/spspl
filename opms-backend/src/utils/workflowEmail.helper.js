/**
 * @fileoverview Unified workflow email dispatcher with frontend recipient and toggle support.
 * @module utils/workflowEmail.helper
 */
const { getModels } = require('../data/mongoRegistry');
const { shootAutoEmail, EMAIL_TEMPLATES } = require('./emailHelper');
const { logger } = require('../config/logger') || { logger: console };

function shouldSendWorkflowEmail(emailOptions) {
  if (!emailOptions || typeof emailOptions !== 'object') {
    return false; // Default is unticked/disabled
  }
  if (emailOptions.send_email === true || emailOptions.sendEmail === true) {
    return true;
  }
  return false;
}

function formatEmailDate(dateVal) {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function buildItemsRows(orderItems = []) {
  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    return '<tr><td colspan="3" class="text-center" style="padding: 12px; color: #64748b;">No items</td></tr>';
  }
  return orderItems
    .map((item) => {
      const name = item.product_name || item.name || 'Item';
      const qty = Number(item.ordered_quantity ?? item.quantity ?? 0) || 0;
      const free = Number(item.free_quantity ?? 0) || 0;
      return `<tr>
                <td class="font-semibold">${name}</td>
                <td class="text-center">${qty}</td>
                <td class="text-center">${free}</td>
              </tr>`;
    })
    .join('\n');
}

function priorityBadgeHtml(priority) {
  const p = String(priority || 'normal').toUpperCase();
  const cls =
    p === 'URGENT'
      ? 'badge-priority-urgent'
      : p === 'HIGH'
        ? 'badge-priority-high'
        : 'badge-priority-normal';
  return `<span class="${cls}">${p}</span>`;
}

/**
 * Dispatches automated email for workflow actions respecting user-controlled email options.
 * @param {object} params
 * @param {string|object} params.orderId - Order ID or Order document
 * @param {string} params.scope - Workflow scope/action identifier
 * @param {object} [params.emailOptions] - { send_email: boolean, recipients: string[], custom_note: string }
 * @param {object} [params.actorUser] - User triggering the action
 * @param {string} [params.remarks] - Action remarks or rejection reason
 * @param {object} [params.templateParamsOverride] - Optional overrides for templateParams
 */
async function sendWorkflowEmail({
  orderId,
  scope,
  emailOptions,
  actorUser,
  remarks,
  templateParamsOverride = {},
}) {
  if (!shouldSendWorkflowEmail(emailOptions)) {
    logger.info?.(`[workflowEmail] Skipped sending email for scope="${scope}" on order=${orderId} (disabled by user).`);
    return { sent: false, reason: 'disabled_by_user' };
  }

  const { Order, Party, User } = getModels();
  let orderDoc = typeof orderId === 'object' && orderId?._id ? orderId : null;
  if (!orderDoc) {
    orderDoc = await Order.findById(orderId).lean();
  }
  if (!orderDoc) {
    logger.warn?.(`[workflowEmail] Order not found for orderId=${orderId}`);
    return { sent: false, reason: 'order_not_found' };
  }

  const partyDoc = orderDoc.party ? await Party.findById(orderDoc.party).lean() : null;
  const salesUser = orderDoc.assigned_sales_user
    ? await User.findById(orderDoc.assigned_sales_user).lean()
    : null;

  const companyName = process.env.COMPANY_NAME || '';
  const orderNo = orderDoc.order_no || String(orderDoc._id);
  const customerName = partyDoc?.party_name || orderDoc.customer_name || 'Valued Customer';
  const orderDate = formatEmailDate(orderDoc.order_date);
  const expectedDeliveryDate = formatEmailDate(orderDoc.expected_delivery_date);
  const year = new Date().getFullYear();
  const priorityBadge = priorityBadgeHtml(orderDoc.priority);

  const customEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || '';
  const adminEmail = process.env.ADMIN_EMAIL || customEmail;
  const financeEmail = process.env.FINANCE_EMAIL || customEmail;
  const accountEmail = process.env.ACCOUNT_EMAIL || process.env.DUE_SHEET_EMAIL || customEmail;
  const dispatchEmail = process.env.DISPATCH_EMAIL || customEmail;
  const salesEmail = salesUser?.email || customEmail;

  // Determine template and default recipients based on scope (INTERNAL ONLY - NO AUTO SEND TO PARTY)
  let templateName = EMAIL_TEMPLATES.ORDER_UPDATE;
  let defaultRecipients = [];
  let subject = `Order #${orderNo} Update - ${companyName}`;

  switch (scope) {
    case 'submit':
    case 'submitted':
      templateName = EMAIL_TEMPLATES.ADMIN_APPROVAL_PENDING;
      defaultRecipients = [adminEmail, salesEmail].filter(Boolean);
      subject = `Action Required: Admin Approval Pending for Order #${orderNo}`;
      break;

    case 'admin_approve':
    case 'approved':
      // Admin approval triggers order confirmation internally
      templateName = EMAIL_TEMPLATES.ORDER_RECEIVED;
      defaultRecipients = [salesEmail, accountEmail].filter(Boolean);
      subject = `Order Confirmation - #${orderNo}`;
      break;

    case 'admin_reject':
    case 'finance_reject':
    case 'account_reject':
    case 'order_rejected':
    case 'finance_rejected':
    case 'account_rejected':
      templateName = EMAIL_TEMPLATES.ORDER_REJECTED;
      defaultRecipients = [salesEmail, adminEmail].filter(Boolean);
      subject = `Order #${orderNo} Update: Rejected`;
      break;

    case 'due_sheet':
    case 'due_sheet_uploaded':
      templateName = EMAIL_TEMPLATES.FINANCE_APPROVAL_PENDING;
      defaultRecipients = [financeEmail, salesEmail].filter(Boolean);
      subject = `Action Required: Finance Approval Pending for Order #${orderNo}`;
      break;

    case 'finance_approve':
    case 'finance_approved':
      templateName = EMAIL_TEMPLATES.ACCOUNT_APPROVAL_PENDING;
      defaultRecipients = [accountEmail, salesEmail, adminEmail].filter(Boolean);
      subject = `Action Required: Account Approval Pending for Order #${orderNo}`;
      break;

    case 'account_approve':
    case 'account_approved':
      templateName = EMAIL_TEMPLATES.DISPATCH_PENDING;
      defaultRecipients = [dispatchEmail, salesEmail].filter(Boolean);
      subject = `Action Required: Dispatch Pending for Order #${orderNo}`;
      break;

    case 'dispatch':
    case 'transport_pending':
      templateName = EMAIL_TEMPLATES.TRANSPORT_PENDING;
      defaultRecipients = [dispatchEmail, salesEmail].filter(Boolean);
      subject = `Transport Assignment Pending for Order #${orderNo}`;
      break;

    case 'in_transit':
      templateName = EMAIL_TEMPLATES.ORDER_UPDATE;
      defaultRecipients = [salesEmail, adminEmail].filter(Boolean);
      subject = `Order #${orderNo} Dispatched & In Transit`;
      break;

    case 'delivered':
      templateName = EMAIL_TEMPLATES.ORDER_DELIVERED;
      defaultRecipients = [accountEmail, salesEmail].filter(Boolean);
      subject = `Order #${orderNo} Successfully Delivered`;
      break;

    case 'on_hold':
      templateName = EMAIL_TEMPLATES.ORDER_ON_HOLD;
      defaultRecipients = [salesEmail, adminEmail].filter(Boolean);
      subject = `Order #${orderNo} Placed On Hold`;
      break;

    case 'cancelled':
      templateName = EMAIL_TEMPLATES.ORDER_CANCELLED;
      defaultRecipients = [salesEmail, adminEmail].filter(Boolean);
      subject = `Order #${orderNo} Cancelled`;
      break;

    default:
      templateName = EMAIL_TEMPLATES.ORDER_UPDATE;
      defaultRecipients = [salesEmail, adminEmail].filter(Boolean);
      subject = `Order #${orderNo} Status Updated`;
      break;
  }

  // Party / Client policy: strictly NO AUTO SEND TO PARTY unless explicitly requested
  const sendToParty = Boolean(emailOptions?.send_to_party || emailOptions?.sendToParty);

  // Collect all known emails belonging to the customer/party
  const knownPartyEmails = new Set();
  if (partyDoc?.email) {
    knownPartyEmails.add(partyDoc.email.trim().toLowerCase());
  }
  if (Array.isArray(partyDoc?.contacts)) {
    partyDoc.contacts.forEach((c) => {
      if (c?.email) knownPartyEmails.add(c.email.trim().toLowerCase());
    });
  }

  // Recipient resolution: prefer explicit user-chosen recipients
  const explicitRecipients =
    Array.isArray(emailOptions?.recipients) && emailOptions.recipients.length > 0
      ? emailOptions.recipients
      : null;

  let targetRecipients = explicitRecipients ? [...explicitRecipients] : [...defaultRecipients];

  if (!sendToParty) {
    // Strictly strip out all party emails when send_to_party is false
    targetRecipients = targetRecipients.filter(
      (em) => !knownPartyEmails.has(String(em).trim().toLowerCase())
    );
  } else {
    // When send_to_party is true: if no party email is currently in targetRecipients, add partyDoc.email and/or party contact emails
    const hasAnyPartyInTarget = targetRecipients.some((em) =>
      knownPartyEmails.has(String(em).trim().toLowerCase())
    );
    if (!hasAnyPartyInTarget) {
      if (partyDoc?.email) {
        targetRecipients.push(partyDoc.email.trim());
      }
      if (Array.isArray(partyDoc?.contacts)) {
        partyDoc.contacts.forEach((c) => {
          if (c?.email && !targetRecipients.includes(c.email.trim())) {
            targetRecipients.push(c.email.trim());
          }
        });
      }
    }
  }

  // Deduplicate and filter non-empty
  targetRecipients = Array.from(new Set(targetRecipients.filter(Boolean)));

  if (!targetRecipients || targetRecipients.length === 0) {
    logger.warn?.(`[workflowEmail] No recipients resolved for order=${orderNo}, scope=${scope}`);
    return { sent: false, reason: 'no_recipients' };
  }

  const baseParams = {
    subject,
    companyName,
    orderNo,
    customerName,
    orderDate,
    expectedDeliveryDate,
    priorityBadge,
    itemsRows: buildItemsRows(orderDoc.order_items),
    shippingAddress: partyDoc ? [partyDoc.address, partyDoc.city, partyDoc.state, partyDoc.pincode].filter(Boolean).join(', ') : '',
    remarks: remarks || emailOptions?.custom_note || orderDoc.remarks || '',
    holdReason: remarks || emailOptions?.custom_note || orderDoc.remarks || 'Verification in progress',
    cancellationReason: remarks || emailOptions?.custom_note || orderDoc.remarks || 'Order cancelled',
    rejectionReason: remarks || emailOptions?.custom_note || orderDoc.remarks || 'Order rejected',
    deliveryDate: expectedDeliveryDate,
    receivedBy: partyDoc?.contact_person || customerName || 'Authorized Recipient',
    trackingNo: orderDoc.tracking_number || orderDoc.docket_number || orderDoc.lr_number || 'N/A',
    docketNo: orderDoc.tracking_number || orderDoc.docket_number || orderDoc.lr_number || 'N/A',
    actionBy: actorUser?.name || 'Authorized User',
    year,
    ...templateParamsOverride,
  };

  try {
    await shootAutoEmail({
      recipient: targetRecipients,
      templateName,
      templateParams: baseParams,
    });
    logger.info?.(
      `[workflowEmail] Sent workflow email (${templateName}) for order=${orderNo} to ${targetRecipients.join(', ')}`
    );
    return { sent: true, templateName, recipients: targetRecipients };
  } catch (err) {
    logger.error?.(
      `[workflowEmail] Failed to send email (${templateName}) for order=${orderNo}: ${err.message}`
    );
    return { sent: false, error: err.message };
  }
}

module.exports = {
  shouldSendWorkflowEmail,
  sendWorkflowEmail,
};
