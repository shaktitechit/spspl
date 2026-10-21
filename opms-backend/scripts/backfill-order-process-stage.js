/**
 * Write Order.process_stage for existing orders using the list classifier.
 *
 * Usage:
 *   node scripts/backfill-order-process-stage.js
 *
 * Dry run (classify and print counts, do not write):
 *   DRY_RUN=1 node scripts/backfill-order-process-stage.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connect } = require('../src/config/db');
const { backfillProcessStages, indexVisibleOrders } = require('../src/modules/orders/orderListPage.service');

const dryRun = String(process.env.DRY_RUN || '') === '1';

connect()
  .then(async () => {
    if (dryRun) {
      const { tabCounts, scopeTotal } = await indexVisibleOrders({ deletedAt: null }, false);
      console.log(`Would classify ${scopeTotal} orders`);
      console.log(tabCounts);
      return;
    }
    const result = await backfillProcessStages();
    console.log(`process_stage backfill matched=${result.matched} modified=${result.modified}`);
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
