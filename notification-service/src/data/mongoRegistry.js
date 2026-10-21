const mongoose = require('mongoose');

let _cached = null;

function registerModels() {
  const notificationSchema = new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      title: { type: String, required: true },
      message: { type: String, required: true },
      type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        default: 'info',
      },
      module: {
        type: String,
        enum: ['order', 'finance', 'dispatch', 'transport', 'flag', 'system', 'lead', 'work_planner'],
        default: 'system',
      },
      entity_type: String,
      entity_id: mongoose.Schema.Types.ObjectId,
      is_read: { type: Boolean, default: false },
      read_at: Date,
    },
    { timestamps: true }
  );
  if (!mongoose.models.Notification) {
    mongoose.model('Notification', notificationSchema);
  }

  const pushSubscriptionSchema = new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      endpoint: { type: String, required: true, unique: true },
      expirationTime: { type: Number, default: null },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
      userAgent: { type: String },
    },
    { timestamps: true }
  );
  if (!mongoose.models.PushSubscription) {
    mongoose.model('PushSubscription', pushSubscriptionSchema);
  }

  const devicePushTokenSchema = new mongoose.Schema(
    {
      user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
      token: { type: String, required: true, unique: true },
      platform: { type: String, default: '' },
    },
    { timestamps: true }
  );
  if (!mongoose.models.DevicePushToken) {
    mongoose.model('DevicePushToken', devicePushTokenSchema);
  }

  const models = {
    Notification: mongoose.models.Notification || mongoose.model('Notification', notificationSchema),
    PushSubscription: mongoose.models.PushSubscription || mongoose.model('PushSubscription', pushSubscriptionSchema),
    DevicePushToken: mongoose.models.DevicePushToken || mongoose.model('DevicePushToken', devicePushTokenSchema),
  };

  _cached = models;
  return models;
}

function getModels() {
  if (_cached) return _cached;
  return registerModels();
}

module.exports = { registerModels, getModels };
