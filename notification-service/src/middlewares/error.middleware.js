const { ApiError } = require('../utils/ApiError');

function errorMiddleware(err, req, res, next) {
  let statusCode = err.statusCode || (err instanceof ApiError ? err.statusCode : 500);
  let message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    errors: err.errors || [],
  });
}

module.exports = { errorMiddleware };
