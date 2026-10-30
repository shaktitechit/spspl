/**
 * @fileoverview Attachment Service for managing file attachments across leads and quotations.
 * @module modules/attachments/attachment.service
 */
const mongoose = require('mongoose');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const fileManagement = require('../../services/fileManagement');
const activityService = require('../activity/activity.service');

function buildEntityIdFilter(entityId) {
  if (!entityId) return undefined;
  if (mongoose.Types.ObjectId.isValid(entityId)) {
    return { $in: [new mongoose.Types.ObjectId(entityId), String(entityId)] };
  }
  return entityId;
}

/**
 * List active attachments.
 */
async function list(query = {}) {
  const { Attachment } = getModels();
  const filter = { deletedAt: null };

  if (query.entity_type) filter.entity_type = query.entity_type;
  if (query.entity_id) {
    filter.entity_id = buildEntityIdFilter(query.entity_id);
  }
  if (query.category) filter.category = query.category;

  const items = await Attachment.find(filter).sort({ createdAt: -1 });
  return items;
}

/**
 * List soft-deleted attachments.
 */
async function listDeleted(query = {}) {
  const { Attachment } = getModels();
  const filter = { deletedAt: { $ne: null } };

  if (query.entity_type) filter.entity_type = query.entity_type;
  if (query.entity_id) {
    filter.entity_id = buildEntityIdFilter(query.entity_id);
  }
  if (query.category) filter.category = query.category;

  const items = await Attachment.find(filter).sort({ deletedAt: -1 });
  return items;
}

/**
 * Get attachment by ID.
 */
async function getById(id) {
  const { Attachment } = getModels();
  const item = await Attachment.findById(id);
  if (!item) throw new ApiError(404, 'Attachment not found');
  return item;
}

/**
 * Create/Upload attachment.
 */
async function create(body = {}, file = null, user = {}) {
  const { Attachment, OrderPerforma } = getModels();
  let attachmentRecord;

  const resolvedEntityId =
    body.entity_id && mongoose.Types.ObjectId.isValid(body.entity_id)
      ? new mongoose.Types.ObjectId(body.entity_id)
      : (body.entity_id || null);

  if (file && file.buffer) {
    attachmentRecord = await fileManagement.uploadMulterFile(
      file,
      body.entity_type || 'lead',
      resolvedEntityId
    );
    if (body.entity_type) attachmentRecord.entity_type = body.entity_type;
    if (body.entity_id) attachmentRecord.entity_id = resolvedEntityId;
    if (body.category) attachmentRecord.category = body.category;
    if (body.remarks) attachmentRecord.remarks = body.remarks;
    attachmentRecord.uploaded_by = {
      _id: user._id || user.id,
      name: user.name || user.email || 'User',
      email: user.email,
    };
    await attachmentRecord.save();
  } else {
    const data = {
      filename: body.filename || body.original_name || 'file',
      original_name: body.original_name || body.filename || 'attachment',
      mime_type: body.mime_type || body.contentType || 'application/octet-stream',
      size: Number(body.size) || 0,
      storage_path: body.storage_path || body.filename || '',
      url: body.url || '',
      entity_type: body.entity_type || 'lead',
      entity_id: resolvedEntityId,
      category: body.category || undefined,
      remarks: body.remarks || '',
      uploaded_by: {
        _id: user._id || user.id,
        name: user.name || user.email || 'User',
        email: user.email,
      },
    };
    attachmentRecord = await Attachment.create(data);
  }

  // Auto-link to OrderPerforma if entity is an order
  if (attachmentRecord.entity_type === 'order' && attachmentRecord.entity_id && OrderPerforma) {
    try {
      const cat = String(attachmentRecord.category || '').toLowerCase();
      const rem = String(attachmentRecord.remarks || '').toLowerCase();
      const fn = String(attachmentRecord.original_name || attachmentRecord.file_name || '').toLowerCase();

      const updateFields = {};
      if (cat === 'po' || rem.startsWith('[po]') || fn.startsWith('po_') || fn.includes('purchase_order')) {
        updateFields.po_attachment = attachmentRecord._id;
      } else if (
        cat === 'cost_sheet' ||
        cat === 'margin_sheet' ||
        rem.includes('cost_sheet') ||
        rem.includes('margin_sheet') ||
        fn.includes('cost_sheet') ||
        fn.includes('margin_sheet')
      ) {
        updateFields.cost_sheet_attachment = attachmentRecord._id;
        updateFields.margin_sheet_attached = 'Attached';
      } else if (
        cat === 'kyc_aadhaar' ||
        cat === 'aadhaar' ||
        cat === 'adhaar' ||
        rem.includes('aadhaar') ||
        rem.includes('adhaar') ||
        fn.includes('aadhaar') ||
        fn.includes('adhaar')
      ) {
        updateFields.aadhaar_attachment = attachmentRecord._id;
        updateFields.kyc_status = 'Attached';
      } else if (cat === 'kyc_pan' || cat === 'pan' || rem.includes('pan') || fn.includes('pan')) {
        updateFields.pan_attachment = attachmentRecord._id;
        updateFields.kyc_status = 'Attached';
      } else if (cat === 'kyc_gst' || cat === 'gst' || rem.includes('gst') || fn.includes('gst')) {
        updateFields.gst_attachment = attachmentRecord._id;
        updateFields.kyc_status = 'Attached';
      } else if (cat.startsWith('kyc') || rem.includes('kyc') || fn.includes('kyc')) {
        updateFields.kyc_status = 'Attached';
      }

      if (Object.keys(updateFields).length > 0) {
        if (user && (user._id || user.id)) {
          updateFields.updated_by = user._id || user.id;
        }
        await OrderPerforma.findOneAndUpdate(
          { order: attachmentRecord.entity_id, deletedAt: null },
          { $set: updateFields }
        );
      }
    } catch (_perfErr) {
      // ignore
    }
  }

  // Create activity log if associated with a lead
  if (attachmentRecord.entity_type === 'lead' && attachmentRecord.entity_id) {
    try {
      await activityService.create({
        entity_type: 'lead',
        entity_id: attachmentRecord.entity_id,
        action: 'attachment_added',
        actor: user._id,
        message: `Attachment uploaded: ${attachmentRecord.original_name}`,
        new_value: {
          attachment_id: attachmentRecord._id,
          filename: attachmentRecord.original_name,
        },
      });
    } catch {
      // ignore activity log error
    }
  }

  return attachmentRecord;
}

/**
 * Soft delete attachment.
 */
async function remove(id, user = {}) {
  const { Attachment } = getModels();
  const item = await Attachment.findById(id);
  if (!item) throw new ApiError(404, 'Attachment not found');

  item.deletedAt = new Date();
  await item.save();
  return { success: true, message: 'Attachment deleted successfully' };
}

/**
 * Restore soft-deleted attachment.
 */
async function restore(id) {
  const { Attachment } = getModels();
  const item = await Attachment.findById(id);
  if (!item) throw new ApiError(404, 'Attachment not found');

  item.deletedAt = null;
  await item.save();
  return item;
}

module.exports = {
  list,
  listDeleted,
  getById,
  create,
  remove,
  restore,
};
