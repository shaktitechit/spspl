const mongoose = require('mongoose');
const app = require('./app');
const { PORT, MONGODB_URI, MONGODB_LOOKUP_FAMILY } = require('./config/env');
const { getModels } = require('./data/mongoRegistry');

async function startServer() {
  try {
    const opts = {};
    if (MONGODB_LOOKUP_FAMILY) opts.family = MONGODB_LOOKUP_FAMILY;
    await mongoose.connect(MONGODB_URI, opts);
    getModels();
    console.log('[product-service] Connected to MongoDB');

    const { bootstrapProductUnits } = require('./modules/productUnits/productUnit.bootstrap');
    await bootstrapProductUnits();

    app.listen(PORT, () => {
      console.log(`[product-service] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[product-service] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
