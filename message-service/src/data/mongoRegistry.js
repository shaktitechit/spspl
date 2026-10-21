/**
 * @fileoverview Mongo Registry for message-service.
 * @module data/mongoRegistry
 */
const mongoose = require('mongoose');
const Message = require('../models/Message');
const EmailAccount = require('../models/EmailAccount');

const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({}, { strict: false }));

function getModels() {
  return {
    Message,
    EmailAccount,
    Order,
  };
}

module.exports = {
  getModels,
};
