const axios = require('axios');
const { OPMS_BACKEND_URL } = require('../config/env');

const fallbackWorkflowFlags = {
  success: true,
  data: {
    performa_invoice_enabled: true,
    cost_sheet_enabled: true,
    kyc_verification_enabled: true,
    purchase_order_enabled: true,
    buy_back_enabled: false,
    buy_back_config: {
      standard_deduction_pct: 10,
      max_age_months: 36,
      requires_inspection: true,
    },
  },
};

async function proxyToOpmsBackend(req, res, next) {
  try {
    const rawBase = OPMS_BACKEND_URL || 'http://localhost:7001';
    const baseUrl = rawBase.replace(/\/$/, '');
    const targetUrl = `${baseUrl}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      timeout: 5000,
      validateStatus: () => true,
    });

    res.status(response.status).send(response.data);
  } catch (err) {
    if (req.method === 'GET' && req.originalUrl.includes('/workflow-flags')) {
      return res.status(200).json(fallbackWorkflowFlags);
    }
    next(err);
  }
}

module.exports = { proxyToOpmsBackend };

