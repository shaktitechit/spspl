/**
 * @fileoverview Order Performa Invoice service.
 * Manages proforma invoice details linked to orders and enforces dispatch lock rules.
 * @module modules/orders/orderPerforma.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const activityService = require('../activity/activity.service');

const { API_PUBLIC_BASE_URL } = require('../../config/fileManagement');

function getBaseUrl() {
  if (API_PUBLIC_BASE_URL && !API_PUBLIC_BASE_URL.includes('localhost')) {
    return API_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  return 'https://api.medicaent.in';
}

function ensureViewUrl(item) {
  if (!item) return null;
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const base = getBaseUrl();
  const targetId = obj.filename || obj.fileId || obj._id;
  if (targetId && (!obj.url || obj.url.includes('minio.spspl.com') || !obj.url.includes('/api/files/'))) {
    obj.url = `${base}/api/files/${targetId}/view`;
  }
  return obj;
}

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === 'function' ? doc.toObject() : JSON.parse(JSON.stringify(doc));
}

async function findPerformaAttachments(orderId, partyId) {
  const { Attachment, OrderPerforma } = getModels();
  const mongoose = require('mongoose');
  if (!Attachment) {
    return { poDocument: null, costSheetDocument: null, kycDocuments: [] };
  }

  const idQuery = mongoose.Types.ObjectId.isValid(orderId)
    ? { $in: [new mongoose.Types.ObjectId(orderId), String(orderId)] }
    : orderId;

  const orderAttachments = await Attachment.find({
    entity_type: 'order',
    entity_id: idQuery,
    deletedAt: null,
  })
    .populate('uploaded_by', 'name username email department')
    .sort({ createdAt: -1 })
    .lean();

  let poDocument = orderAttachments.find(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return cat === 'po' || rem.startsWith('[po]') || fn.startsWith('po_') || fn.includes('purchase_order');
  }) || null;

  let costSheetDocument = orderAttachments.find(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return (
      cat === 'cost_sheet' ||
      cat === 'margin_sheet' ||
      rem.startsWith('[cost_sheet]') ||
      rem.startsWith('[margin_sheet]') ||
      fn.includes('cost_sheet') ||
      fn.includes('costsheet') ||
      fn.includes('margin_sheet') ||
      fn.includes('marginsheet')
    );
  }) || null;

  const orderKyc = orderAttachments.filter(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return (
      cat.startsWith('kyc') ||
      cat.includes('aadhaar') ||
      cat.includes('adhaar') ||
      cat.includes('pan') ||
      cat.includes('gst') ||
      rem.includes('kyc') ||
      rem.includes('aadhaar') ||
      rem.includes('adhaar') ||
      rem.includes('pan') ||
      rem.includes('gst') ||
      fn.includes('kyc') ||
      fn.includes('aadhaar') ||
      fn.includes('adhaar') ||
      fn.includes('pan') ||
      fn.includes('gst')
    );
  });

  let partyKyc = [];
  if (partyId) {
    const partyIdQuery = mongoose.Types.ObjectId.isValid(partyId)
      ? { $in: [new mongoose.Types.ObjectId(partyId), String(partyId)] }
      : partyId;

    partyKyc = await Attachment.find({
      entity_type: { $in: ['party', 'customer'] },
      entity_id: partyIdQuery,
      deletedAt: null,
    })
      .populate('uploaded_by', 'name username email department')
      .sort({ createdAt: -1 })
      .lean();
  }

  const seen = new Set();
  const allKyc = [];
  for (const item of [...orderKyc, ...partyKyc]) {
    const id = String(item._id);
    if (!seen.has(id)) {
      seen.add(id);
      allKyc.push(ensureViewUrl(item));
    }
  }

  // Strictly separate Aadhaar, PAN, and GST documents
  let aadhaarDocument = allKyc.find(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return (
      cat === 'kyc_aadhaar' ||
      cat === 'aadhaar' ||
      cat === 'adhaar' ||
      rem.includes('aadhaar') ||
      rem.includes('adhaar') ||
      fn.includes('aadhaar') ||
      fn.includes('adhaar')
    );
  }) || null;

  let panDocument = allKyc.find(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return (
      cat === 'kyc_pan' ||
      cat === 'pan' ||
      rem.includes('pan') ||
      fn.includes('pan')
    );
  }) || null;

  let gstDocument = allKyc.find(att => {
    const cat = String(att.category || '').toLowerCase();
    const rem = String(att.remarks || '').toLowerCase();
    const fn = String(att.original_name || att.file_name || '').toLowerCase();
    return (
      cat === 'kyc_gst' ||
      cat === 'gst' ||
      cat === 'gst_certificate' ||
      rem.includes('gst') ||
      fn.includes('gst')
    );
  }) || null;

  // Direct reference lookup fallback if OrderPerforma already has attachment IDs
  if (OrderPerforma && (!poDocument || !costSheetDocument || !aadhaarDocument || !panDocument || !gstDocument)) {
    try {
      const perfDoc = await OrderPerforma.findOne({ order: orderId, deletedAt: null }).lean();
      if (perfDoc) {
        if (!poDocument && perfDoc.po_attachment) {
          const directAtt = await Attachment.findOne({ _id: perfDoc.po_attachment, deletedAt: null })
            .populate('uploaded_by', 'name username email department')
            .lean();
          if (directAtt) poDocument = ensureViewUrl(directAtt);
        }
        if (!costSheetDocument && perfDoc.cost_sheet_attachment) {
          const directAtt = await Attachment.findOne({ _id: perfDoc.cost_sheet_attachment, deletedAt: null })
            .populate('uploaded_by', 'name username email department')
            .lean();
          if (directAtt) costSheetDocument = ensureViewUrl(directAtt);
        }
        if (!aadhaarDocument && perfDoc.aadhaar_attachment) {
          const directAtt = await Attachment.findOne({ _id: perfDoc.aadhaar_attachment, deletedAt: null })
            .populate('uploaded_by', 'name username email department')
            .lean();
          if (directAtt) aadhaarDocument = ensureViewUrl(directAtt);
        }
        if (!panDocument && perfDoc.pan_attachment) {
          const directAtt = await Attachment.findOne({ _id: perfDoc.pan_attachment, deletedAt: null })
            .populate('uploaded_by', 'name username email department')
            .lean();
          if (directAtt) panDocument = ensureViewUrl(directAtt);
        }
        if (!gstDocument && perfDoc.gst_attachment) {
          const directAtt = await Attachment.findOne({ _id: perfDoc.gst_attachment, deletedAt: null })
            .populate('uploaded_by', 'name username email department')
            .lean();
          if (directAtt) gstDocument = ensureViewUrl(directAtt);
        }
      }
    } catch (_refErr) {
      // Non-blocking
    }
  }

  return {
    poDocument: poDocument ? ensureViewUrl(poDocument) : null,
    costSheetDocument: costSheetDocument ? ensureViewUrl(costSheetDocument) : null,
    aadhaarDocument,
    panDocument,
    gstDocument,
    kycDocuments: allKyc,
  };
}

/**
 * Determines whether performa invoice editing is locked.
 * Rule: Performa Invoice can be updated before dispatch is created and submitted.
 * Once dispatch is created and submitted, editing is locked.
 */
