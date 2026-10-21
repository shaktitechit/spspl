/**
 * Paginated order list.
 *
 * Tab membership matches the frontend exclusive buckets in
 * `orderWorkflowTabs.ts` / `orderUtils.ts` (draft → terminal → closed →
 * in transit → transport pending → approvals → dispatch pending).
 * Approval and due-sheet flags are attached before classification.
 * Transports, flags, and line items are loaded only for the page returned.
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { applyDerivedPriorityToOrder } = require('./order.constants');
const {
  enrichOrdersWithApprovalPending,
  enrichOrdersWithDueSheetStatus,
  enrichOrdersParallel,
} = require('./orderApprovalPending.util');

const WORKFLOW_TABS = [
  'all',
  'draft',
  'pending_admin_approval',
  'due_sheet_pending',
  'pending_finance_approval',
  'pending_account_approval',
  'open_dispatched',
  'transport_pending',
  'in_transit',
  'closed_delivered',
  'on_hold',
  'cancelled',
  'rejected',
];

const TRANSPORT_PENDING_STATUSES = new Set(['dispatch_created', 'transport_pending']);
const IN_TRANSIT_STATUSES = new Set([
  'transport_assigned',
  'partially_transported',
  'fully_transported',
  'in_transit',
]);
const IN_TRANSIT_ACTIONS = new Set([
  'partially_transported',
  'fully_transported',
  'transporter_assigned',
  'vehicle_assigned',
  'picked_up',
  'in_transit',
  'out_for_delivery',
]);
const ADMIN_CLEARED_STATUS = new Set(['approved', 'full', 'sent_to_finance']);
const ACCOUNT_CLEARED_STATUS = new Set(['approved', 'full', 'partial']);
const PARTIAL_OR_PENDING = new Set(['pending', 'partial', '']);
const POST_ADMIN_STATUSES = new Set([
  'sales_approved',
  'finance_review',
  'finance_approved',
  'partially_finance_approved',
  'fully_finance_approved',
  'account_review',
  'account_approved',
  'partially_account_approved',
  'fully_account_approved',
  'dispatch',
  'dispatch_pending',
  'dispatch_created',
  'in_transit',
  'transport_pending',
  'transport_assigned',
  'partially_transported',
  'fully_transported',
  'delivered',
  'closed',
]);
const PRE_FINANCE_STATUSES = new Set([
  'draft',
  'submitted',
  'pending_review',
  'sales_approved',
  'finance_review',
]);
const POST_FINANCE_STATUSES = new Set([
  'finance_approved',
  'partially_finance_approved',
  'fully_finance_approved',
  'account_review',
  'account_approved',
  'partially_account_approved',
  'fully_account_approved',
  'dispatch',
  'dispatch_pending',
  'dispatch_created',
  'in_transit',
  'transport_pending',
  'transport_assigned',
  'partially_transported',
  'fully_transported',
  'delivered',
  'closed',
]);

const CURRENT_ACTION_TO_STATUS = {
  drafted: 'draft',
  submitted: 'submitted',
  approved: 'sales_approved',
  review_requested: 'finance_review',
  fully_approved: 'fully_finance_approved',
  finance_approved: 'fully_finance_approved',
  finance_partial: 'partially_finance_approved',
  partially_finance_approved: 'partially_finance_approved',
  fully_finance_approved: 'fully_finance_approved',
  sent_to_account: 'account_review',
  account_partial: 'partially_account_approved',
  account_approved: 'fully_account_approved',
  partially_account_approved: 'partially_account_approved',
  fully_account_approved: 'fully_account_approved',
  rejected: 'finance_rejected',
  sent_to_dispatch: 'dispatch_pending',
  partial_dispatch: 'dispatch_created',
  full_dispatch: 'dispatch_created',
  partially_transported: 'partially_transported',
  fully_transported: 'fully_transported',
  transporter_assigned: 'transport_assigned',
  vehicle_assigned: 'transport_assigned',
  picked_up: 'in_transit',
  in_transit: 'in_transit',
  out_for_delivery: 'in_transit',
  delivered: 'delivered',
  return_logged: 'dispatch_created',
  delivery_failed: 'partially_transported',
  returned: 'partially_transported',
  cancelled: 'cancelled',
  hold: 'on_hold',
};

const SLIM_SELECT = [
  '_id',
  'order_no',
  'order_number',
  'order_date',
  'expected_delivery_date',
  'createdAt',
  'priority',
  'party',
  'status',
  'lifecycle_status',
  'workflow_stage',
  'current_action',
  'dispatch_status',
  'delivery_status',
  'closed_at',
  'admin_approval_status',
  'finance_approval_status',
  'account_approval_status',
  'is_admin_approved',
  'is_finance_approved',
  'is_account_approved',
  'is_due_sheet_uploaded',
  'last_admin_approval',
  'last_finance_approval',
  'last_account_approval',
].join(' ');

const PAGE_SELECT = [
  '_id',
  'order_no',
  'order_number',
  'order_date',
  'expected_delivery_date',
  'billing_date',
  'dispatched_at',
  'dispatch_date',
  'priority',
  'delivery_priority',
  'party',
  'customer',
  'lead',
  'assigned_sales_user',
  'lifecycle_status',
  'workflow_stage',
  'status',
  'current_action',
  'current_department',
  'pending_with_role',
  'admin_approval_status',
  'finance_approval_status',
  'account_approval_status',
  'allocation_status',
  'dispatch_status',
  'delivery_status',
  'payment_status',
  'billing_status',
  'subtotal',
  'discount_amount',
  'taxable_amount',
  'gst_amount',
  'grand_total',
  'has_open_flags',
  'open_flag_count',
  'highest_flag_severity',
  'closed_at',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'order_items',
].join(' ');

function refId(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return String(value._id ?? value.id ?? '');
  return String(value);
}

function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/** Mirrors frontend `deriveOrderWorkflowStatus`. */
function deriveOrderWorkflowStatus(order) {
  if (!order || typeof order !== 'object') return '';
  const legacyStatus = typeof order.status === 'string' ? order.status.trim() : '';
  const lifecycle = typeof order.lifecycle_status === 'string' ? order.lifecycle_status : '';
  const stage = typeof order.workflow_stage === 'string' ? order.workflow_stage : '';
  const action = typeof order.current_action === 'string' ? order.current_action : '';
  const dispatchStatus = typeof order.dispatch_status === 'string' ? order.dispatch_status : '';
  const deliveryStatus = typeof order.delivery_status === 'string' ? order.delivery_status : '';
  const hasWorkflowFields = Boolean(lifecycle || stage || action);

  if (legacyStatus === 'dispatch_pending') return 'dispatch_pending';
  if (!hasWorkflowFields && legacyStatus) return legacyStatus;
  if (lifecycle === 'cancelled' || stage === 'cancelled') return 'cancelled';
  if (lifecycle === 'on_hold' || stage === 'hold') return 'on_hold';
  if (String(order.status || '') === 'closed' || order.closed_at) return 'closed';
  if (deliveryStatus === 'completed' || lifecycle === 'fulfilled') return 'delivered';
  if (
    legacyStatus === 'in_transit' ||
    legacyStatus === 'delivered' ||
    legacyStatus === 'closed' ||
    legacyStatus === 'partially_transported' ||
    legacyStatus === 'fully_transported' ||
    legacyStatus === 'transport_assigned' ||
    legacyStatus === 'transport_pending'
  ) {
    return legacyStatus;
  }
  if (action && CURRENT_ACTION_TO_STATUS[action]) return CURRENT_ACTION_TO_STATUS[action];
  if (
    legacyStatus === 'finance_approved' ||
    legacyStatus === 'fully_finance_approved' ||
    legacyStatus === 'partially_finance_approved' ||
    legacyStatus === 'account_review' ||
    legacyStatus === 'account_approved' ||
    legacyStatus === 'fully_account_approved' ||
    legacyStatus === 'partially_account_approved'
  ) {
    return legacyStatus === 'finance_approved' ? 'fully_finance_approved' : legacyStatus;
  }
  if (stage === 'sales') return lifecycle === 'draft' ? 'draft' : 'finance_rejected';
  if (stage === 'admin_review') return 'submitted';
  if (stage === 'finance_review') return 'finance_review';
  if (stage === 'account_review') return 'account_review';
  if (stage === 'dispatch' || stage === 'dispatch_review') {
    if (
      legacyStatus === 'dispatch' ||
      legacyStatus === 'dispatch_pending' ||
      legacyStatus === 'dispatch_created'
    ) {
      if (action === 'partial_dispatch' || action === 'full_dispatch') return 'dispatch_created';
      if (action === 'dispatch_created') return 'dispatch_created';
      if (action === 'sent_to_dispatch') return 'dispatch_pending';
      if (dispatchStatus === 'completed' || dispatchStatus === 'partial') return 'dispatch_created';
      if (legacyStatus === 'dispatch_created') return 'dispatch_created';
      return legacyStatus === 'dispatch' ? 'dispatch_pending' : legacyStatus || 'dispatch_pending';
    }
    if (action === 'sent_to_dispatch') return 'dispatch_pending';
    if (action === 'partially_account_approved') return 'partially_account_approved';
    if (action === 'fully_account_approved') return 'fully_account_approved';
    const aas = typeof order.account_approval_status === 'string' ? order.account_approval_status : '';
    if (aas === 'partial') return 'partially_account_approved';
    if (aas === 'full' || aas === 'approved') return 'fully_account_approved';
    const fas = typeof order.finance_approval_status === 'string' ? order.finance_approval_status : '';
    if (fas === 'partial') return 'partially_finance_approved';
    if (fas === 'full' || fas === 'approved') return 'fully_finance_approved';
    if (action === 'partially_finance_approved' || action === 'finance_partial') {
      return 'partially_finance_approved';
    }
    if (action === 'fully_finance_approved' || action === 'finance_approved') {
      return 'fully_finance_approved';
    }
    if (legacyStatus === 'finance_approved') return 'fully_finance_approved';
    return 'fully_finance_approved';
  }
  if (stage === 'dispatch_execution') {
    if (dispatchStatus === 'completed' || dispatchStatus === 'partial') return 'dispatch_created';
    return 'partially_transported';
  }
  if (stage === 'completed') return 'delivered';
  return legacyStatus || lifecycle || '';
}

