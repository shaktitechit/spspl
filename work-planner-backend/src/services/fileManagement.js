/**
 * @fileoverview File management integration service for work-planner-backend.
 * Calls the file-management API directly (initiate / complete / view-url).
 * @module services/fileManagement
 */
const axios = require('axios');
const mongoose = require('mongoose');
const { FILE_MANAGEMENT_API_URL, FILE_MANAGEMENT_API_KEY } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fmHeaders(extra = {}) {
  return {
    'X-Api-Key': FILE_MANAGEMENT_API_KEY,
    ...extra,
  };
}

async function getFileMeta(fileId) {
  const response = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${fileId}`, {
    headers: fmHeaders(),
  });
  return response.data;
}

/**
 * Resolve a short-lived presigned view URL from the file-management API.
 * @param {string} fileId
 * @returns {Promise<string>}
 */
async function getViewPresignedUrl(fileId) {
  if (!fileId) throw new Error('No fileId provided');
  const candidates = [fileId];
  if (typeof fileId === 'string' && fileId.includes('.')) {
    candidates.push(fileId.split('.')[0]);
  }

  for (const cid of candidates) {
    try {
      const { data } = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${cid}/view-url`, {
        headers: fmHeaders(),
        timeout: 8000,
      });
      const url = data?.url || data?.viewUrl;
      if (url) return url;
    } catch (_err) {}
  }

  throw new Error(`File management API did not return a view URL for ${fileId}`);
}

