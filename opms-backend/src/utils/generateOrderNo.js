/**
 * @fileoverview Utilities (generateOrderNo).
 * @module utils/generateOrderNo
 */
const { getModels } = require('../data/mongoRegistry');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates an order number in the format: ORD-PartyInitials-YYYYMMDD-Serial
 * Serial is max existing for that prefix + 1 (includes soft-deleted) so unique index collisions are avoided.
 * @param {string} partyId - Mongoose ID of the Party
 * @param {Date|string} [orderDate] - Date of the order
 * @returns {Promise<string>} The generated order number
 */
async function generateOrderNo(partyId, orderDate) {
  if (!partyId) {
    // Fallback if partyId is missing
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ORD-TEMP-${ts}-${rand}`;
  }

  const { Party, Order } = getModels();

  // 1. Get Party Name and extract initials
  const partyDoc = await Party.findById(partyId).lean();
  const partyName = partyDoc ? partyDoc.party_name : 'UNKNOWN';

  // Replace punctuation/special chars with space to treat dotted words separately
  const cleanName = partyName.replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = cleanName.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();
  const partyInitials = initials || 'XX';

  // 2. Format date as YYYYMMDD
  const dateObj = orderDate ? new Date(orderDate) : new Date();
  
  // Use UTC values to ensure consistency across servers/containers
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const prefix = `ORD-${partyInitials}-${dateStr}-`;

  const existing = await Order.find({
    order_no: new RegExp(`^${escapeRegex(prefix)}\\d+$`),
  })
    .select('order_no')
    .lean();

  let maxSerial = 0;
  for (const row of existing) {
    const match = String(row.order_no || '').match(/-(\d+)$/);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > maxSerial) maxSerial = n;
  }

  let nextSerial = maxSerial + 1;
  let candidate = `${prefix}${String(nextSerial).padStart(3, '0')}`;

  try {
    const coll = Order.collection;
    while (await coll.findOne({ order_no: candidate })) {
      nextSerial++;
      candidate = `${prefix}${String(nextSerial).padStart(3, '0')}`;
    }
  } catch (_err) {
    // Proceed with computed candidate if direct collection check is unavailable
  }

  return candidate;
}

module.exports = { generateOrderNo };

