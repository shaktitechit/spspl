/**
 * @fileoverview Order delivery service logic.
 * @module modules/orderDelivery/orderDelivery.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { toPlain } = require('../../utils/mongoJson');
const { ApiError } = require('../../utils/ApiError');
const { softDeleteActiveById, restoreSoftDeletedById, listDeletedLean } = require('../../utils/mongoSoftDelete');
const activityService = require('../activity/activity.service');
const fulfillmentService = require('../orders/orderFulfillment.service');
const orderQueue = require('../../queues/order.queue');
const transportService = require('../transport/transport.service');
const {
  ORDER_STATUS,
  ORDER_WORKFLOW_STAGE,
} = require('../orders/order.constants');
const { hasOpmsRole } = require('../../middlewares/opmsAuth.middleware');
const ROLES = require('../../constants/roles');

let logger = console;
try {
  logger = require('../../utils/logger') || console;
} catch {
  logger = console;
}

const DEL_NF = 'Order delivery not found';

function generateDeliveryNo() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEL-${ts}-${rand}`;
}

async function list({ order, dispatch, transport, delivery_status } = {}) {
  const q = { deletedAt: null };
  if (order) q.order = order;
  if (dispatch) q.dispatch = dispatch;
  if (transport) q.transport = transport;
  if (delivery_status) q.delivery_status = delivery_status;

  const rows = await getModels().OrderDelivery.find(q)
    .populate('order')
    .populate('dispatch')
    .populate('transport')
    .populate('delivery_items.product')
    .sort({ createdAt: -1 })
    .lean();
  return rows.map(toPlain);
}

async function get(id) {
  const row = await getModels().OrderDelivery.findById(id)
    .populate('order')
    .populate('dispatch')
    .populate('transport')
    .populate('delivery_items.product')
    .lean();
  if (!row) throw new ApiError(404, DEL_NF);
  return toPlain(row);
}

async function createDeliveryRecord(body, user, { skipRecalculate = false } = {}) {
  const { OrderDelivery, Order, OrderDispatch } = getModels();

  const orderExists = await Order.exists({ _id: body.order });
  if (!orderExists) throw new ApiError(404, 'Order not found');

  const dispatchExists = await OrderDispatch.exists({ _id: body.dispatch, order: body.order });
  if (!dispatchExists) throw new ApiError(404, 'Order dispatch not found');

  const items = Array.isArray(body.delivery_items) ? body.delivery_items : [];

  const doc = await OrderDelivery.create({
    delivery_no: body.delivery_no || generateDeliveryNo(),
    order: body.order,
    dispatch: body.dispatch,
    transport: body.transport || undefined,
    delivery_status: body.delivery_status || 'pending',
    delivery_items: items.map((item) => ({
      product: item.product,
      delivered_quantity: item.delivered_quantity,
      remarks: item.remarks || '',
    })),
    delivered_by: body.delivered_by || undefined,
    delivered_at: body.delivered_at ? new Date(body.delivered_at) : undefined,
    actual_delivery_date: body.actual_delivery_date ? new Date(body.actual_delivery_date) : undefined,
    received_by: body.received_by || '',
    delivery_proof_url: body.delivery_proof_url || '',
    remarks: body.remarks || '',
    created_by: user._id,
  });

  await activityService.create({
    actor: user._id,
    entity_type: 'delivery',
    entity_id: doc._id.toString(),
    action: 'created',
    message: `Delivery record ${doc.delivery_no} created for order ID ${body.order}`,
  });

  if (!skipRecalculate) {
    await fulfillmentService.recalculateFromExecutions(body.order, user);
  }

  return doc;
}

function validateShipmentDeliveryPayload(body) {
  const deliveryType = String(body.delivery_type || '').toLowerCase();
  if (deliveryType !== 'full') {
    throw new ApiError(400, 'Only full delivery is supported');
  }
  if (!body.order) throw new ApiError(400, 'order is required');
  if (!body.dispatch) throw new ApiError(400, 'dispatch is required');
  if (!body.transport) throw new ApiError(400, 'transport is required');

  const deliveryItems = Array.isArray(body.delivery_items) ? body.delivery_items : [];
  const returnItems = Array.isArray(body.return_items) ? body.return_items : [];

  const deliveredLines = deliveryItems.filter((item) => Number(item.delivered_quantity) > 0);
  if (deliveredLines.length === 0) {
    throw new ApiError(400, 'Full delivery requires at least one delivered line');
  }
  if (returnItems.length > 0) {
    throw new ApiError(400, 'Full delivery cannot include return lines');
  }

  return { deliveryType, deliveredLines };
}

async function assertFullDeliveryMatchesDispatch(body, deliveredLines) {
  const { OrderDelivery, OrderDispatch, TransportShipment } = getModels();
  const dispatch = await OrderDispatch.findOne({
    _id: body.dispatch,
    order: body.order,
    deletedAt: null,
    dispatch_status: { $ne: 'cancelled' },
  }).lean();
  if (!dispatch) throw new ApiError(404, 'Order dispatch not found');

  const existingDelivery = await OrderDelivery.findOne({
    dispatch: body.dispatch,
    transport: body.transport,
    deletedAt: null,
  }).lean();
  if (existingDelivery) {
    if (body.transport) {
      await TransportShipment.updateOne(
        { _id: body.transport },
        {
          $set: {
            shipment_status: 'delivered',
            actual_delivery_date: existingDelivery.actual_delivery_date || new Date(),
            delivered_at: existingDelivery.delivered_at || new Date(),
            received_by: existingDelivery.received_by || body.received_by || '',
          },
        }
      );
    }
    throw new ApiError(400, 'A delivery is already recorded for this shipment');
  }

  const expectedByProduct = new Map();
  for (const item of dispatch.dispatch_items || []) {
    const productId = String(item.product?._id ?? item.product ?? '');
    const quantity = Number(item.dispatched_quantity ?? item.dispatch_quantity ?? 0);
    if (!productId || quantity <= 0) continue;
    expectedByProduct.set(productId, (expectedByProduct.get(productId) || 0) + quantity);
  }

  const deliveredByProduct = new Map();
  for (const item of deliveredLines) {
    const productId = String(item.product?._id ?? item.product ?? '');
    const quantity = Number(item.delivered_quantity || 0);
    if (!productId || quantity <= 0) {
      throw new ApiError(400, 'Every delivery line requires a product and positive quantity');
    }
    deliveredByProduct.set(productId, (deliveredByProduct.get(productId) || 0) + quantity);
  }

  if (
    expectedByProduct.size === 0 ||
    expectedByProduct.size !== deliveredByProduct.size
  ) {
    throw new ApiError(400, 'Full delivery must include every dispatched product');
  }

  for (const [productId, dispatchedQuantity] of expectedByProduct) {
    if (deliveredByProduct.get(productId) !== dispatchedQuantity) {
      throw new ApiError(
        400,
        `Full delivery quantity must equal dispatched quantity for product ${productId}`,
      );
    }
  }
}

async function enqueuePostShipmentDeliveryJobs(orderId, userId, extras = {}) {
  const oid = String(orderId);
  try {
    await processPostShipmentDeliveryJob({
      orderId: oid,
      userId: userId ? String(userId) : undefined,
      ...extras,
    });
  } catch (err) {
    logger.error?.(`[orderDelivery] processPostShipmentDeliveryJob inline error: ${err.message}`);
  }
  const { scheduleProcessStageRefresh } = require('../orders/processStage.jobs');
  await scheduleProcessStageRefresh(oid, 'delivery');
}

async function processPostShipmentDeliveryJob(payload = {}) {
  const orderId = payload.orderId;
  if (!orderId) throw new Error('post_shipment_delivery requires orderId');
  if (!payload.transportId) throw new Error('post_shipment_delivery requires transportId');

  const { Order, User, OrderWorkflow } = getModels();
  const orderBefore = await Order.findById(orderId).lean();
  if (!orderBefore) return { orderId, skipped: true };

  let user = null;
  if (payload.userId) {
    const actor = await User.findById(payload.userId).lean();
    if (actor) user = toPlain(actor);
  }

  await transportService.applyTransportDeliveryOutcome(
    payload.transportId,
    {
      status: payload.transportStatus || 'delivered',
      remarks: payload.statusRemarks || '',
    },
    user,
  );

  const orderState = await transportService.recalculateOrderShipmentState(orderId, user);
  if (!orderState) return { orderId, skipped: true };

  const workflowAction =
    transportService.workflowActionForShipmentStatus(payload.transportStatus || 'delivered');

  if (OrderWorkflow) {
    try {
      await OrderWorkflow.create({
        order: orderId,
        action_by: payload.userId || undefined,
        role: user ? transportService.workflowRoleForUser(user) : 'system',
        action: workflowAction,
        from_stage: orderBefore.workflow_stage,
        to_stage: orderState.workflow_stage || ORDER_WORKFLOW_STAGE.DISPATCH,
        from_status: orderBefore.status,
        to_status: orderState.status || ORDER_STATUS.DELIVERED,
        remarks: payload.statusRemarks || '',
        revision_number: orderState.current_revision || orderBefore.current_revision || 1,
        metadata: {
          transport_shipment_id: String(payload.transportId),
          delivery_id: payload.deliveryId ? String(payload.deliveryId) : undefined,
          delivery_type: payload.deliveryType,
          event: 'shipment_delivery_logged',
        },
      });
    } catch {
      // Non-blocking
    }
  }

  const { scheduleProcessStageRefresh } = require('../orders/processStage.jobs');
  await scheduleProcessStageRefresh(orderId, 'post_shipment_delivery');

  return {
    orderId,
    status: orderState.status,
    lifecycle_status: orderState.lifecycle_status,
    current_action: orderState.current_action,
  };
}

async function logShipmentDelivery(body, user) {
  const { deliveryType, deliveredLines } = validateShipmentDeliveryPayload(body);
  const { OrderDelivery, TransportShipment } = getModels();

  const userId = user?._id || user?.id || undefined;

  // 1. Check if a delivery record already exists for this dispatch + transport
  const existingDeliveryDoc = await OrderDelivery.findOne({
    dispatch: body.dispatch,
    transport: body.transport,
    deletedAt: null,
  });

  if (existingDeliveryDoc) {
    // Self-heal: the delivery was previously recorded; ensure TransportShipment and workflow are synchronized
    const actualDeliveryDate = existingDeliveryDoc.actual_delivery_date || new Date();
    const deliveredAt = existingDeliveryDoc.delivered_at || new Date();
    const formattedTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const statusRemarks = body.status_remarks || body.remarks || 'Shipment delivered';
    const newRemarkLine = `[${formattedTimestamp}] [DELIVERED]: ${statusRemarks.trim()}`;

    const existingShipment = await TransportShipment.findById(body.transport);
    const existingRemarks = existingShipment?.remarks || '';
    const updatedRemarks =
      existingRemarks && !existingRemarks.includes('[DELIVERED]')
        ? `${existingRemarks}\n${newRemarkLine}`
        : existingRemarks || newRemarkLine;

    await TransportShipment.updateOne(
      { _id: body.transport },
      {
        $set: {
          shipment_status: 'delivered',
          actual_delivery_date: existingShipment?.actual_delivery_date || actualDeliveryDate,
          delivered_at: existingShipment?.delivered_at || deliveredAt,
          received_by: body.received_by || existingShipment?.received_by || existingDeliveryDoc.received_by || '',
          remarks: updatedRemarks,
        },
      }
    );

    try {
      await transportService.applyTransportDeliveryOutcome(
        body.transport,
        { status: 'delivered', remarks: statusRemarks },
        user,
      );
    } catch (_ignore) {}

    await enqueuePostShipmentDeliveryJobs(body.order, userId, {
      transportId: String(body.transport),
      deliveryType,
      transportStatus: 'delivered',
      statusRemarks: body.status_remarks || '',
      deliveryId: String(existingDeliveryDoc._id),
    });

    return {
      delivery: toPlain(existingDeliveryDoc.toObject ? existingDeliveryDoc.toObject() : existingDeliveryDoc),
      queued: true,
      transport_status: 'delivered',
      delivery_type: deliveryType,
      alreadyRecorded: true,
    };
  }

  // 2. Normal flow: validate payload against dispatch
  await assertFullDeliveryMatchesDispatch(body, deliveredLines);
  const transportStatus = 'delivered';

  const deliveryDoc = await createDeliveryRecord({
    order: body.order,
    dispatch: body.dispatch,
    transport: body.transport,
    delivery_status: 'delivered',
    delivery_items: deliveredLines,
    received_by: body.received_by || '',
    remarks: body.remarks || '',
    actual_delivery_date: body.actual_delivery_date || new Date().toISOString(),
    delivered_at: body.delivered_at || new Date().toISOString(),
  }, user, { skipRecalculate: true });

  // 3. Immediately and synchronously update TransportShipment
  const actualDeliveryDate = body.actual_delivery_date ? new Date(body.actual_delivery_date) : new Date();
  const deliveredAt = body.delivered_at ? new Date(body.delivered_at) : new Date();
  const formattedTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const statusRemarks = body.status_remarks || body.remarks || 'Status updated to delivered';
  const newRemarkLine = `[${formattedTimestamp}] [DELIVERED]: ${statusRemarks.trim()}`;

  const existingShipment = await TransportShipment.findById(body.transport);
  const existingRemarks = existingShipment?.remarks || '';
  const updatedRemarks = existingRemarks ? `${existingRemarks}\n${newRemarkLine}` : newRemarkLine;

  await TransportShipment.updateOne(
    { _id: body.transport },
    {
      $set: {
        shipment_status: 'delivered',
        actual_delivery_date: existingShipment?.actual_delivery_date || actualDeliveryDate,
        delivered_at: existingShipment?.delivered_at || deliveredAt,
        received_by: body.received_by || existingShipment?.received_by || '',
        remarks: updatedRemarks,
      },
    }
  );

  // 4. Safely call applyTransportDeliveryOutcome for syncing plan lines
  try {
    await transportService.applyTransportDeliveryOutcome(
      body.transport,
      { status: 'delivered', remarks: statusRemarks },
      user,
    );
  } catch (_ignore) {}

  // 5. Post delivery jobs (workflow + process stages)
  await enqueuePostShipmentDeliveryJobs(body.order, userId, {
    transportId: String(body.transport),
    deliveryType,
    transportStatus,
    statusRemarks: body.status_remarks || '',
    deliveryId: String(deliveryDoc._id),
  });

  return {
    delivery: toPlain(deliveryDoc.toObject ? deliveryDoc.toObject() : deliveryDoc),
    queued: true,
    transport_status: transportStatus,
    delivery_type: deliveryType,
  };
}

async function patch(id, patchBody, user) {
  const { OrderDelivery } = getModels();
  const doc = await OrderDelivery.findById(id);
  if (!doc) throw new ApiError(404, DEL_NF);

  const patch = patchBody || {};
  for (const field of [
    'transport',
    'delivered_by',
    'received_by',
    'delivery_proof_url',
    'remarks',
  ]) {
    if (patch[field] !== undefined) doc[field] = patch[field] || undefined;
  }

  for (const dateField of ['delivered_at', 'actual_delivery_date']) {
    if (patch[dateField] !== undefined) {
      doc[dateField] = patch[dateField] ? new Date(patch[dateField]) : undefined;
    }
  }

  if (Array.isArray(patch.delivery_items)) {
    const isSuperAdmin = hasOpmsRole(user, ROLES.SUPER_ADMIN);
    if (!isSuperAdmin) {
      throw new ApiError(403, 'Only super_admin can edit delivery items');
    }
    doc.delivery_items = patch.delivery_items.map((item) => ({
      product: item?.product?._id || item?.product,
      delivered_quantity: Number(item?.delivered_quantity || 0),
      remarks: item?.remarks || '',
    }));
    doc.markModified('delivery_items');
  }

  await doc.save();

  await activityService.create({
    actor: user._id,
    entity_type: 'delivery',
    entity_id: doc._id.toString(),
    action: 'updated',
    message: `Delivery record ${doc.delivery_no} updated`,
  });

  await fulfillmentService.recalculateFromExecutions(doc.order, user);
  await transportService.recalculateOrderShipmentState(doc.order, user);
  const { scheduleProcessStageRefresh } = require('../orders/processStage.jobs');
  await scheduleProcessStageRefresh(doc.order, 'delivery_updated');

  return toPlain(doc.toObject());
}

async function listDeleted({ order } = {}) {
  const q = {};
  if (order) q.order = order;
  const rows = await listDeletedLean(getModels().OrderDelivery, q);
  return rows.map(toPlain);
}

async function softDelete(id, user) {
  const doc = await softDeleteActiveById(getModels().OrderDelivery, id, { notFoundMessage: DEL_NF });
  const plain = toPlain(doc.toObject());
  await activityService.create({
    actor: user._id,
    entity_type: 'delivery',
    entity_id: plain._id,
    action: 'deleted',
    message: `Delivery record ${plain.delivery_no} soft-deleted`,
  });
  if (plain.order) {
    await fulfillmentService.recalculateFromExecutions(plain.order, user);
    await transportService.recalculateOrderShipmentState(plain.order, user);
    const { scheduleProcessStageRefresh } = require('../orders/processStage.jobs');
    await scheduleProcessStageRefresh(plain.order, 'delivery_deleted');
  }
  return plain;
}

async function restore(id, user) {
  const doc = await restoreSoftDeletedById(getModels().OrderDelivery, id, { notFoundMessage: DEL_NF });
  const plain = toPlain(doc.toObject());
  await activityService.create({
    actor: user._id,
    entity_type: 'delivery',
    entity_id: plain._id,
    action: 'restored',
    message: `Delivery record ${plain.delivery_no} restored`,
  });
  if (plain.order) {
    await fulfillmentService.recalculateFromExecutions(plain.order, user);
    await transportService.recalculateOrderShipmentState(plain.order, user);
    const { scheduleProcessStageRefresh } = require('../orders/processStage.jobs');
    await scheduleProcessStageRefresh(plain.order, 'delivery_restored');
  }
  return plain;
}

module.exports = {
  list,
  get,
  logShipmentDelivery,
  processPostShipmentDeliveryJob,
  patch,
  listDeleted,
  softDelete,
  restore,
};