function isOrderClosed(order) {
  if (order.closed_at != null && order.closed_at !== '') return true;
  return String(order.status || '').toLowerCase() === 'closed';
}

function isOrderDelivered(order) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'delivered') return true;
  const deliveryStatus = String(order.delivery_status || '').toLowerCase();
  const lifecycle = String(order.lifecycle_status || '').toLowerCase();
  return deliveryStatus === 'completed' || lifecycle === 'fulfilled';
}

function isFulfillmentComplete(order) {
  if (isOrderClosed(order) || isOrderDelivered(order)) return true;
  const legacyStatus = String(order.status || '').toLowerCase();
  return legacyStatus === 'delivered' || legacyStatus === 'closed';
}

function readApprovalPending(row) {
  const pending = row.approval_pending;
  if (!pending || typeof pending !== 'object') return null;
  if (!('admin' in pending) && !('finance' in pending) && !('account' in pending) && !('stage' in pending)) {
    return null;
  }
  const stageRaw = String(pending.stage || '').toLowerCase();
  const stage = stageRaw === 'admin' || stageRaw === 'finance' || stageRaw === 'account' ? stageRaw : null;
  return {
    admin: Boolean(pending.admin),
    finance: Boolean(pending.finance),
    account: Boolean(pending.account),
    stage,
  };
}