async function checkPerformaLocked(orderId, orderDoc) {
  const { OrderDispatch } = getModels();

  if (OrderDispatch) {
    const submittedDispatch = await OrderDispatch.findOne({
      order: orderId,
      deletedAt: null,
      dispatch_status: { $in: ['submitted', 'transport_created'] },
    }).lean();

    if (submittedDispatch) {
      return {
        is_locked: true,
        lock_reason: `Performa Invoice is locked because dispatch ${submittedDispatch.dispatch_no || ''} has been submitted.`,
      };
    }
  }

  if (orderDoc) {
    if (orderDoc.dispatch_status === 'completed') {
      return {
        is_locked: true,
        lock_reason: 'Performa Invoice is locked because order dispatch is completed.',
      };
    }
  }

  return {
    is_locked: false,
    lock_reason: '',
  };
}

function formatAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  if (typeof addr === 'object') {
    const parts = [
      addr.address_line_1 || addr.address1 || addr.line1 || addr.street,
      addr.address_line_2 || addr.address2 || addr.line2,
      addr.city,
      addr.state,
      addr.pin_code || addr.pincode || addr.zip,
      addr.country,
    ].filter(Boolean);
    return parts.join(', ');
  }
  return '';
}

function formatCustomerType(pt) {
  if (!pt) return 'Direct Customer';
  const val = String(pt).toLowerCase().trim();
  if (val === 'hospital') return 'Hospital';
  if (val === 'dealer') return 'Dealer';
  if (val === 'distributor') return 'Distributor';
  if (val === 'institutional') return 'Institutional';
  if (val === 'government' || val === 'govt') return 'Government';
  if (val === 'customer') return 'Direct Customer';
  if (val === 'supplier') return 'Other';
  return String(pt).trim() || 'Direct Customer';
}

