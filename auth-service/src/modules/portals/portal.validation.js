const { ApiError } = require('../../utils/ApiError');

function assertCreatePortal(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  if (!body.name || !body.code) {
    throw new ApiError(400, 'name and code are required for portal');
  }
  if (body.access_roles !== undefined && !Array.isArray(body.access_roles)) {
    throw new ApiError(400, 'access_roles must be an array of strings');
  }
}

function assertUpdatePortal(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  if (body.access_roles !== undefined && !Array.isArray(body.access_roles)) {
    throw new ApiError(400, 'access_roles must be an array of strings');
  }
}

module.exports = {
  assertCreatePortal,
  assertUpdatePortal,
};
