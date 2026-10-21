function toPlain(obj) {
  if (!obj) return obj;
  const doc = typeof obj.toObject === 'function' ? obj.toObject() : { ...obj };
  if (doc._id) doc._id = String(doc._id);
  if (doc.user) doc.user = String(doc.user);
  if (doc.entity_id) doc.entity_id = String(doc.entity_id);
  return doc;
}

module.exports = { toPlain };
