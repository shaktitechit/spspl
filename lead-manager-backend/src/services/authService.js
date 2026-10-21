/**
 * @fileoverview Service for communicating with auth-service (e.g. CompanyInfo)
 * @module services/authService
 */
const axios = require('axios');
const { AUTH_SERVICE_URL } = require('../config/env');

/**
 * Fetches default CompanyInfo from auth-service.
 * Falls back to default configuration if auth-service is unavailable.
 * @returns {Promise<Record<string, any>>}
 */
async function getCompanyInfo() {
  try {
    const url = `${AUTH_SERVICE_URL.replace(/\/$/, '')}/api/company-info`;
    const resp = await axios.get(url, { timeout: 3000 });
    if (resp.data && resp.data.success && resp.data.data) {
      return resp.data.data;
    }
  } catch (err) {
    console.warn('[lead-manager-backend] Could not fetch company info from auth-service:', err.message);
  }

  return {
    company_name: process.env.COMPANY_NAME || '',
    legal_name: process.env.COMPANY_NAME || '',
    trade_name: process.env.COMPANY_NAME || '',
    quotation_terms: [

    ],
  };
}

module.exports = {
  getCompanyInfo,
};