/**
 * Get proforma invoice details for an order.
 */
async function getOrderPerforma(orderId, user) {
  const { Order, OrderPerforma, User, Party } = getModels();
  const order = await Order.findOne({ _id: orderId, deletedAt: null }).lean();
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const { is_locked, lock_reason } = await checkPerformaLocked(orderId, order);
  const {
    poDocument,
    costSheetDocument,
    aadhaarDocument,
    panDocument,
    gstDocument,
    kycDocuments,
  } = await findPerformaAttachments(orderId, order.party);

  let partyDoc = null;
  if (order.party && Party) {
    partyDoc = await Party.findById(order.party).lean();
  }

  let defaultSalesPerson = '';
  if (order.assigned_sales_user && User) {
    const salesUser = await User.findById(order.assigned_sales_user).select('name username').lean();
    if (salesUser) {
      defaultSalesPerson = salesUser.name || salesUser.username || '';
    }
  }
  if (!defaultSalesPerson && user && (user.name || user.username)) {
    defaultSalesPerson = user.name || user.username || '';
  }

  const defaultShipTo = formatAddress(
    order.shipping_address ||
    order.billing_address ||
    partyDoc?.shipping_address ||
    partyDoc?.billing_address
  );
  const defaultPaymentTerms = partyDoc?.payment_terms || '30 days';
  const defaultCustomerType = formatCustomerType(partyDoc?.party_type);
  const hasKyc = Boolean(aadhaarDocument || panDocument || gstDocument || (kycDocuments && kycDocuments.length > 0));

  let performa = await OrderPerforma.findOne({ order: orderId, deletedAt: null }).lean();

  if (!performa) {
    return {
      order: orderId,
      order_no: order.order_no,
      company_id: order.company_id || null,
      sales_person: defaultSalesPerson,
      freight_charges: 'Included',
      orc: '',
      transport: '',
      dispatch_date: order.expected_delivery_date || null,
      ship_to_address: defaultShipTo,
      payment_terms: defaultPaymentTerms,
      customer_type: defaultCustomerType,
      installation_required: '',
      gst_concession: '',
      margin_sheet_attached: costSheetDocument ? 'Attached' : '',
      kyc_status: hasKyc ? 'Attached' : '',
      remarks: order.remarks || '',
      po_attachment: poDocument ? poDocument._id : null,
      cost_sheet_attachment: costSheetDocument ? costSheetDocument._id : null,
      aadhaar_attachment: aadhaarDocument ? aadhaarDocument._id : null,
      pan_attachment: panDocument ? panDocument._id : null,
      gst_attachment: gstDocument ? gstDocument._id : null,
      po_document: poDocument,
      cost_sheet_document: costSheetDocument,
      aadhaar_document: aadhaarDocument,
      pan_document: panDocument,
      gst_document: gstDocument,
      kyc_documents: kycDocuments,
      is_locked,
      lock_reason,
      is_default: true,
    };
  }

  const plainDoc = toPlain(performa);

  // Auto-sync missing attachments or empty defaults to DB
  const toSync = {};
  if (!plainDoc.po_attachment && poDocument) toSync.po_attachment = poDocument._id;
  if (!plainDoc.cost_sheet_attachment && costSheetDocument) {
    toSync.cost_sheet_attachment = costSheetDocument._id;
    if (!plainDoc.margin_sheet_attached) toSync.margin_sheet_attached = 'Attached';
  }
  if (!plainDoc.aadhaar_attachment && aadhaarDocument) {
    toSync.aadhaar_attachment = aadhaarDocument._id;
    if (!plainDoc.kyc_status) toSync.kyc_status = 'Attached';
  }
  if (!plainDoc.pan_attachment && panDocument) {
    toSync.pan_attachment = panDocument._id;
    if (!plainDoc.kyc_status) toSync.kyc_status = 'Attached';
  }
  if (!plainDoc.gst_attachment && gstDocument) {
    toSync.gst_attachment = gstDocument._id;
    if (!plainDoc.kyc_status) toSync.kyc_status = 'Attached';
  }
  if (!plainDoc.sales_person && defaultSalesPerson) toSync.sales_person = defaultSalesPerson;
  if (!plainDoc.ship_to_address && defaultShipTo) toSync.ship_to_address = defaultShipTo;
  if (!plainDoc.dispatch_date && order.expected_delivery_date) toSync.dispatch_date = order.expected_delivery_date;
  if (!plainDoc.payment_terms && defaultPaymentTerms) toSync.payment_terms = defaultPaymentTerms;
  if (!plainDoc.customer_type && defaultCustomerType) toSync.customer_type = defaultCustomerType;

  if (Object.keys(toSync).length > 0) {
    await OrderPerforma.updateOne({ _id: performa._id }, { $set: toSync }).catch(() => {});
    Object.assign(plainDoc, toSync);
  }

  return {
    ...plainDoc,
    sales_person: plainDoc.sales_person || defaultSalesPerson,
    freight_charges: plainDoc.freight_charges || 'Included',
    dispatch_date: plainDoc.dispatch_date || order.expected_delivery_date || null,
    ship_to_address: plainDoc.ship_to_address || defaultShipTo,
    payment_terms: plainDoc.payment_terms || defaultPaymentTerms,
    customer_type: plainDoc.customer_type || defaultCustomerType,
    margin_sheet_attached: plainDoc.margin_sheet_attached || (costSheetDocument ? 'Attached' : ''),
    kyc_status: plainDoc.kyc_status || (hasKyc ? 'Attached' : ''),
    po_attachment: plainDoc.po_attachment || (poDocument ? poDocument._id : null),
    cost_sheet_attachment: plainDoc.cost_sheet_attachment || (costSheetDocument ? costSheetDocument._id : null),
    aadhaar_attachment: plainDoc.aadhaar_attachment || (aadhaarDocument ? aadhaarDocument._id : null),
    pan_attachment: plainDoc.pan_attachment || (panDocument ? panDocument._id : null),
    gst_attachment: plainDoc.gst_attachment || (gstDocument ? gstDocument._id : null),
    po_document: poDocument,
    cost_sheet_document: costSheetDocument,
    aadhaar_document: aadhaarDocument,
    pan_document: panDocument,
    gst_document: gstDocument,
    kyc_documents: kycDocuments,
    is_locked,
    lock_reason,
    is_default: false,
  };
}