function isAdminCleared(row) {
  const enriched = readApprovalPending(row);
  if (enriched?.admin) return false;
  if (row.is_admin_approved === true) return true;
  const status = deriveOrderWorkflowStatus(row);
  const adminStatus = String(row.admin_approval_status || 'pending').toLowerCase();
  if (ADMIN_CLEARED_STATUS.has(adminStatus)) return true;
  if (status === 'draft' || status === 'submitted' || status === 'pending_review') return false;
  if (POST_ADMIN_STATUSES.has(status)) return true;
  return !PARTIAL_OR_PENDING.has(adminStatus);
}

function isDueSheetStageCleared(row) {
  if (isTruthyFlag(row.due_sheet_uploaded) || isTruthyFlag(row.is_due_sheet_uploaded)) return true;
  for (const key of ['last_admin_approval', 'last_finance_approval', 'last_account_approval']) {
    const ref = row[key];
    if (ref && typeof ref === 'object' && isTruthyFlag(ref.is_due_sheet_uploaded)) return true;
  }
  return false;
}

function isFinanceCleared(row) {
  const status = deriveOrderWorkflowStatus(row);
  const enriched = readApprovalPending(row);
  if (enriched && row.approval_pending && 'finance' in row.approval_pending) {
    if (enriched.finance) return false;
    if (enriched.account) return true;
  }
  if (PRE_FINANCE_STATUSES.has(status)) return false;
  if (row.is_finance_approved === true) return true;
  if (POST_FINANCE_STATUSES.has(status)) return true;
  if (enriched && !enriched.finance && isAdminCleared(row)) return true;
  return false;
}

function isAccountCleared(row) {
  const status = deriveOrderWorkflowStatus(row);
  const enriched = readApprovalPending(row);
  if (enriched?.account) return false;
  if (!isFinanceCleared(row)) return false;
  if (row.is_account_approved === true) return true;
  const accountStatus = String(row.account_approval_status || 'pending').toLowerCase();
  if (ACCOUNT_CLEARED_STATUS.has(accountStatus)) return true;
  const postAccountStatus =
    status === 'account_approved' ||
    status === 'fully_account_approved' ||
    status === 'partially_account_approved' ||
    status === 'dispatch' ||
    status === 'dispatch_pending' ||
    status === 'dispatch_created' ||
    status === 'in_transit' ||
    status.startsWith('transport') ||
    status === 'delivered' ||
    status === 'closed';
  if (postAccountStatus) return true;
  if (
    enriched &&
    !enriched.admin &&
    !enriched.finance &&
    !enriched.account &&
    enriched.stage === null
  ) {
    if (row.last_account_approval != null && row.last_account_approval !== '') return true;
    if (status === 'account_review') return true;
    if (!PRE_FINANCE_STATUSES.has(status)) return true;
  }
  return false;
}

