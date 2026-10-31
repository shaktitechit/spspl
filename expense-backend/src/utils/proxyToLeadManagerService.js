const axios = require('axios');
const { LEAD_MANAGER_SERVICE_URL } = require('../config/env');

async function proxyToLeadManagerService(req, res, next) {
  try {
    const targetUrl = `${LEAD_MANAGER_SERVICE_URL.replace(/\/$/, '')}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      validateStatus: () => true,
    });

    res.status(response.status).send(response.data);
  } catch (err) {
    next(err);
  }
}

module.exports = { proxyToLeadManagerService };
