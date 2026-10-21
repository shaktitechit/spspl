const { getModels } = require('../data/mongoRegistry');

module.exports = {
  get PushSubscription() {
    return getModels().PushSubscription;
  },
};