/**
 * Save or update proforma invoice details for an order.
 */
async function saveOrderPerforma(orderId, data = {}, user) {
  const { Order, OrderPerforma, User, Party } = getModels();
  const order = await Order.findOne({ _id: orderId, deletedAt: null });
  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const { is_locked, lock_reason } = await checkPerformaLocked(orderId, order);
  if (is_locked) {
    throw new ApiError(400, lock_reason || 'Performa Invoice cannot be updated after dispatch has been created and submitted.');
  }

  const existingDoc = await OrderPerforma.findOne({ order: order._id, deletedAt: null }).lean();
  const {
    poDocument,
    costSheetDocument,
    aadhaarDocument,
    panDocument,
    gstDocument,
    kycDocuments,
  } = await findPerformaAttachments(orderId, order.party);

  let partyDoc = null;
  if (order.party && Party) {
    partyDoc = await Party.findById(order.party).lean();
  }

  let defaultSalesPerson = '';
  if (order.assigned_sales_user && User) {
    const salesUser = await User.findById(order.assigned_sales_user).select('name username').lean();
    if (salesUser) {
      defaultSalesPerson = salesUser.name || salesUser.username || '';
    }
  }
  if (!defaultSalesPerson && user && (user.name || user.username)) {
    defaultSalesPerson = user.name || user.username || '';
  }

  const defaultShipTo = formatAddress(
    order.shipping_address ||
    order.billing_address ||
    partyDoc?.shipping_address ||
    partyDoc?.billing_address
  );
  const defaultPaymentTerms = partyDoc?.payment_terms || '30 days';
  const defaultCustomerType = formatCustomerType(partyDoc?.party_type);

  const safeData = data && typeof data === 'object' ? data : {};
  const payload = {};

  // Sales person
  const spVal = safeData.sales_person !== undefined ? String(safeData.sales_person || '').trim() : '';
  payload.sales_person = spVal || existingDoc?.sales_person || defaultSalesPerson;

  // Dispatch date
  let dDate = null;
  if (safeData.dispatch_date) {
    const parsed = new Date(safeData.dispatch_date);
    if (!isNaN(parsed.getTime())) dDate = parsed;
  }
  if (!dDate && existingDoc?.dispatch_date) {
    dDate = existingDoc.dispatch_date;
  }
  if (!dDate && order.expected_delivery_date) {
    const parsed = new Date(order.expected_delivery_date);
    if (!isNaN(parsed.getTime())) dDate = parsed;
  }
  payload.dispatch_date = dDate;

  // Freight charges
  const fcVal = safeData.freight_charges !== undefined ? String(safeData.freight_charges || '').trim() : '';
  payload.freight_charges = fcVal || existingDoc?.freight_charges || 'Included';

  // ORC
  if (safeData.orc !== undefined) {
    payload.orc = String(safeData.orc || '').trim();
  } else if (existingDoc?.orc !== undefined) {
    payload.orc = existingDoc.orc;
  } else {
    payload.orc = '';
  }

  // Transport
  if (safeData.transport !== undefined) {
    payload.transport = String(safeData.transport || '').trim();
  } else if (existingDoc?.transport !== undefined) {
    payload.transport = existingDoc.transport;
  } else {
    payload.transport = '';
  }

  // Ship-to address
  const stVal = safeData.ship_to_address !== undefined ? String(safeData.ship_to_address || '').trim() : '';
  payload.ship_to_address = stVal || existingDoc?.ship_to_address || defaultShipTo;

  // Payment terms
  const ptVal = safeData.payment_terms !== undefined ? String(safeData.payment_terms || '').trim() : '';
  payload.payment_terms = ptVal || existingDoc?.payment_terms || defaultPaymentTerms;

  // Customer type
  const ctVal = safeData.customer_type !== undefined ? String(safeData.customer_type || '').trim() : '';
  payload.customer_type = ctVal || existingDoc?.customer_type || defaultCustomerType;

  // Installation required
  if (safeData.installation_required !== undefined) {
    payload.installation_required = String(safeData.installation_required || '').trim();
  } else if (existingDoc?.installation_required !== undefined) {
    payload.installation_required = existingDoc.installation_required;
  } else {
    payload.installation_required = '';
  }

  // GST concession
  if (safeData.gst_concession !== undefined) {
    payload.gst_concession = String(safeData.gst_concession || '').trim();
  } else if (existingDoc?.gst_concession !== undefined) {
    payload.gst_concession = existingDoc.gst_concession;
  } else {
    payload.gst_concession = '';
  }

  // Remarks
  const remVal = safeData.remarks !== undefined ? String(safeData.remarks || '').trim() : '';
  payload.remarks = remVal || existingDoc?.remarks || order.remarks || '';

  // Attachments
  payload.po_attachment = safeData.po_attachment || existingDoc?.po_attachment || (poDocument ? poDocument._id : null);
  payload.cost_sheet_attachment = safeData.cost_sheet_attachment || existingDoc?.cost_sheet_attachment || (costSheetDocument ? costSheetDocument._id : null);
  payload.aadhaar_attachment = safeData.aadhaar_attachment || existingDoc?.aadhaar_attachment || (aadhaarDocument ? aadhaarDocument._id : null);
  payload.pan_attachment = safeData.pan_attachment || existingDoc?.pan_attachment || (panDocument ? panDocument._id : null);
  payload.gst_attachment = safeData.gst_attachment || existingDoc?.gst_attachment || (gstDocument ? gstDocument._id : null);

  // Margin sheet attached status
  const msVal = safeData.margin_sheet_attached !== undefined ? String(safeData.margin_sheet_attached || '').trim() : '';
  payload.margin_sheet_attached = msVal || (payload.cost_sheet_attachment ? 'Attached' : (existingDoc?.margin_sheet_attached || ''));

  // KYC status
  const kycVal = safeData.kyc_status !== undefined ? String(safeData.kyc_status || '').trim() : '';
  const hasKycStatus = Boolean(payload.aadhaar_attachment || payload.pan_attachment || payload.gst_attachment || (kycDocuments && kycDocuments.length > 0));
  payload.kyc_status = kycVal || (hasKycStatus ? 'Attached' : (existingDoc?.kyc_status || ''));

  payload.order = order._id;
  payload.order_no = order.order_no;
  payload.company_id = order.company_id || null;
  if (user && user._id) {
    payload.updated_by = user._id;
  }

  const setOnInsert = user && user._id ? { created_by: user._id } : {};

  const doc = await OrderPerforma.findOneAndUpdate(
    { order: order._id, deletedAt: null },
    {
      $set: payload,
      $setOnInsert: setOnInsert,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Link reference in Order if not already present
  if (String(order.order_performa || '') !== String(doc._id)) {
    order.set('order_performa', doc._id);
    await order.save();
  }

  if (user && user._id) {
    await activityService.create({
      actor: user._id,
      entity_type: 'order',
      entity_id: order._id,
      action: 'performa_updated',
      message: `Performa Invoice updated for order ${order.order_no}`,
      new_value: { performa_id: doc._id },
    }).catch(() => {});
  }

  return getOrderPerforma(orderId, user);
}

module.exports = {
  checkPerformaLocked,
  getOrderPerforma,
  saveOrderPerforma,
};
