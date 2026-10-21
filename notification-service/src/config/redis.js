const Redis = require('ioredis');
const { REDIS_URL } = require('./env');

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});

module.exports = connection;
