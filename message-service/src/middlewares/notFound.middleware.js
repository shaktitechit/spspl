/**
 * @fileoverview 404 Not Found middleware for message-service.
 * @module middlewares/notFound.middleware
 */
const { ApiError } = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

module.exports = { notFound };
