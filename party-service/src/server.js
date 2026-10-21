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
    console.log('[party-service] Connected to MongoDB');

    app.listen(PORT, () => {
      console.log(`[party-service] Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('[party-service] Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
