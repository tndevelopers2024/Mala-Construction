/**
 * One-time migration: backfills the `sites` array for existing Worker
 * documents that only have the legacy single `site` field.
 *
 * Run with:  node utils/migrateWorkerSites.js
 *
 * Safe to re-run — only touches documents where `sites` is empty/missing.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const env = require('../config/env');
const Worker = require('../models/Worker');
const logger = require('./logger');

async function migrate() {
  await mongoose.connect(env.mongoUri);

  const result = await Worker.updateMany(
    {
      site: { $exists: true, $ne: null },
      $or: [{ sites: { $exists: false } }, { sites: { $size: 0 } }],
    },
    [{ $set: { sites: ['$site'] } }]
  );

  logger.info(`Migration complete: ${result.modifiedCount} worker(s) updated with sites array.`);
  await mongoose.disconnect();
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  });
