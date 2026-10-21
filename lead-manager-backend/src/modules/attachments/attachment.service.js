/**
 * @fileoverview Attachment Service for managing file attachments across leads and quotations.
 * @module modules/attachments/attachment.service
 */
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const fileManagement = require('../../services/fileManagement');
const activityService = require('../activity/activity.service');

/**
 * List active attachments.
 */
async function list(query = {}) {
  const { Attachment } = getModels();
  const filter = { deletedAt: null };

  if (query.entity_type) filter.entity_type = query.entity_type;
  if (query.entity_id) filter.entity_id = query.entity_id;

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
  if (query.entity_id) filter.entity_id = query.entity_id;

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
  const { Attachment } = getModels();
  let attachmentRecord;

  if (file && file.buffer) {
    attachmentRecord = await fileManagement.uploadMulterFile(
      file,
      body.entity_type || 'lead',
      body.entity_id || null
    );
    if (body.entity_type) attachmentRecord.entity_type = body.entity_type;
    if (body.entity_id) attachmentRecord.entity_id = body.entity_id;
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
      entity_id: body.entity_id || null,
      remarks: body.remarks || '',
      uploaded_by: {
        _id: user._id || user.id,
        name: user.name || user.email || 'User',
        email: user.email,
      },
    };
    attachmentRecord = await Attachment.create(data);
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
