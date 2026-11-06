/**
 * @fileoverview Express global error handling middleware.
 * @module middlewares/error.middleware
 */
function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
  } else if (statusCode >= 400) {
    console.warn(`[WARN ${statusCode}] ${req.method} ${req.originalUrl}: ${message}`);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { errorMiddleware };
