function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || '',
  PORT: num(process.env.PORT, 7005),
  JWT_SECRET: process.env.JWT_SECRET || '',
  JSON_BODY_LIMIT: process.env.JSON_BODY_LIMIT || '50mb',
  MONGODB_URI:
    process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL || '',
  MONGODB_LOOKUP_FAMILY: (() => {
    const raw = process.env.MONGODB_LOOKUP_FAMILY;
    if (raw === undefined || raw === '') return 4;
    const s = String(raw).trim().toLowerCase();
    if (s === '0' || s === 'auto' || s === 'any') return undefined;
    if (s === '4' || s === 'ipv4') return 4;
    if (s === '6' || s === 'ipv6') return 6;
    const n = Number(s);
    if (n === 4 || n === 6) return n;
    return 4;
  })(),
};
