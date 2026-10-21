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

exports.redirectToViewUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}`)) {
    if (att.url.includes('minio') || att.url.includes('X-Amz-') || !att.url.includes('/api/files/')) {
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

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}/view`)) {
    return res.redirect(302, att.url);
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
    if (att.url.includes('minio') || att.url.includes('X-Amz-') || !att.url.includes('/api/files/')) {
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

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes(`/api/files/${fileId}/download`)) {
    return res.redirect(302, att.url);
  }

  throw new ApiError(404, 'File not found or file-management service unable to resolve download URL');
});
