const { ApiError } = require('../../utils/ApiError');

function validateLoginBody(body) {
  const { email, password } = body || {};
  if (!email || !String(email).trim()) {
    throw new ApiError(400, 'Email is required');
  }
  if (!password || !String(password).trim()) {
    throw new ApiError(400, 'Password is required');
  }
  return {
    email: String(email).trim().toLowerCase(),
    password: String(password),
  };
}

module.exports = { validateLoginBody };
