/**
 * @fileoverview Expense domain constants, status enums, categories, and date helpers.
 * @module modules/expense/expense.constants
 */

const EXPENSE_STATUSES = Object.freeze(['draft', 'submitted', 'approved', 'rejected']);

const EXPENSE_CATEGORIES = Object.freeze([
  'Travel',
  'Accommodation',
  'Food',
  'Communication',
  'Client Entertainment',
  'Marketing',
  'Office',
  'Miscellaneous',
]);

const TRAVEL_SUB_CATEGORIES = Object.freeze([
  'Cab',
  'Auto',
  'Bus',
  'Bike Ride',
  'Private Bike',
  'Train',
  'Flight',
  'Parking',
  'Toll',
]);

const EXPENSE_PAYMENT_MODES = Object.freeze([
  'Cash',
  'UPI',
  'Card',
  'Bank Transfer',
  'Company Card',
]);

const TOUR_ADVANCE_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'disbursed',
  'settled',
  'recovered',
  'refunded',
]);

const SETTLEMENT_MODES = Object.freeze(['advance_deduction', 'direct_payment', 'split']);

function startOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateInput) {
  const d = new Date(dateInput);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function userId(actor) {
  if (!actor) return null;
  return actor._id || actor.id || actor.sub || null;
}

module.exports = {
  EXPENSE_STATUSES,
  EXPENSE_CATEGORIES,
  TRAVEL_SUB_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
  TOUR_ADVANCE_STATUSES,
  SETTLEMENT_MODES,
  startOfDay,
  endOfDay,
  userId,
};