function resolveFileIdCandidateList(item) {
  if (!item) return [];
  const list = [];
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (/^[a-f0-9]{24}$/i.test(trimmed)) {
      list.push(trimmed);
    }

    const resMatch = trimmed.match(/\/resource\/[^/]+\/([a-f0-9]{24})\//i);
    if (resMatch?.[1]) list.push(resMatch[1]);

    const attMatch = trimmed.match(/\/(?:api\/)?(?:work-planner|projects)\/attachments\/([^/?#]+)/i);
    if (attMatch?.[1]) list.push(attMatch[1]);

    const origMatch = trimmed.match(/\/original\/([^/?#]+)/i);
    if (origMatch?.[1]) list.push(origMatch[1]);

    const fileMatch = trimmed.match(/\/(?:api\/)?files\/([^/?#]+)/i);
    if (fileMatch?.[1]) list.push(fileMatch[1]);

    const uuidMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (uuidMatch?.[1]) list.push(uuidMatch[1]);

    const uuidExtMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z0-9]+)/i);
    if (uuidExtMatch?.[1]) list.push(uuidExtMatch[1]);
  } else if (typeof item === 'object') {
    if (item.filename && !String(item.filename).includes('/')) list.push(String(item.filename));
    if (item.file_name && !String(item.file_name).includes('/')) list.push(String(item.file_name));
    if (item.storage_path) list.push(...resolveFileIdCandidateList(String(item.storage_path)));
    if (item.url) list.push(...resolveFileIdCandidateList(String(item.url)));
    if (item._id) list.push(String(item._id));
    if (item.id) list.push(String(item.id));
  }
  return [...new Set(list)].filter(Boolean);
}

function resolveFileId(item) {
  const candidates = resolveFileIdCandidateList(item);
  return candidates[0] || null;
}

/**
 * Replace a stored/legacy attachment URL with a backend proxy preview URL.
 * @param {object|null} item
 * @returns {Promise<object|null>}
 */
async function withFreshViewUrl(item) {
  if (!item) return item;
  const obj = item.toObject ? item.toObject() : { ...item };
  const candidates = resolveFileIdCandidateList(obj);
  if (candidates.length === 0) return obj;
  obj.url = `/api/work-planner/attachments/${candidates[0]}/preview`;
  return obj;
}

async function refreshUrlString(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  const { Attachment } = getModels();
  const candidates = resolveFileIdCandidateList(urlStr);
  if (candidates.length === 0) return urlStr;

  if (Attachment) {
    for (const cid of candidates) {
      if (cid && cid.length >= 8) {
        try {
          const query = [
            { filename: cid },
            { storage_path: { $regex: cid, $options: 'i' } },
            { url: { $regex: cid, $options: 'i' } },
          ];
          if (mongoose.Types.ObjectId.isValid(cid)) {
            query.unshift({ _id: new mongoose.Types.ObjectId(cid) });
          }
          const att = await Attachment.findOne({ $or: query }).lean();
          if (att) {
            return `/api/work-planner/attachments/${att._id}/preview`;
          }
        } catch (_err) {}
      }
    }
  }

  return `/api/work-planner/attachments/${candidates[0]}/preview`;
}

/**
 * Refresh signed view URLs for visit selfie images.
 * @param {object} visit
 * @returns {Promise<object>}
 */
async function withFreshVisitSelfieUrls(visit) {
  if (!visit) return visit;
  const out = { ...visit };
  if (out.check_in_selfie_url) {
    out.check_in_selfie_url = await refreshUrlString(out.check_in_selfie_url);
  }
  if (out.check_out_selfie_url) {
    out.check_out_selfie_url = await refreshUrlString(out.check_out_selfie_url);
  }
  if (out.outcome_selfie_url) {
    out.outcome_selfie_url = await refreshUrlString(out.outcome_selfie_url);
  }

  if (!out.check_out_selfie_url && out.outcome_selfie_url) {
    out.check_out_selfie_url = out.outcome_selfie_url;
  }
  if (!out.outcome_selfie_url && out.check_out_selfie_url) {
    out.outcome_selfie_url = out.check_out_selfie_url;
  }

  if (!out.check_in_address && typeof out.check_in_lat === 'number' && typeof out.check_in_lng === 'number') {
    out.check_in_address = `Lat: ${out.check_in_lat.toFixed(4)}, Lng: ${out.check_in_lng.toFixed(4)}`;
  }
  if (!out.check_out_address && typeof out.check_out_lat === 'number' && typeof out.check_out_lng === 'number') {
    out.check_out_address = `Lat: ${out.check_out_lat.toFixed(4)}, Lng: ${out.check_out_lng.toFixed(4)}`;
  }

  if (!out.check_out_address && out.check_in_address) {
    out.check_out_address = out.check_in_address;
    if (out.check_out_lat === undefined || out.check_out_lat === null) {
      out.check_out_lat = out.check_in_lat;
      out.check_out_lng = out.check_in_lng;
    }
  }
  if (!out.check_in_address && out.check_out_address) {
    out.check_in_address = out.check_out_address;
    if (out.check_in_lat === undefined || out.check_in_lat === null) {
      out.check_in_lat = out.check_out_lat;
      out.check_in_lng = out.check_out_lng;
    }
  }

  if (!out.check_in_address && out.address) {
    out.check_in_address = out.address;
  }
  if (!out.check_out_address && out.address) {
    out.check_out_address = out.address;
  }

  return out;
}

/**
 * Refresh view URLs on common expense attachment fields.
 * @param {object} expense
 * @returns {Promise<object>}
 */
async function withFreshExpenseAttachmentUrls(expense) {
  if (!expense) return expense;
  const out = { ...expense };
  const fields = ['receipt_attachment', 'start_reading_image', 'end_reading_image'];
  await Promise.all(
    fields.map(async (field) => {
      if (out[field] && typeof out[field] === 'object') {
        out[field] = await withFreshViewUrl(out[field]);
      }
    }),
  );
  if (Array.isArray(out.attachments) && out.attachments.length > 0) {
    out.attachments = await Promise.all(
      out.attachments.map(async (att) => {
        if (att && typeof att === 'object') {
          return withFreshViewUrl(att);
        }
        return att;
      }),
    );
  }
  return out;
}

async function waitUntilFileAccessible(fileId) {
  const start = Date.now();
  const maxWait = 15000;
  const interval = 500;

  while (Date.now() - start < maxWait) {
    try {
      const meta = await getFileMeta(fileId);
      if (meta.status === 'ready' || meta.status === 'uploaded') {
        return meta;
      }
      if (meta.status === 'failed' || meta.scanStatus === 'infected') {
        throw new Error('File failed processing or virus check in file management service');
      }
    } catch (err) {
      if (err.message && err.message.includes('File failed processing')) {
        throw err;
      }
    }
    await sleep(interval);
  }

  return getFileMeta(fileId);
}

/**
 * Upload a Multer file to object storage via file-management API and save Attachment document.
 * @param {object} file Multer file object
 * @param {string} resourceType Resource type label (e.g., 'work_plan_expense')
 * @param {string} resourceId Resource ID string (Must be a valid 24-hex Mongo ObjectId)
 * @returns {Promise<object>} Created Mongoose Attachment object
 */
async function uploadMulterFile(file, resourceType = 'work_plan_expense', resourceId = null) {
  if (!file || !file.buffer || file.buffer.length < 1) {
    throw new Error('Empty or invalid file buffer');
  }

  const validResourceId =
    resourceId && mongoose.Types.ObjectId.isValid(resourceId)
      ? String(resourceId)
      : new mongoose.Types.ObjectId().toHexString();

  const originalName = file.originalname ? file.originalname.trim() : 'receipt.pdf';
  const mimeType = file.mimetype || 'application/octet-stream';
  const sizeBytes = file.buffer.length;

  let initiateRes;
  try {
    initiateRes = await axios.post(
      `${FILE_MANAGEMENT_API_URL}/files/upload/initiate`,
      {
        originalName,
        sizeBytes,
        mimeType,
        resourceType,
        resourceId: validResourceId,
      },
      {
        headers: fmHeaders({ 'Content-Type': 'application/json' }),
      },
    );
  } catch (err) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`File Management initiate failed: ${errorDetails}`);
  }

  const initiate = initiateRes.data;
  const { fileId, presignedUrl, headers = {} } = initiate;

  const putHeaders = { ...headers };
  if (!putHeaders['Content-Type'] && !putHeaders['content-type']) {
    putHeaders['Content-Type'] = mimeType;
  }

  await axios.put(presignedUrl, file.buffer, {
    headers: putHeaders,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  await axios.post(
    `${FILE_MANAGEMENT_API_URL}/files/upload/complete`,
    { fileId },
    {
      headers: fmHeaders({ 'Content-Type': 'application/json' }),
    },
  );

  const meta = await waitUntilFileAccessible(fileId);
  const viewUrl = await getViewPresignedUrl(fileId);

  const { Attachment } = getModels();
  const attachmentData = {
    filename: fileId,
    original_name: meta.originalName || originalName,
    file_name: meta.originalName || originalName,
    mime_type: meta.mimeType || mimeType,
    size: meta.sizeBytes || sizeBytes,
    storage_path: meta.objectKey || fileId,
    // Direct file-manager presigned view URL (refreshed on read via filename/fileId).
    url: viewUrl,
  };

  const attachment = await Attachment.create(attachmentData);
  return attachment;
}

/**
 * Resolve a short-lived presigned download URL from the file-management API.
 * @param {string} fileId
 * @returns {Promise<string>}
 */
async function getDownloadPresignedUrl(fileId) {
  if (!fileId) throw new Error('No fileId provided');
  const candidates = [fileId];
  if (typeof fileId === 'string' && fileId.includes('.')) {
    candidates.push(fileId.split('.')[0]);
  }

  for (const cid of candidates) {
    try {
      const { data } = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${cid}/download-url`, {
        headers: fmHeaders(),
        timeout: 8000,
      });
      const url = data?.url || data?.downloadUrl;
      if (url) return url;
    } catch (_err) {}
  }

  throw new Error(`File management API did not return a download URL for ${fileId}`);
}

const FILE_NOT_FOUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="2" y="2" width="596" height="396" rx="12" fill="none" stroke="#e2e8f0" stroke-width="4"/>
  <g transform="translate(250, 110)">
    <circle cx="50" cy="50" r="45" fill="#fee2e2"/>
    <path d="M35 35 L65 65 M65 35 L35 65" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>
  </g>
  <text x="300" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#1e293b" text-anchor="middle">Document Preview Unavailable</text>
  <text x="300" y="275" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#64748b" text-anchor="middle">The requested attachment payload could not be loaded from storage.</text>
</svg>`;

/**
 * Streams file binary payload from File Management / MinIO backend directly to the HTTP response.
 * Completely eliminates MinIO "Access Denied" errors and avoids client-side presigned URL expiration.
 * @param {string} identifier Attachment ID, ProjectFile ID, filename, or storage_path
 * @param {object} res Express response object
 * @param {object} options Options like disposition ('inline' | 'attachment') and filename
 */
async function streamFileToResponse(identifier, res, options = {}) {
  const { Attachment, ProjectFile } = getModels();

  let att = null;
  if (identifier && mongoose.Types.ObjectId.isValid(identifier)) {
    if (Attachment) {
      att = await Attachment.findById(identifier).lean();
    }
    if (!att && ProjectFile) {
      const pFile = await ProjectFile.findById(identifier).lean();
      if (pFile) {
        if (pFile.attachment_id && mongoose.Types.ObjectId.isValid(pFile.attachment_id)) {
          att = await Attachment.findById(pFile.attachment_id).lean();
        }
        if (!att) {
          att = {
            filename: pFile.attachment_id || pFile._id,
            file_name: pFile.file_name,
            original_name: pFile.file_name,
            mime_type: pFile.mime_type,
            size: pFile.size_bytes,
          };
        }
      }
    }
  }

  if (!att && Attachment && identifier) {
    att = await Attachment.findOne({
      $or: [
        { filename: identifier },
        { fileId: identifier },
        { storage_path: identifier },
        { key: identifier },
        { url: identifier },
        { storage_path: { $regex: identifier, $options: 'i' } },
        { url: { $regex: identifier, $options: 'i' } },
      ],
    }).lean();
  }

  const rawCandidates = resolveFileIdCandidateList(att || identifier);
  if (typeof identifier === 'string' && identifier && !rawCandidates.includes(identifier)) {
    rawCandidates.unshift(identifier);
  }

  // If still not found, try candidates regex lookup
  if (!att && Attachment) {
    for (const cid of rawCandidates) {
      if (cid && cid.length >= 8) {
        try {
          att = await Attachment.findOne({
            $or: [
              { filename: cid },
              { storage_path: { $regex: cid, $options: 'i' } },
              { url: { $regex: cid, $options: 'i' } },
            ],
          }).lean();
          if (att) break;
        } catch (_err) {}
      }
    }
  }

  const candidates = [];
  if (att?.filename && !candidates.includes(String(att.filename))) candidates.push(String(att.filename));
  if (att?.fileId && !candidates.includes(String(att.fileId))) candidates.push(String(att.fileId));
  for (const c of rawCandidates) {
    if (c && !candidates.includes(c)) candidates.push(c);
  }
  if (att?._id && !candidates.includes(String(att._id))) candidates.push(String(att._id));

  for (const cid of candidates) {
    try {
      const presignedUrl =
        options.disposition === 'attachment'
          ? await getDownloadPresignedUrl(cid).catch(() => getViewPresignedUrl(cid))
          : await getViewPresignedUrl(cid);

      if (presignedUrl) {
        let streamRes;
        try {
          streamRes = await axios.get(presignedUrl, {
            responseType: 'stream',
            timeout: 20000,
            headers: {
              'User-Agent': 'WorkPlannerBackend/1.0',
            },
          });
        } catch (err) {
          if (presignedUrl.includes('localhost') || presignedUrl.includes('127.0.0.1')) {
            const altUrl = presignedUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
            streamRes = await axios.get(altUrl, {
              responseType: 'stream',
              timeout: 20000,
              headers: {
                'User-Agent': 'WorkPlannerBackend/1.0',
              },
            });
          } else {
            throw err;
          }
        }

        const contentType =
          options.mimeType ||
          att?.mime_type ||
          streamRes.headers['content-type'] ||
          'application/octet-stream';

        const filename = options.filename || att?.file_name || att?.original_name || 'attachment';
        const disposition = options.disposition || 'inline';

        res.setHeader('Content-Type', contentType);
        if (streamRes.headers['content-length']) {
          res.setHeader('Content-Length', streamRes.headers['content-length']);
        }
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Cache-Control', 'public, max-age=86400');

        return streamRes.data.pipe(res);
      }
    } catch (_err) {
      // try next candidate
    }
  }

  // If a direct URL exists on the attachment record, attempt streaming it
  if (att?.url && /^https?:\/\//i.test(att.url)) {
    try {
      let directRes;
      try {
        directRes = await axios.get(att.url, {
          responseType: 'stream',
          timeout: 20000,
        });
      } catch (err) {
        if (att.url.includes('localhost') || att.url.includes('127.0.0.1')) {
          const altDirect = att.url.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
          directRes = await axios.get(altDirect, {
            responseType: 'stream',
            timeout: 20000,
          });
        } else {
          throw err;
        }
      }
      const contentType =
        options.mimeType ||
        att?.mime_type ||
        directRes.headers['content-type'] ||
        'application/octet-stream';
      const filename = options.filename || att?.file_name || att?.original_name || 'attachment';
      const disposition = options.disposition || 'inline';

      res.setHeader('Content-Type', contentType);
      if (directRes.headers['content-length']) {
        res.setHeader('Content-Length', directRes.headers['content-length']);
      }
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return directRes.data.pipe(res);
    } catch (_err) {}
  }

  // Serve fallback SVG if binary payload cannot be resolved
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(FILE_NOT_FOUND_SVG);
}

/**
 * Resolves attachment identifiers or objects to formatted email attachments
 * with base64 encoded file content buffers for email providers (Microsoft Graph, Gmail, SMTP).
 *
 * @param {Array<string|object>} rawAtts - Array of attachment IDs, filenames, or attachment documents
 * @returns {Promise<Array<{ filename: string, content: string, contentType: string, path?: string }>>}
 */
async function resolveEmailAttachments(rawAtts) {
  if (!Array.isArray(rawAtts) || rawAtts.length === 0) return [];
  const { Attachment } = getModels();
  if (!Attachment) return [];

  const rawIds = rawAtts
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return item.trim();
      if (typeof item === 'object') return String(item._id || item.id || item.filename || item.fileId || '');
      return null;
    })
    .filter(Boolean);

  if (rawIds.length === 0) return [];

  const objectIds = rawIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const query = [];
  if (objectIds.length > 0) {
    query.push({ _id: { $in: objectIds } });
  }
  query.push({ filename: { $in: rawIds } });
  query.push({ fileId: { $in: rawIds } });
  query.push({ storage_path: { $in: rawIds } });

  let attachmentDocs = [];
  try {
    attachmentDocs = await Attachment.find({ $or: query }).lean();
  } catch (_err) {
    try {
      if (objectIds.length > 0) {
        attachmentDocs = await Attachment.find({ _id: { $in: objectIds } }).lean();
      }
    } catch (_e) {}
  }

  // Deduplicate docs by _id or filename
  const seenKeys = new Set();
  const uniqueDocs = [];
  for (const doc of attachmentDocs) {
    const key = String(doc._id || doc.filename);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueDocs.push(doc);
    }
  }

  const emailAttachments = await Promise.all(
    uniqueDocs.map(async (att) => {
      const originalName = att.original_name || att.file_name || att.filename || 'attachment.pdf';
      const mimeType = att.mime_type || 'application/octet-stream';

      const candidates = resolveFileIdCandidateList(att);
      let buffer = null;

      // Try downloading via presigned URLs
      for (const cid of candidates) {
        try {
          const presignedUrl = await getDownloadPresignedUrl(cid).catch(() => getViewPresignedUrl(cid));
          if (presignedUrl) {
            let res;
            try {
              res = await axios.get(presignedUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: { 'User-Agent': 'WorkPlannerBackend/1.0' },
              });
            } catch (err) {
              if (presignedUrl.includes('localhost') || presignedUrl.includes('127.0.0.1')) {
                const altUrl = presignedUrl.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
                res = await axios.get(altUrl, {
                  responseType: 'arraybuffer',
                  timeout: 20000,
                  headers: { 'User-Agent': 'WorkPlannerBackend/1.0' },
                });
              } else {
                throw err;
              }
            }
            if (res?.data) {
              buffer = Buffer.from(res.data);
              break;
            }
          }
        } catch (_err) {}
      }

      // If presigned URL failed, try att.url if it's an HTTP URL
      if (!buffer && att.url && /^https?:\/\//i.test(att.url)) {
        try {
          let res;
          try {
            res = await axios.get(att.url, {
              responseType: 'arraybuffer',
              timeout: 20000,
            });
          } catch (err) {
            if (att.url.includes('localhost') || att.url.includes('127.0.0.1')) {
              const altUrl = att.url.replace(/localhost|127\.0\.0\.1/, 'host.docker.internal');
              res = await axios.get(altUrl, {
                responseType: 'arraybuffer',
                timeout: 20000,
              });
            } else {
              throw err;
            }
          }
          if (res?.data) {
            buffer = Buffer.from(res.data);
          }
        } catch (_err) {}
      }

      if (buffer) {
        return {
          filename: originalName,
          content: buffer.toString('base64'),
          contentType: mimeType,
        };
      }

      // Fallback: return path if URL available
      return {
        filename: originalName,
        path: att.url || undefined,
        contentType: mimeType,
      };
    })
  );

  return emailAttachments.filter((a) => a && (a.content || a.path));
}

module.exports = {
  uploadMulterFile,
  getFileMeta,
  getViewPresignedUrl,
  getDownloadPresignedUrl,
  streamFileToResponse,
  resolveFileId,
  resolveFileIdCandidateList,
  withFreshViewUrl,
  withFreshVisitSelfieUrls,
  withFreshExpenseAttachmentUrls,
  resolveEmailAttachments,
};

