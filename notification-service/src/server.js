/**
 * @fileoverview Server bootstrap for notification-service.
 * @module server
 */
const mongoose = require('mongoose');
const app = require('./app');
const { PORT, MONGODB_URI, MONGODB_LOOKUP_FAMILY } = require('./config/env');
const { getModels } = require('./data/mongoRegistry');
const workers = require('./workers');
const { logger } = require('./config/logger');

async function startServer() {
  try {
    const opts = {};
    if (MONGODB_LOOKUP_FAMILY) opts.family = MONGODB_LOOKUP_FAMILY;
    await mongoose.connect(MONGODB_URI, opts);
    getModels();
    logger.info('Connected to MongoDB');

    // Start background workers for queues
    try {
      workers.startAll();
    } catch (workerErr) {
      logger.warn(`Could not start workers immediately: ${workerErr.message}`);
    }

    const serverPort = PORT || 7012;
    const server = app.listen(serverPort, () => {
      logger.info(`notification-service running on port ${serverPort}`);
    });

    const gracefulShutdown = (signal) => {
      logger.info(`Received ${signal}, shutting down notification-service gracefully...`);
      workers.stopAll();
      server.close(() => {
        mongoose.connection.close(false).then(() => {
          logger.info('MongoDB connection closed. Exiting process.');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start notification-service server:', err);
    process.exit(1);
  }
}

startServer();