function isDueSheetPending(row) {
  const status = deriveOrderWorkflowStatus(row);
  if (status === 'draft' || status === 'on_hold' || status === 'cancelled') return false;
  if (status === 'finance_rejected' || status === 'account_rejected') return false;
  if (isFulfillmentComplete(row)) return false;
  if (!isAdminCleared(row)) return false;
  if (isDueSheetStageCleared(row)) return false;
  return true;
}

function orderHasTransportCreated(order, options) {
  const orderId = refId(order._id ?? order.id);
  if (orderId && options.transportCreatedOrderIds.has(orderId)) return true;
  if (orderId && options.activeTransportOrderIds.has(orderId)) return true;
  if (orderId && options.dispatchTransportOrderIds.has(orderId)) return true;
  const status = deriveOrderWorkflowStatus(order);
  if (IN_TRANSIT_STATUSES.has(status)) return true;
  const legacyStatus = String(order.status || '').toLowerCase();
  if (legacyStatus === 'in_transit' || IN_TRANSIT_STATUSES.has(legacyStatus)) return true;
  const action = String(order.current_action || '').toLowerCase();
  return IN_TRANSIT_ACTIONS.has(action);
}

function isInTransitOrder(order, options) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'on_hold' || status === 'cancelled' || status === 'finance_rejected') return false;
  if (isFulfillmentComplete(order)) return false;
  const orderId = refId(order._id ?? order.id);
  if (orderId && options.activeTransportOrderIds.has(orderId)) return true;
  if (IN_TRANSIT_STATUSES.has(status)) return true;
  const legacyStatus = String(order.status || '').toLowerCase();
  if (legacyStatus === 'in_transit' || IN_TRANSIT_STATUSES.has(legacyStatus)) return true;
  const action = String(order.current_action || '').toLowerCase();
  if (IN_TRANSIT_ACTIONS.has(action)) return true;
  if (orderId && options.dispatchTransportOrderIds.has(orderId)) {
    const onlyFinishedShipments =
      options.transportCreatedOrderIds.has(orderId) &&
      !options.activeTransportOrderIds.has(orderId);
    if (!onlyFinishedShipments) return true;
  }
  return false;
}

function isTransportPending(order, options) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'on_hold' || status === 'cancelled' || status === 'finance_rejected') return false;
  if (isFulfillmentComplete(order)) return false;
  if (isInTransitOrder(order, options)) return false;
  if (orderHasTransportCreated(order, options)) return false;
  const orderId = refId(order._id ?? order.id);
  if (orderId && options.submittedDispatchOrderIds.has(orderId)) return true;
  if (TRANSPORT_PENDING_STATUSES.has(status)) return true;
  if (!isAccountCleared(order)) return false;
  const dispatchStatus = String(order.dispatch_status || '').toLowerCase();
  return dispatchStatus === 'partial' || dispatchStatus === 'completed';
}

function isDispatchPending(order, options) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'draft' || status === 'on_hold') return false;
  if (status === 'cancelled' || status === 'finance_rejected' || status === 'account_rejected') return false;
  if (isFulfillmentComplete(order)) return false;
  if (isInTransitOrder(order, options)) return false;
  if (isTransportPending(order, options)) return false;
  if (!isAdminCleared(order)) return false;
  if (!isDueSheetStageCleared(order)) return false;
  if (!isFinanceCleared(order)) return false;
  if (!isAccountCleared(order)) return false;
  return true;
}

function resolveApprovalPending(row) {
  const status = deriveOrderWorkflowStatus(row);
  if (status === 'draft') return { admin: false, finance: false, account: false, stage: null };
  if (!isAdminCleared(row)) return { admin: true, finance: false, account: false, stage: 'admin' };
  if (!isDueSheetStageCleared(row)) return { admin: false, finance: false, account: false, stage: null };
  if (!isFinanceCleared(row)) return { admin: false, finance: true, account: false, stage: 'finance' };
  if (!isAccountCleared(row)) return { admin: false, finance: false, account: true, stage: 'account' };
  return { admin: false, finance: false, account: false, stage: null };
}

function getOrderWorkflowTabCategory(order, options) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'draft') return null;
  if (status === 'on_hold') return 'on_hold';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'finance_rejected' || status === 'account_rejected') return 'rejected';
  if (isFulfillmentComplete(order)) return 'closed_delivered';

  const orderId = refId(order._id ?? order.id);
  const hasShipmentHistory = !!orderId && options.transportCreatedOrderIds.has(orderId);
  const hasActiveTransport = !!orderId && options.activeTransportOrderIds.has(orderId);
  if (hasShipmentHistory && !hasActiveTransport && !isInTransitOrder(order, options)) {
    return 'closed_delivered';
  }
  if (isInTransitOrder(order, options)) return 'in_transit';
  if (isTransportPending(order, options)) return 'transport_pending';

  const pending = resolveApprovalPending(order);
  if (pending.admin) return 'pending_admin_approval';
  if (isDueSheetPending(order)) return 'due_sheet_pending';
  if (pending.finance) return 'pending_finance_approval';
  if (pending.account) return 'pending_account_approval';
  if (isDispatchPending(order, options)) return 'open_dispatched';
  return null;
}

