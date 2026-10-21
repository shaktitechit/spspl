/**
 * @fileoverview HTTP Server Bootstrap for lead-manager-backend.
 * @module server
 */
const app = require('./app');
const { PORT } = require('./config/env');
const db = require('./config/db');
const { registerModels } = require('./data/mongoRegistry');
const { startSchedulers } = require('./jobs/scheduler');
const { logger } = require('./utils/logger');

async function startServer() {
  try {
    await db.connect();
    registerModels();
    startSchedulers();

    const serverPort = PORT || 7009;
    app.listen(serverPort, () => {
      logger.info(`lead-manager-backend listening on port ${serverPort}`);
    });
  } catch (error) {
    logger.error('Failed to start lead-manager-backend server:', error);
    process.exit(1);
  }
}

startServer();
