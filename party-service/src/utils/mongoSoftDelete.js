'use strict';
const { ApiError } = require('./ApiError');

async function softDeleteActiveById(Model, id, opts = {}) {
  const notFoundMessage = opts.notFoundMessage ?? 'Not found';
  const doc = await Model.findById(id);
  if (!doc) throw new ApiError(404, notFoundMessage);
  if (doc.deletedAt != null) throw new ApiError(400, 'Already deleted');
  await doc.softDelete();
  return doc;
}

async function restoreSoftDeletedById(Model, id, opts = {}) {
  const notFoundMessage = opts.notFoundMessage ?? 'Not found';
  const doc = await Model.findOne({ _id: id }).withDeleted();
  if (!doc) throw new ApiError(404, notFoundMessage);
  if (doc.deletedAt == null) throw new ApiError(400, 'Not deleted');
  await doc.restore();
  return doc;
}

async function listDeletedLean(Model, filter = {}) {
  return Model.findDeletedOnly(filter).sort({ deletedAt: -1 }).lean();
}

module.exports = {
  softDeleteActiveById,
  restoreSoftDeletedById,
  listDeletedLean,
};
