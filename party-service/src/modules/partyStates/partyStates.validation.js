/**
 * @fileoverview PartyStates: request body guards.
 */
const { ApiError } = require('../../utils/ApiError');

function assertCreate(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  const name = body.name != null ? String(body.name).trim() : '';
  if (!name) throw new ApiError(400, 'name is required');
  const country = body.country != null ? String(body.country).trim() : '';
  if (!country) throw new ApiError(400, 'country is required');
}

function assertUpdate(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
}

module.exports = { assertCreate, assertUpdate };
