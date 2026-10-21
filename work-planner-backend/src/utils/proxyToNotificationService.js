const axios = require('axios');
const { NOTIFICATION_SERVICE_URL } = require('../config/env');

async function proxyToNotificationService(req, res, next) {
  try {
    const targetUrl = `${NOTIFICATION_SERVICE_URL.replace(/\/$/, '')}${req.originalUrl}`;
    const headers = { ...req.headers };
    delete headers.host;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers,
      responseType: req.headers.accept === 'text/event-stream' ? 'stream' : 'json',
      validateStatus: () => true,
    });

    if (req.headers.accept === 'text/event-stream' || response.headers['content-type']?.includes('text/event-stream')) {
      res.writeHead(response.status, response.headers);
      response.data.pipe(res);
      return;
    }

    res.status(response.status).send(response.data);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      if (req.method === 'GET') {
        return res.status(200).json({ success: true, data: [] });
      }
      return res.status(503).json({ success: false, message: 'Notification service temporarily unavailable' });
    }
    next(err);
  }
}

module.exports = { proxyToNotificationService };
