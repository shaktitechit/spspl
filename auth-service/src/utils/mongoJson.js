function toPlain(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) return doc.map(toPlain);
  if (typeof doc.toObject === 'function') {
    const obj = doc.toObject({ getters: true, virtuals: true });
    if (obj._id) obj._id = String(obj._id);
    delete obj.__v;
    return obj;
  }
  if (typeof doc === 'object') {
    const copy = { ...doc };
    if (copy._id) copy._id = String(copy._id);
    delete copy.__v;
    return copy;
  }
  return doc;
}

module.exports = { toPlain };
