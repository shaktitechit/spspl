/**
 * @fileoverview Async handler wrapper for Express routes.
 * @module utils/asyncHandler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
