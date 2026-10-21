/**
 * @fileoverview HTTP Server Bootstrap for work-planner-backend.
 * @module server
 */
const http = require('http');
const app = require('./app');
const { PORT } = require('./config/env');
const db = require('./config/db');
const { registerModels, fixWorkPlanIndexes } = require('./data/mongoRegistry');
const { logger } = require('./utils/logger');
const { initProjectSocket } = require('./socket/projectSocket');
const corsOptions = require('./config/cors');

async function startServer() {
  try {
    await db.connect();
    await fixWorkPlanIndexes();
    registerModels();

    const { startSchedulers } = require('./jobs/workPlannerScheduler');
    startSchedulers();

    const { startNoteReminderScheduler } = require('./jobs/noteReminderScheduler');
    startNoteReminderScheduler();

    const serverPort = PORT || 7007;
    const httpServer = http.createServer(app);

    // Initialize real-time Project Chat & Collaboration sockets
    initProjectSocket(httpServer, corsOptions);

    httpServer.listen(serverPort, () => {
      logger.info(`work-planner-backend listening on port ${serverPort} (with Socket.IO enabled)`);
    });
  } catch (error) {
    logger.error('Failed to start work-planner-backend server:', error);
    process.exit(1);
  }
}

startServer();
