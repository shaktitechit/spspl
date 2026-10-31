/**
 * @fileoverview Files: HTTP handlers (thin controllers).
 * @module modules/files/files.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const {
  getViewPresignedUrl,
  getDownloadPresignedUrl,
} = require('../../services/fileManagement/index');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const mongoose = require('mongoose');

async function findAttachmentRecord(fileId) {
  if (!fileId) return null;
  const models = getModels();
  const {
    Attachment,
    OrderDueSheet,
    OrderDispatch,
    OrderDelivery,
    OrderReturn,
    Order,
    Quotation,
    Lead,
  } = models;

  let att = null;

  // 1. Direct query on Attachment collection for filename, key, storage_path, or url match
  if (Attachment) {
    att = await Attachment.findOne({
      $or: [
        { filename: fileId },
        { fileId: fileId },
        { key: new RegExp(fileId, 'i') },
        { storage_path: new RegExp(fileId, 'i') },
        { url: new RegExp(fileId, 'i') },
      ],
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  // 2. Entity lookups if fileId is a valid ObjectId
  if (!att && mongoose.Types.ObjectId.isValid(fileId)) {
    if (Attachment) {
      att = await Attachment.findById(fileId).lean();
    }
    if (!att && OrderDueSheet) {
      const dueSheet = await OrderDueSheet.findById(fileId).lean();
      if (dueSheet) {
        if (dueSheet.document && Attachment) {
          att = await Attachment.findById(dueSheet.document).lean();
        }
        if (!att && Attachment) {
          att = await Attachment.findOne({ entity_id: dueSheet._id })
            .sort({ createdAt: -1 })
            .lean();
        }
      }
    }
    if (!att && OrderDispatch) {
      const dispatch = await OrderDispatch.findById(fileId).lean();
      if (dispatch) {
        if (dispatch.bill_document && Attachment) {
          att = await Attachment.findById(dispatch.bill_document).lean();
        }
        if (!att && Attachment) {
          att = await Attachment.findOne({ entity_id: dispatch._id })
            .sort({ createdAt: -1 })
            .lean();
        }
      }
    }
    if (!att && OrderDelivery) {
      const delivery = await OrderDelivery.findById(fileId).lean();
      if (delivery && delivery.proof_document && Attachment) {
        att = await Attachment.findById(delivery.proof_document).lean();
      }
    }
    if (!att && OrderReturn) {
      const retDoc = await OrderReturn.findById(fileId).lean();
      if (retDoc && retDoc.document && Attachment) {
        att = await Attachment.findById(retDoc.document).lean();
      }
    }
    if (!att && Order) {
      const order = await Order.findById(fileId).lean();
      if (order && Attachment) {
        att = await Attachment.findOne({
          $or: [{ entity_id: order._id }, { order: order._id }],
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }
    if (!att && Quotation) {
      const quot = await Quotation.findById(fileId).lean();
      if (quot && Attachment) {
        att = await Attachment.findOne({
          $or: [{ entity_id: quot._id }, { quotation: quot._id }],
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }
    if (!att && Lead) {
      const lead = await Lead.findById(fileId).lean();
      if (lead && Attachment) {
        att = await Attachment.findOne({
          $or: [{ entity_id: lead._id }, { lead: lead._id }],
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }
    if (!att && Attachment) {
      att = await Attachment.findOne({
        $or: [
          { entity_id: fileId },
          { order: fileId },
        ],
      })
        .sort({ createdAt: -1 })
        .lean();
    }
  }

  return att;
}

function getCandidates(fileId, att) {
  const candidates = [];
  if (fileId) candidates.push(fileId);

  if (!att) return candidates;

  if (att.filename) candidates.push(String(att.filename));
  if (att.fileId) candidates.push(String(att.fileId));

  const keyVal = att.key || att.storage_path || att.file_key;
  if (keyVal) {
    const keyStr = String(keyVal);
    candidates.push(keyStr);

    const parts = keyStr.split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      candidates.push(lastPart);
      const dotIdx = lastPart.lastIndexOf('.');
      if (dotIdx > 0) {
        candidates.push(lastPart.substring(0, dotIdx));
      }
    }
  }

  if (att.url) {
    const match = String(att.url).match(/\/api\/files\/([^/?#]+)/);
    if (match && match[1] && match[1] !== 'view' && match[1] !== 'download') {
      candidates.push(match[1]);
    }
  }

  const unique = [];
  const seen = new Set();
  for (const c of candidates) {
    if (c && typeof c === 'string' && !seen.has(c)) {
      seen.add(c);
      unique.push(c);
    }
  }

  return unique;
}

const FILE_NOT_FOUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="2" y="2" width="596" height="396" rx="12" fill="none" stroke="#e2e8f0" stroke-width="4"/>
  <g transform="translate(250, 110)">
    <circle cx="50" cy="50" r="45" fill="#fee2e2"/>
    <path d="M35 35 L65 65 M65 35 L35 65" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
  </g>
  <text x="300" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#1e293b" text-anchor="middle">Document File Not Found</text>
  <text x="300" y="275" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">This file record has no binary file payload stored on object storage.</text>
  <text x="300" y="300" font-family="system-ui, -apple-system, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">Please re-upload or replace this attachment.</text>
</svg>`;

function isPresignedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /X-Amz-Signature|X-Amz-Credential|X-Amz-Date/i.test(url);
}

function isPresignedUrlExpired(url) {
  if (!isPresignedUrl(url)) return false;
  try {
    const u = new URL(url);
    const amzDate = u.searchParams.get('X-Amz-Date');
    const amzExpires = parseInt(u.searchParams.get('X-Amz-Expires') || '0', 10);
    if (!amzDate || !amzExpires) return true;
    const year = amzDate.substring(0, 4);
    const month = amzDate.substring(4, 6);
    const day = amzDate.substring(6, 8);
    const hour = amzDate.substring(9, 11);
    const min = amzDate.substring(11, 13);
    const sec = amzDate.substring(13, 15);
    const createdTime = Date.parse(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
    if (isNaN(createdTime)) return true;
    return Date.now() >= createdTime + (amzExpires - 30) * 1000;
  } catch {
    return true;
  }
}

async function resolveFileIdFromResource(att, fileId) {
  try {
    let resourceType = att?.entity_type;
    let resourceId = att?.entity_id ? String(att.entity_id) : null;
    const pathOrUrl = att?.storage_path || att?.url || att?.key || fileId || '';
    if (!resourceType || !resourceId) {
      const match = pathOrUrl.match(/resource\/([^/]+)\/([0-9a-fA-F]{24})/i);
      if (match) {
        resourceType = match[1];
        resourceId = match[2];
      }
    }
    if (resourceType && resourceId && /^[0-9a-fA-F]{24}$/.test(resourceId)) {
      const { fmJson } = require('../../services/fileManagement/index');
      const fmRes = await fmJson(
        `/files?resource_type=${encodeURIComponent(resourceType)}&resource_id=${encodeURIComponent(resourceId)}`,
        undefined,
        'GET',
        { timeoutMs: 6000 }
      );
      if (fmRes && Array.isArray(fmRes.items) && fmRes.items.length > 0) {
        const uuidMatch = pathOrUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        const targetFilename = uuidMatch ? uuidMatch[0] : null;
        const origName = att?.original_name || att?.file_name;
        const matched = fmRes.items.find((it) => {
          if (targetFilename && it.objectKey && it.objectKey.includes(targetFilename)) return true;
          if (origName && (it.originalName === origName || it.name === origName)) return true;
          return false;
        }) || fmRes.items[0];

        if (matched && matched.id) {
          return matched.id;
        }
      }
    }
  } catch (_e) {
    // Ignore fallback failure
  }
  return null;
}

exports.redirectToViewUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}`)) {
    if (!isPresignedUrl(att.url) && !att.url.includes('minio')) {
      return res.redirect(302, att.url);
    }
    if (!isPresignedUrlExpired(att.url)) {
      return res.redirect(302, att.url);
    }
  }

  const candidates = getCandidates(fileId, att);

  for (const candidate of candidates) {
    try {
      const presignedUrl = await getViewPresignedUrl(candidate);
      if (presignedUrl) {
        return res.redirect(302, presignedUrl);
      }
    } catch (_err) {
      // try next candidate
    }
  }

  // Fallback: lookup file ID from file-management service by resource type & ID
  const fallbackId = await resolveFileIdFromResource(att, fileId);
  if (fallbackId) {
    try {
      const presignedUrl = await getViewPresignedUrl(fallbackId);
      if (presignedUrl) {
        return res.redirect(302, presignedUrl);
      }
    } catch (_err) {
      // try next candidate
    }
  }

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}/view`)) {
    if (!isPresignedUrlExpired(att.url)) {
      return res.redirect(302, att.url);
    }
  }

  // Always serve SVG placeholder with HTTP 200 for view requests when file payload is missing
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(FILE_NOT_FOUND_SVG);
});

exports.redirectToDownloadUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}`)) {
    if (!isPresignedUrl(att.url) && !att.url.includes('minio')) {
      return res.redirect(302, att.url);
    }
    if (!isPresignedUrlExpired(att.url)) {
      return res.redirect(302, att.url);
    }
  }

  const candidates = getCandidates(fileId, att);

  for (const candidate of candidates) {
    try {
      const presignedUrl = await getDownloadPresignedUrl(candidate);
      if (presignedUrl) {
        return res.redirect(302, presignedUrl);
      }
    } catch (_err) {
      // try next candidate
    }
  }

  // Fallback: lookup file ID from file-management service by resource type & ID
  const fallbackId = await resolveFileIdFromResource(att, fileId);
  if (fallbackId) {
    try {
      const presignedUrl = await getDownloadPresignedUrl(fallbackId);
      if (presignedUrl) {
        return res.redirect(302, presignedUrl);
      }
    } catch (_err) {
      // try next candidate
    }
  }

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}/download`)) {
    if (!isPresignedUrlExpired(att.url)) {
      return res.redirect(302, att.url);
    }
  }

  throw new ApiError(404, 'File not found or file-management service unable to resolve download URL');
});
