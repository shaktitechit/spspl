const http = require('http');
const https = require('https');
const { NOTIFICATION_SERVICE_URL } = require('../config/env');

/**
 * Proxy all /api/notifications/* requests to the notification-service.
 * Uses only built-in Node.js http/https modules — no extra dependencies.
 */
async function proxyToNotificationService(req, res, next) {
  try {
    const base = (NOTIFICATION_SERVICE_URL || 'http://notification-service:7012').replace(/\/$/, '');
    const targetUrl = new URL(`${base}${req.originalUrl}`);
    const isSSE = req.headers.accept === 'text/event-stream';

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    };

    const transport = targetUrl.protocol === 'https:' ? https : http;

    const proxy = transport.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: !isSSE });

      if (isSSE) {
        req.on('close', () => proxyRes.destroy());
      }
    });

    proxy.on('error', (err) => next(err));

    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      const body = JSON.stringify(req.body);
      proxy.setHeader('Content-Length', Buffer.byteLength(body));
      proxy.write(body);
    }

    proxy.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { proxyToNotificationService };
