/**
 * @fileoverview File management integration service for lead-manager-backend.
 * Calls the file-management API directly (initiate / complete / view-url / download-url).
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
  const { data } = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${fileId}/view-url`, {
    headers: fmHeaders(),
    timeout: 10000,
  });
  const url = data?.url || data?.viewUrl;
  if (!url) throw new Error('File management API did not return a view URL');
  return url;
}

/**
 * Resolve a short-lived presigned download URL from the file-management API.
 * @param {string} fileId
 * @returns {Promise<string>}
 */
async function getDownloadPresignedUrl(fileId) {
  const { data } = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${fileId}/download-url`, {
    headers: fmHeaders(),
    timeout: 10000,
  });
  const url = data?.url || data?.downloadUrl;
  if (!url) throw new Error('File management API did not return a download URL');
  return url;
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
 * @param {string} resourceType Resource type label (e.g., 'attachment')
 * @param {string} resourceId Resource ID string (Must be a valid 24-hex Mongo ObjectId)
 * @returns {Promise<object>} Created Mongoose Attachment object
 */
async function uploadMulterFile(file, resourceType = 'attachment', resourceId = null) {
  if (!file || !file.buffer || file.buffer.length < 1) {
    throw new Error('Empty or invalid file buffer provided');
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
      }
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
    }
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

module.exports = {
  uploadMulterFile,
  getFileMeta,
  getViewPresignedUrl,
  getDownloadPresignedUrl,
};