function classifyOrder(order, options, salesTabs) {
  const status = deriveOrderWorkflowStatus(order);
  if (status === 'draft') return 'draft';
  const cat = getOrderWorkflowTabCategory(order, options);
  if (salesTabs && !cat) return 'open_dispatched';
  return cat;
}

function emptyTabCounts() {
  return Object.fromEntries(WORKFLOW_TABS.map((id) => [id, 0]));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Workflow context for a specific set of orders, not the whole collections.
 */
async function loadWorkflowContextForOrders(orderIds) {
  const { TransportShipment, OrderDispatch } = getModels();
  const ids = (orderIds || []).filter(Boolean);
  if (!ids.length) {
    const empty = new Set();
    return {
      activeTransportOrderIds: empty,
      transportCreatedOrderIds: empty,
      dispatchTransportOrderIds: empty,
      submittedDispatchOrderIds: empty,
    };
  }
  const orderFilter = { deletedAt: null, order: { $in: ids } };
  const [active, created, dispatchTransport, submitted] = await Promise.all([
    TransportShipment
      ? TransportShipment.distinct('order', {
          ...orderFilter,
          shipment_status: { $nin: ['returned', 'cancelled', 'delivery_failed', 'delivered'] },
        })
      : [],
    TransportShipment
      ? TransportShipment.distinct('order', {
          ...orderFilter,
          shipment_status: { $nin: ['returned', 'cancelled'] },
        })
      : [],
    OrderDispatch
      ? OrderDispatch.distinct('order', {
          ...orderFilter,
          dispatch_status: 'transport_created',
        })
      : [],
    OrderDispatch
      ? OrderDispatch.distinct('order', {
          ...orderFilter,
          dispatch_status: 'submitted',
        })
      : [],
  ]);
  const toSet = (rows) => new Set((rows || []).map((id) => String(id)));
  return {
    activeTransportOrderIds: toSet(active),
    transportCreatedOrderIds: toSet(created),
    dispatchTransportOrderIds: toSet(dispatchTransport),
    submittedDispatchOrderIds: toSet(submitted),
  };
}

/** Classify one order and store process_stage. Does not re-enter save hooks. */
async function refreshOrderProcessStage(orderId) {
  if (!orderId) return null;
  const models = getModels();
  const row = await models.Order.findById(orderId).select(SLIM_SELECT).lean();
  if (!row || row.deletedAt) return null;

  const context = await loadWorkflowContextForOrders([row._id]);
  const [withApproval] = await enrichOrdersWithApprovalPending([row], models);
  const [withDueSheet] = await enrichOrdersWithDueSheetStatus([withApproval], models);
  const uploaded =
    Boolean(withDueSheet.due_sheet_uploaded) || Boolean(withApproval.is_due_sheet_uploaded);
  const enriched = applyDerivedPriorityToOrder({
    ...withApproval,
    ...withDueSheet,
    due_sheet_uploaded: uploaded,
    is_due_sheet_uploaded: uploaded,
  });
  const stage = classifyOrder(enriched, context, false);
  await models.Order.updateOne(
    { _id: row._id },
    { $set: { process_stage: stage } },
    { runValidators: false },
  );
  return stage;
}

async function bulkWriteProcessStages(classified) {
  const ops = [];
  for (const item of classified) {
    const id = item.row && item.row._id;
    if (!id) continue;
    ops.push({
      updateOne: {
        filter: { _id: id },
        update: { $set: { process_stage: item.tab || null } },
      },
    });
  }
  if (!ops.length) return { matched: 0, modified: 0 };
  let matched = 0;
  let modified = 0;
  const BATCH = 500;
  for (let i = 0; i < ops.length; i += BATCH) {
    const result = await getModels().Order.collection.bulkWrite(ops.slice(i, i + BATCH), {
      ordered: false,
    });
    matched += result.matchedCount ?? result.nMatched ?? 0;
    modified += result.modifiedCount ?? result.nModified ?? 0;
  }
  return { matched, modified };
}

/** Classify and persist process_stage for orders in scope that are still unstaged. */
async function ensureProcessStagesForScope(scopeQuery, salesTabs) {
  const staleFilter = {
    $and: [
      scopeQuery,
      { $or: [{ process_stage: null }, { process_stage: { $exists: false } }] },
    ],
  };
  const staleCount = await getModels().Order.countDocuments(staleFilter);
  if (!staleCount) return { updated: 0 };

  const { classified } = await computeVisibleOrders(scopeQuery, salesTabs);
  const result = await bulkWriteProcessStages(classified);
  return { updated: result.modified };
}

/** One-time (re-runnable) write of process_stage for existing orders. */
async function backfillProcessStages() {
  const { classified } = await computeVisibleOrders({}, false);
  return bulkWriteProcessStages(classified);
}

async function partyIdsForSearch(search) {
  const regex = new RegExp(escapeRegex(search), 'i');
  const parties = await getModels()
    .Party.find({
      $or: [
        { party_name: regex },
        { contact_person: regex },
        { legal_name: regex },
        { trade_name: regex },
        { name: regex },
      ],
    })
    .select('_id')
    .limit(200)
    .lean();
  return parties.map((party) => party._id);
}

function stageListFilter(scopeQuery, query) {
  const salesTabs = query.sales_tabs === 'true' || query.sales_tabs === true;
  const filter = { ...scopeQuery };
  const and = [];
  const tab = String(query.tab || '').trim();
  const search = String(query.search || '').trim();

  if (tab && tab.toLowerCase() !== 'all') {
    filter.process_stage = tab;
  } else if (!salesTabs) {
    filter.process_stage = { $nin: ['draft', null] };
  }

  if (query.priority && String(query.priority).toLowerCase() !== 'all') {
    filter.priority = String(query.priority).toLowerCase();
  }

  const from = query.dateFrom ? new Date(query.dateFrom) : null;
  const to = query.dateTo ? new Date(query.dateTo) : null;
  const hasFrom = from && !Number.isNaN(from.getTime());
  const hasTo = to && !Number.isNaN(to.getTime());
  if (hasFrom || hasTo) {
    const checks = [];
    if (hasFrom) checks.push({ $gte: ['$$d', from] });
    if (hasTo) checks.push({ $lte: ['$$d', to] });
    and.push({
      $expr: {
        $let: {
          vars: { d: { $ifNull: ['$order_date', '$createdAt'] } },
          in: { $and: checks },
        },
      },
    });
  }

  if (and.length) filter.$and = [...(filter.$and || []), ...and];
  return { filter, salesTabs, search, tab };
}

async function countProcessStages(scopeQuery, salesTabs) {
  await ensureProcessStagesForScope(scopeQuery, salesTabs);
  const match = { ...scopeQuery };
  if (!salesTabs) {
    match.process_stage = { $nin: ['draft', null] };
  }
  const rows = await getModels().Order.aggregate([
    { $match: match },
    { $group: { _id: '$process_stage', count: { $sum: 1 } } },
  ]);
  const tabCounts = emptyTabCounts();
  let scopeTotal = 0;
  for (const row of rows) {
    const id = row._id;
    const count = row.count || 0;
    if (!id || tabCounts[id] == null) continue;
    tabCounts[id] = count;
    scopeTotal += count;
  }
  tabCounts.all = scopeTotal;
  return { tabCounts, scopeTotal };
}

async function loadWorkflowContext() {
  const { TransportShipment, OrderDispatch } = getModels();
  const [active, created, dispatchTransport, submitted] = await Promise.all([
    TransportShipment
      ? TransportShipment.distinct('order', {
          deletedAt: null,
          shipment_status: { $nin: ['returned', 'cancelled', 'delivery_failed', 'delivered'] },
        })
      : [],
    TransportShipment
      ? TransportShipment.distinct('order', {
          deletedAt: null,
          shipment_status: { $nin: ['returned', 'cancelled'] },
        })
      : [],
    OrderDispatch
      ? OrderDispatch.distinct('order', {
          deletedAt: null,
          dispatch_status: 'transport_created',
        })
      : [],
    OrderDispatch
      ? OrderDispatch.distinct('order', {
          deletedAt: null,
          dispatch_status: 'submitted',
        })
      : [],
  ]);
  const toSet = (ids) => new Set((ids || []).map((id) => String(id)));
  return {
    activeTransportOrderIds: toSet(active),
    transportCreatedOrderIds: toSet(created),
    dispatchTransportOrderIds: toSet(dispatchTransport),
    submittedDispatchOrderIds: toSet(submitted),
  };
}

const INDEX_TTL_MS = 20_000;
const indexCache = new Map();
const indexInflight = new Map();

function stableValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof value.toHexString === 'function') return String(value);
  if (Array.isArray(value)) return value.map(stableValue);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stableValue(value[key]);
    return out;
  }
  return value;
}

