/**
 * @fileoverview Re-exports models from mongoRegistry.
 * @module data/mongoModels
 */
const { getModels } = require('./mongoRegistry');

module.exports = getModels();
