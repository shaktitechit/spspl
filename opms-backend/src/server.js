/**
 * @fileoverview Process entry: env, MongoDB connect, queue registration, HTTP listen.
 * @module server
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('./config/db');
const { PORT } = require('./config/env');
const { logger } = require('./config/logger');
const queues = require('./queues');
const workers = require('./workers');

db.connect()
  .then(async () => {
    await queues.registerQueues(logger);
    workers.startAll(logger);
    const app = require('./app');
    app.listen(PORT, () => {
      logger.info(`Server listening on port ${PORT}`);
    });
    const { backfillProcessStages } = require('./modules/orders/orderListPage.service');
    backfillProcessStages()
      .then((res) => logger.info(`[startup] Order process stage backfill completed (matched: ${res.matched}, modified: ${res.modified})`))
      .catch((err) => logger.warn(`[startup] Order process stage backfill warning: ${err.message}`));
  })
  .catch((err) => {
    logger.error(err);
    process.exit(1);
  });