async function computeVisibleOrders(scopeQuery, salesTabs) {
  const models = getModels();
  const [rows, context] = await Promise.all([
    models.Order.find(scopeQuery).select(SLIM_SELECT).sort({ createdAt: -1 }).lean(),
    loadWorkflowContext(),
  ]);

  const [withApproval, withDueSheet] = await Promise.all([
    enrichOrdersWithApprovalPending(rows, models),
    enrichOrdersWithDueSheetStatus(rows, models),
  ]);
  const enriched = withApproval.map((row, index) => {
    const due = withDueSheet[index] || {};
    const uploaded = Boolean(due.due_sheet_uploaded) || Boolean(row.is_due_sheet_uploaded);
    return {
      ...row,
      due_sheet_uploaded: uploaded,
      is_due_sheet_uploaded: uploaded,
    };
  });

  const classified = enriched.map((row) => {
    const withPriority = applyDerivedPriorityToOrder(row);
    return {
      row: withPriority,
      tab: classifyOrder(withPriority, context, salesTabs),
    };
  });

  const tabCounts = emptyTabCounts();
  let scopeTotal = 0;
  for (const item of classified) {
    const status = deriveOrderWorkflowStatus(item.row);
    if (!salesTabs && status === 'draft') continue;
    scopeTotal += 1;
    tabCounts.all += 1;
    if (item.tab && item.tab !== 'all' && tabCounts[item.tab] != null) {
      tabCounts[item.tab] += 1;
    }
  }

  return { classified, tabCounts, scopeTotal };
}

