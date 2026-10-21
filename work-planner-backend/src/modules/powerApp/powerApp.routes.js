/**
 * @fileoverview Routes & controller for Power App External API proxy (Facilities & Enquiries).
 * @module modules/powerApp/powerApp.routes
 */
const express = require('express');
const axios = require('axios');
const { POWER_APP_BASE_URL, POWER_APP_API_KEY } = require('../../config/env');
const asyncHandler = require('../../utils/asyncHandler');
const { logger } = require('../../utils/logger');

const router = express.Router();

function getClient() {
  const baseURL = (POWER_APP_BASE_URL || 'https://power.spspl.com').replace(/\/$/, '');
  const apiKey = POWER_APP_API_KEY || '';
  return axios.create({
    baseURL: `${baseURL}/api/v1/external`,
    headers: {
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      Accept: 'application/json',
    },
    timeout: 15000,
  });
}

/**
 * GET /api/power-app/facilities or /api/facilities
 */
router.get(
  '/facilities',
  asyncHandler(async (req, res) => {
    if (!POWER_APP_API_KEY) {
      logger.warn?.('POWER_APP_API_KEY is not configured in environment.');
      return res.status(200).json({ success: false, data: [], message: 'POWER_APP_API_KEY is not configured' });
    }
    try {
      const client = getClient();
      const response = await client.get('/facilities', { params: req.query });
      return res.status(response.status).json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const data = err.response?.data || { success: false, data: [], message: 'Could not fetch facilities from Power App', error: err.message };
      logger.error?.(`Power App facilities fetch error (${status}):`, err?.message || err);
      return res.status(status).json(data);
    }
  })
);

/**
 * GET /api/power-app/facilities/:id
 */
router.get(
  '/facilities/:id',
  asyncHandler(async (req, res) => {
    if (!POWER_APP_API_KEY) {
      return res.status(404).json({ success: false, message: 'POWER_APP_API_KEY is not configured' });
    }
    try {
      const client = getClient();
      const response = await client.get(`/facilities/${encodeURIComponent(req.params.id)}`);
      return res.status(response.status).json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const data = err.response?.data || { success: false, message: 'Could not fetch facility from Power App', error: err.message };
      logger.error?.(`Power App facility detail error (${status}):`, err?.message || err);
      return res.status(status).json(data);
    }
  })
);

/**
 * GET /api/power-app/enquiries or /api/enquiries
 */
router.get(
  '/enquiries',
  asyncHandler(async (req, res) => {
    if (!POWER_APP_API_KEY) {
      logger.warn?.('POWER_APP_API_KEY is not configured in environment.');
      return res.status(200).json({ success: false, data: [], message: 'POWER_APP_API_KEY is not configured' });
    }
    try {
      const client = getClient();
      const response = await client.get('/enquiries', { params: req.query });
      return res.status(response.status).json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const data = err.response?.data || { success: false, data: [], message: 'Could not fetch enquiries from Power App', error: err.message };
      logger.error?.(`Power App enquiries fetch error (${status}):`, err?.message || err);
      return res.status(status).json(data);
    }
  })
);

/**
 * GET /api/power-app/enquiries/:id
 */
router.get(
  '/enquiries/:id',
  asyncHandler(async (req, res) => {
    if (!POWER_APP_API_KEY) {
      return res.status(404).json({ success: false, message: 'POWER_APP_API_KEY is not configured' });
    }
    try {
      const client = getClient();
      const response = await client.get(`/enquiries/${encodeURIComponent(req.params.id)}`);
      return res.status(response.status).json(response.data);
    } catch (err) {
      const status = err.response?.status || 502;
      const data = err.response?.data || { success: false, message: 'Could not fetch enquiry from Power App', error: err.message };
      logger.error?.(`Power App enquiry detail error (${status}):`, err?.message || err);
      return res.status(status).json(data);
    }
  })
);

module.exports = router;
