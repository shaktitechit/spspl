const axios = require('axios');
const { AUTH_SERVICE_URL } = require('../config/env');

async function proxyToAuthService(req, res, next) {
  try {
    const targetUrl = `${AUTH_SERVICE_URL.replace(/\/$/, '')}${req.originalUrl}`;
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

module.exports = { proxyToAuthService };