async function indexVisibleOrders(scopeQuery, salesTabs) {
  const key = `${salesTabs ? 1 : 0}:${JSON.stringify(stableValue(scopeQuery))}`;
  const now = Date.now();
  const hit = indexCache.get(key);
  if (hit && hit.expires > now) return hit.value;

  const pending = indexInflight.get(key);
  if (pending) return pending;

  const job = computeVisibleOrders(scopeQuery, salesTabs)
    .then((value) => {
      indexCache.set(key, { expires: Date.now() + INDEX_TTL_MS, value });
      if (indexCache.size > 24) {
        const oldest = indexCache.keys().next().value;
        indexCache.delete(oldest);
      }
      return value;
    })
    .finally(() => {
      indexInflight.delete(key);
    });
  indexInflight.set(key, job);
  return job;
}

function partyLabel(party, namesById) {
  if (party && typeof party === 'object') {
    const embedded = party.party_name || party.contact_person || party.name || '';
    if (String(embedded).trim()) return String(embedded);
  }
  const id = refId(party);
  return namesById.get(id) || '';
}

async function partyNamesForRows(rows) {
  const ids = [];
  for (const row of rows) {
    const id = refId(row.party);
    if (id && mongoose.Types.ObjectId.isValid(id)) ids.push(id);
  }
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const parties = await getModels()
    .Party.find({ _id: { $in: unique } })
    .select('party_name contact_person legal_name trade_name name')
    .lean();
  const map = new Map();
  for (const party of parties) {
    const label =
      party.party_name ||
      party.contact_person ||
      party.legal_name ||
      party.trade_name ||
      party.name ||
      '';
    if (label) map.set(String(party._id), String(label));
  }
  return map;
}

function matchesSearch(row, query, namesById) {
  const ref = String(row.order_no || row.order_number || row._id || '').toLowerCase();
  if (ref.includes(query)) return true;
  const party = partyLabel(row.party, namesById).toLowerCase();
  return party.includes(query);
}

