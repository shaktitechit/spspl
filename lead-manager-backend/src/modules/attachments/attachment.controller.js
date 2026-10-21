/**
 * @fileoverview Attachment Controller for lead-manager-backend.
 * @module modules/attachments/attachment.controller
 */
const attachmentService = require('./attachment.service');
const { getViewPresignedUrl } = require('../../services/fileManagement');

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/** Prefer stored FM fileId (filename); fall back to /api/files/:id/ from legacy URLs. */
function resolveFileId(item) {
  if (!item) return null;
  if (item.filename && !String(item.filename).includes('/')) {
    return String(item.filename);
  }
  if (item.url) {
    const match = String(item.url).match(/\/(?:api\/)?files\/([^/]+)/);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function withFreshViewUrl(item) {
  if (!item) return item;
  const obj = item.toObject ? item.toObject() : { ...item };
  const fileId = resolveFileId(obj);
  if (!fileId) return obj;

  try {
    obj.url = await getViewPresignedUrl(fileId);
  } catch {
    // Keep stored url if file-manager lookup fails
  }
  return obj;
}

exports.list = asyncHandler(async (req, res) => {
  const data = await attachmentService.list(req.query);
  res.json({
    success: true,
    data: await Promise.all(data.map(withFreshViewUrl)),
  });
});

exports.listDeleted = asyncHandler(async (req, res) => {
  const data = await attachmentService.listDeleted(req.query);
  res.json({
    success: true,
    data,
  });
});

exports.getById = asyncHandler(async (req, res) => {
  const data = await attachmentService.getById(req.params.id);
  res.json({
    success: true,
    data: await withFreshViewUrl(data),
  });
});

exports.create = asyncHandler(async (req, res) => {
  const data = await attachmentService.create(req.body, req.file || null, req.user);
  res.status(201).json({
    success: true,
    message: 'Attachment uploaded successfully',
    data: await withFreshViewUrl(data),
  });
});

exports.remove = asyncHandler(async (req, res) => {
  const data = await attachmentService.remove(req.params.id, req.user);
  res.json({
    success: true,
    data,
  });
});

exports.restore = asyncHandler(async (req, res) => {
  const data = await attachmentService.restore(req.params.id);
  res.json({
    success: true,
    message: 'Attachment restored successfully',
    data,
  });
});
