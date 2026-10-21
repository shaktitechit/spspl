const { ApiError } = require('../../utils/ApiError');

function assertCreateDepartment(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  if (!body.name || !body.code) {
    throw new ApiError(400, 'name and code are required for department');
  }
}

function assertUpdateDepartment(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
}

module.exports = {
  assertCreateDepartment,
  assertUpdateDepartment,
};
