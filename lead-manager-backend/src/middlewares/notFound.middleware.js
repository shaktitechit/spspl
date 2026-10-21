/**
 * @fileoverview Express 404 handler middleware.
 * @module middlewares/notFound.middleware
 */
const { ApiError } = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
}

module.exports = { notFound };
