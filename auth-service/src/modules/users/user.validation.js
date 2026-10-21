const { ApiError } = require('../../utils/ApiError');
const { assertPasswordStrength } = require('../../utils/passwordPolicy');

const PATCH_KEYS = ['name', 'email', 'phone', 'password', 'department', 'roles', 'portals', 'is_active'];

function assertCreate(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  if (!body.name || !body.email || !body.password || !body.department) {
    throw new ApiError(400, 'name, email, password, and department are required');
  }
  assertPasswordStrength(body.password);
  if (typeof body.department !== 'string' || !body.department.trim()) {
    throw new ApiError(400, 'department must be a non-empty string code');
  }
  if (body.roles !== undefined && !Array.isArray(body.roles)) {
    throw new ApiError(400, 'roles must be an array');
  }
  if (body.portals !== undefined && !Array.isArray(body.portals)) {
    throw new ApiError(400, 'portals must be an array');
  }
}

function assertPatch(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  const touched = PATCH_KEYS.filter((k) => Object.prototype.hasOwnProperty.call(body, k));
  if (touched.length === 0) {
    throw new ApiError(
      400,
      `Provide at least one of: ${PATCH_KEYS.join(', ')}`
    );
  }
  if (body.password !== undefined) {
    assertPasswordStrength(body.password);
  }
  if (body.department !== undefined && (typeof body.department !== 'string' || !body.department.trim())) {
    throw new ApiError(400, 'department must be a non-empty string code');
  }
  if (body.roles !== undefined && !Array.isArray(body.roles)) {
    throw new ApiError(400, 'roles must be an array');
  }
  if (body.portals !== undefined && !Array.isArray(body.portals)) {
    throw new ApiError(400, 'portals must be an array');
  }
}

module.exports = { assertCreate, assertPatch };
