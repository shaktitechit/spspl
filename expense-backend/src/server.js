/**
 * @fileoverview HTTP Server Bootstrap for expense-backend.
 * @module server
 */
const http = require('http');
const app = require('./app');
const { PORT } = require('./config/env');
const db = require('./config/db');
const { registerModels } = require('./data/mongoRegistry');
const { logger } = require('./utils/logger');

async function startServer() {
  try {
    await db.connect();
    registerModels();

    const serverPort = PORT || 7015;
    const httpServer = http.createServer(app);

    httpServer.listen(serverPort, () => {
      logger.info(`expense-backend listening on port ${serverPort}`);
    });
  } catch (error) {
    logger.error('Failed to start expense-backend server:', error);
    process.exit(1);
  }
}

startServer();
