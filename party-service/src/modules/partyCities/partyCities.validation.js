/**
 * @fileoverview PartyCities: request body guards.
 */
const { ApiError } = require('../../utils/ApiError');

function assertCreate(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
  const name = body.name != null ? String(body.name).trim() : '';
  if (!name) throw new ApiError(400, 'name is required');
  const state = body.state != null ? String(body.state).trim() : '';
  if (!state) throw new ApiError(400, 'state is required');
}

function assertUpdate(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400, 'JSON body required');
}

module.exports = { assertCreate, assertUpdate };
