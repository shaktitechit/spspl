/**
 * Shared Mongo bootstrap for party-service CLI scripts.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function loadEnv() {
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

function isRunningInDocker() {
  if (String(process.env.RUNNING_IN_DOCKER || '') === '1') return true;
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * `.env.docker` often uses host.docker.internal (for containers → host Mongo).
 * On the host machine, use 127.0.0.1 instead.
 */
function resolveMongoUriForHost(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  const overrideHost = process.env.LOCAL_MONGO_HOST;
  if (overrideHost) {
    return uri.replace(/host\.docker\.internal/g, overrideHost);
  }
  if (!isRunningInDocker() && uri.includes('host.docker.internal')) {
    return uri.replace(/host\.docker\.internal/g, '127.0.0.1');
  }
  return uri;
}

async function connectMongo() {
  loadEnv();
  const { MONGODB_URI, MONGODB_LOOKUP_FAMILY } = require('../../src/config/env');
  const mongoUri = resolveMongoUriForHost(MONGODB_URI);
  if (!mongoUri) {
    throw new Error('MONGODB_URI (or MONGO_URI / DATABASE_URL) is not set');
  }
  if (mongoUri !== MONGODB_URI) {
    console.log('[connectMongo] Using 127.0.0.1 instead of host.docker.internal (host CLI)');
  }
  const opts = {};
  if (MONGODB_LOOKUP_FAMILY) opts.family = MONGODB_LOOKUP_FAMILY;
  await mongoose.connect(mongoUri, opts);
  const { getModels } = require('../../src/data/mongoRegistry');
  getModels();
  return mongoose;
}

module.exports = { loadEnv, connectMongo };
