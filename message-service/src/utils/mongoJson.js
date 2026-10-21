/**
 * @fileoverview Utilities (mongoJson).
 * @module utils/mongoJson
 */
function toPlain(doc) {
  if (doc == null) return doc;
  return JSON.parse(JSON.stringify(doc));
}

module.exports = { toPlain };
