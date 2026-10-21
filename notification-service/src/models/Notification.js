const { getModels } = require('../data/mongoRegistry');

module.exports = {
  get Notification() {
    return getModels().Notification;
  },
};
