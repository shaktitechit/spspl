/**
 * @fileoverview Attachments: HTTP handlers (thin controllers).
 * @module modules/attachments/attachment.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./attachment.service');
const { uploadMulterFile, getFileMeta, getViewPresignedUrl } = require('../../services/fileManagement/index');
const { API_PUBLIC_BASE_URL, FILE_DOCUMENT_LINKS_RELATIVE } = require('../../config/fileManagement');

function resolveFileId(item) {
  if (!item) return null;
  const entityIdStr = String(item.entity_id || item.order || item._id || '');

  if (item.filename && !String(item.filename).includes('/')) {
    return String(item.filename);
  }
  if (item.fileId && !String(item.fileId).includes('/')) {
    return String(item.fileId);
  }
  if (item.key) {
    const parts = String(item.key).split('/');
    const last = parts[parts.length - 1];
    if (last && last !== entityIdStr && last !== String(item._id || '')) {
      return last;
    }
  }
  if (item.url) {
    const match = String(item.url).match(/\/(?:api\/)?files\/([^/?#]+)/);
    if (match && match[1] && match[1] !== 'view' && match[1] !== 'download') {
      const candidate = match[1];
      if (candidate !== entityIdStr && candidate !== String(item._id || '')) {
        return candidate;
      }
    }
  }
  return null;
}

function getBaseUrl() {
  if (API_PUBLIC_BASE_URL && !API_PUBLIC_BASE_URL.includes('localhost')) {
    return API_PUBLIC_BASE_URL.replace(/\/$/, '');
  }
  return 'https://api.medicaent.in';
}

function ensureViewUrl(item) {
  if (!item) return item;
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const base = getBaseUrl();
  const targetId = obj.filename || obj.fileId || obj._id;
  if (targetId && (!obj.url || obj.url.includes('minio.spspl.com') || !obj.url.includes('/api/files/'))) {
    obj.url = `${base}/api/files/${targetId}/view`;
  }
  return obj;
}

exports.list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({
    success: true,
    data: data.map(ensureViewUrl),
  });
});

exports.get = asyncHandler(async (req, res) => {
  const data = await service.get(req.params.id);
  res.json({ success: true, data: ensureViewUrl(data) });
});

exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) {
      res.status(400);
      throw new Error('entity_type and entity_id are required when uploading a file');
    }

    const fileId = await uploadMulterFile(req.file, entity_type, entity_id);
    const meta = await getFileMeta(fileId);
    const base = getBaseUrl();

    body.filename = fileId;
    body.storage_path = meta.objectKey || fileId;
    body.original_name = meta.originalName || req.file.originalname;
    body.file_name = meta.originalName || req.file.originalname;
    body.mime_type = meta.mimeType || req.file.mimetype;
    body.size = meta.sizeBytes || req.file.size;
    body.storage_provider = 'minio';
    body.bucket = meta.bucket || 'company-files';
    body.key = meta.objectKey || fileId;
    body.url = `${base}/api/files/${fileId}/view`;
  }

  const created = await service.create(body, req.user);
  res.status(201).json({ success: true, data: ensureViewUrl(created) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.remove(req.params.id, req.user) });
});

exports.restore = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.restore(req.params.id, req.user) });
});

exports.listDeleted = asyncHandler(async (req, res) => {
  const data = await service.listDeleted(req.query);
  res.json({
    success: true,
    data: data.map(ensureViewUrl),
  });
});