function matchesDate(row, from, to) {
  const raw = row.order_date ?? row.createdAt;
  const d = raw ? new Date(raw) : null;
  if (!d || Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function lineId(ref) {
  if (typeof ref === 'string') return ref.trim();
  if (ref && typeof ref === 'object') return String(ref._id ?? ref.id ?? '').trim();
  return '';
}

function isKitShell(line, allLines) {
  if (!line || lineId(line.kit_parent_product)) return false;
  if (String(line.product_type || '').toLowerCase() === 'kit') return true;
  if (
    line.product &&
    typeof line.product === 'object' &&
    String(line.product.product_type || '').toLowerCase() === 'kit'
  ) {
    return true;
  }
  const productId = lineId(line.product);
  if (!productId) return false;
  return allLines.some((other) => lineId(other.kit_parent_product) === productId);
}

function summarizeOrder(order) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const status = deriveOrderWorkflowStatus(order);
  const isApproved =
    status !== 'draft' &&
    status !== 'submitted' &&
    status !== 'cancelled' &&
    status !== 'finance_rejected' &&
    status !== 'rejected' &&
    status !== 'on_hold';

  let itemQuantity = 0;
  let kitQuantity = 0;
  let lineAmount = 0;
  for (const line of items) {
    const q = isApproved
      ? num(line.approved_quantity)
      : num(line.ordered_quantity ?? line.quantity);
    if (q !== 0) {
      if (isKitShell(line, items)) kitQuantity += q;
      else itemQuantity += q;
    }
    if (lineId(line.kit_parent_product)) continue;
    const qty = num(line.approved_quantity);
    if (qty === 0) continue;
    const unitPrice = num(line.unit_price ?? line.approved_unit_price ?? line.rate);
    const gstPct = num(line.gst_percent ?? line.tax_percent);
    lineAmount += qty * unitPrice * (1 + gstPct / 100);
  }
  return {
    item_quantity: itemQuantity,
    kit_quantity: kitQuantity,
    line_amount: lineAmount,
  };
}

async function loadPageDocuments(ids) {
  if (!ids.length) return [];
  const rows = await getModels()
    .Order.find({ _id: { $in: ids } })
    .select(PAGE_SELECT)
    .populate('party', 'name code sra sra_from_date legal_name trade_name party_name')
    .populate('assigned_sales_user', 'name username email department')
    .populate('order_items.product', 'name product_name sku')
    .lean();
  const byId = new Map(rows.map((row) => [String(row._id), row]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

/**
 * One page of list rows plus tab badge counts for the caller's visible orders.
 * Counts ignore search, priority, and date — same as the list UI badges.
 */
async function listOrdersPage(query, user, buildBaseQuery) {
  const salesTabs = query.sales_tabs === 'true' || query.sales_tabs === true;
  const scopeInput = {};
  if (query.exclude_status) scopeInput.exclude_status = query.exclude_status;
  const scopeQuery = await buildBaseQuery(scopeInput, user);
  await ensureProcessStagesForScope(scopeQuery, salesTabs);
  const { filter, search } = stageListFilter(scopeQuery, query);
  const { tabCounts, scopeTotal } = await countProcessStages(scopeQuery, salesTabs);

  if (search) {
    const partyIds = await partyIdsForSearch(search);
    const regex = new RegExp(escapeRegex(search), 'i');
    const searchOr = [{ order_no: regex }, { order_number: regex }];
    if (partyIds.length) searchOr.push({ party: { $in: partyIds } });
    filter.$and = [...(filter.$and || []), { $or: searchOr }];
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const returnAll = query.all === 'true' || query.all === true;
  const limit = returnAll
    ? Math.min(5000, Math.max(Number(query.limit) || 5000, 1))
    : Math.min(100, Math.max(Number(query.limit) || 10, 1));
  const total = await getModels().Order.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / limit) || 1);
  const ids = await getModels()
    .Order.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select('_id process_stage')
    .lean();

  const pageDocs = await loadPageDocuments(ids.map((row) => row._id));
  const tabById = new Map(ids.map((row) => [String(row._id), row.process_stage]));
  const plain = pageDocs.map((row) => applyDerivedPriorityToOrder(toPlain(row)));
  const enriched = await enrichOrdersParallel(plain, getModels());
  const data = enriched.map((row) => {
    const summary = summarizeOrder(row);
    return {
      ...row,
      ...summary,
      workflow_tab: tabById.get(String(row._id)) || row.process_stage || null,
    };
  });

  return {
    total,
    page,
    limit,
    pages,
    scopeTotal,
    tabCounts,
    data,
  };
}

/**
 * Badge-aligned stats. Counts use the same classifier as the paginated list.
 * Quantity and amount are summed from line items for those same buckets.
 */
async function workflowTabStats(query, user, buildBaseQuery) {
  const salesTabs = query.sales_tabs === 'true' || query.sales_tabs === true;
  const scopeInput = {};
  if (salesTabs) {
    if (query.exclude_status) scopeInput.exclude_status = query.exclude_status;
  } else {
    scopeInput.exclude_status = query.exclude_status || 'draft';
  }
  const scopeQuery = await buildBaseQuery(scopeInput, user);
  const { tabCounts } = await countProcessStages(scopeQuery, salesTabs);

  const stats = {};
  for (const id of WORKFLOW_TABS) {
    stats[id] = { count: tabCounts[id] || 0, quantity: 0, kitQuantity: 0, amount: 0 };
  }

  if (query.counts_only === 'true' || query.counts_only === true) return stats;

  const stageMatch = { ...scopeQuery };
  if (!salesTabs) stageMatch.process_stage = { $nin: ['draft', null] };
  const itemRows = await getModels()
    .Order.find(stageMatch)
    .select(
      'process_stage order_items status lifecycle_status workflow_stage current_action dispatch_status delivery_status closed_at',
    )
    .lean();

  for (const row of itemRows) {
    const summary = summarizeOrder(row);
    stats.all.quantity += summary.item_quantity;
    stats.all.kitQuantity += summary.kit_quantity;
    stats.all.amount += summary.line_amount;
    if (row.process_stage && row.process_stage !== 'all' && stats[row.process_stage]) {
      stats[row.process_stage].quantity += summary.item_quantity;
      stats[row.process_stage].kitQuantity += summary.kit_quantity;
      stats[row.process_stage].amount += summary.line_amount;
    }
  }

  return stats;
}

module.exports = {
  listOrdersPage,
  workflowTabStats,
  indexVisibleOrders,
  classifyOrder,
  deriveOrderWorkflowStatus,
  refreshOrderProcessStage,
  backfillProcessStages,
  ensureProcessStagesForScope,
  countProcessStages,
};
