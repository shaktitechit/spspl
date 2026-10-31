const axios = require('axios');
const { MESSAGE_SERVICE_URL } = require('../config/env');

async function proxyToMessageService(req, res, next) {
  try {
    const targetUrl = `${MESSAGE_SERVICE_URL.replace(/\/$/, '')}${req.originalUrl}`;
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

module.exports = { proxyToMessageService };
