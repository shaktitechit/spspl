/**
 * @fileoverview Utilities (generateDueSheetNo).
 * @module utils/generateDueSheetNo
 */
const { getModels } = require('../data/mongoRegistry');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a due sheet number in the format: ODS-PartyInitials-YYYYMMDD-Serial
 * Serial is max existing for that prefix + 1 (includes soft-deleted) so unique index collisions are avoided.
 * @param {string} partyId - Mongoose ID of the Party
 * @param {Date|string} [sheetDate] - Date of the due sheet
 * @returns {Promise<string>} The generated due sheet number
 */
async function generateDueSheetNo(partyId, sheetDate) {
  if (!partyId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `ODS-TEMP-${ts}-${rand}`;
  }

  const { Party, OrderDueSheet } = getModels();

  const partyDoc = await Party.findById(partyId).lean();
  const partyName = partyDoc ? partyDoc.party_name : 'UNKNOWN';

  const cleanName = partyName.replace(/[^a-zA-Z0-9\s]/g, ' ');
  const words = cleanName.trim().split(/\s+/).filter(Boolean);
  const initials = words
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();
  const partyInitials = initials || 'XX';

  const dateObj = sheetDate ? new Date(sheetDate) : new Date();
  
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const prefix = `ODS-${partyInitials}-${dateStr}-`;

  // Query all existing due sheets with this prefix (including soft-deleted to avoid unique index violation)
  const existing = await OrderDueSheet.find({
    due_sheet_no: new RegExp(`^${escapeRegex(prefix)}\\d+$`),
  })
    .select('due_sheet_no')
    .lean();

  let maxSerial = 0;
  for (const row of existing) {
    const match = String(row.due_sheet_no || '').match(/-(\d+)$/);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (Number.isFinite(n) && n > maxSerial) maxSerial = n;
  }

  let nextSerial = maxSerial + 1;
  let candidate = `${prefix}${String(nextSerial).padStart(3, '0')}`;

  // Double-check collection directly to avoid soft-delete/concurrency collisions
  try {
    const coll = OrderDueSheet.collection;
    while (await coll.findOne({ due_sheet_no: candidate })) {
      nextSerial++;
      candidate = `${prefix}${String(nextSerial).padStart(3, '0')}`;
    }
  } catch (_err) {
    // Proceed with computed candidate if direct collection check is unavailable
  }

  return candidate;
}

module.exports = { generateDueSheetNo };

