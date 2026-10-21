/**
 * @fileoverview Work Planner request body validation guards.
 * @module modules/workPlanner/workPlanner.validation
 */
const mongoose = require('mongoose');
const { ApiError } = require('../../utils/ApiError');
const {
  PLAN_STATUSES,
  VISIT_STATUSES,
  WORK_STATUSES,
  VISIT_PARTY_TYPES,
  EXPENSE_CATEGORIES,
  TRAVEL_SUB_CATEGORIES,
  EXPENSE_PAYMENT_MODES,
} = require('./workPlanner.constants');

function assertObjectId(value, field) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${field} ID format`);
  }
}

function assertEmail(value, field = 'contact_email') {
  const email = typeof value === 'string' ? value.trim() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, `${field} must be a valid email`);
  }
}

function assertRequiredContactFields(body) {
  if (!body.party_name || !String(body.party_name).trim()) {
    throw new ApiError(400, 'party_name is required');
  }
  if (!body.contact_person || !String(body.contact_person).trim()) {
    throw new ApiError(400, 'contact_person is required');
  }
  if (!body.contact_number || !String(body.contact_number).trim()) {
    throw new ApiError(400, 'contact_number is required');
  }
  assertEmail(body.contact_email);
}

function normalizePartyType(body) {
  const raw = body?.party_type ? String(body.party_type).trim() : '';
  if (raw && VISIT_PARTY_TYPES.includes(raw)) return raw;
  if (body?.party) return 'existing';
  return '';
}

function assertCreate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (!body.plan_date) {
    throw new ApiError(400, 'plan_date is required');
  }
  if (isNaN(Date.parse(body.plan_date))) {
    throw new ApiError(400, 'Invalid plan_date format');
  }
  if (body.sales_user) {
    assertObjectId(body.sales_user, 'sales_user');
  }
  if (body.status && !PLAN_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${PLAN_STATUSES.join(', ')}`);
  }
  if (body.plan_type && !['Visits', 'Tasks & Visits', 'Leave', 'Work From Home', 'Work From Office'].includes(body.plan_type)) {
    throw new ApiError(400, 'plan_type must be one of: Visits, Tasks & Visits, Leave, Work From Home, Work From Office');
  }
}

function assertUpdate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (body.plan_date !== undefined && isNaN(Date.parse(body.plan_date))) {
    throw new ApiError(400, 'Invalid plan_date format');
  }
  if (body.status !== undefined && !PLAN_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${PLAN_STATUSES.join(', ')}`);
  }
  if (body.plan_type !== undefined && !['Visits', 'Tasks & Visits', 'Leave', 'Work From Home', 'Work From Office'].includes(body.plan_type)) {
    throw new ApiError(400, 'plan_type must be one of: Visits, Tasks & Visits, Leave, Work From Home, Work From Office');
  }
}

function isValidDateOrTimeString(val) {
  if (val == null || val === '') return true;
  if (val instanceof Date && !isNaN(val.getTime())) return true;
  if (!isNaN(Date.parse(val))) return true;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?(\s*[AP]M)?$/i.test(trimmed)) return true;
    if (/^\d{4}-\d{2}-\d{2}/i.test(trimmed)) return true;
  }
  return false;
}

function assertVisitCreate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  const partyType = normalizePartyType(body);
  if (!VISIT_PARTY_TYPES.includes(partyType)) {
    throw new ApiError(400, `party_type must be one of: ${VISIT_PARTY_TYPES.join(', ')}`);
  }
  if (partyType === 'existing') {
    assertObjectId(body.party, 'party');
  }
  assertRequiredContactFields(body);
  if (body.sequence !== undefined) {
    const seq = Number(body.sequence);
    if (!Number.isInteger(seq) || seq < 1) {
      throw new ApiError(400, 'sequence must be a positive integer');
    }
  }
  if (!isValidDateOrTimeString(body.planned_start_time)) {
    throw new ApiError(400, 'Invalid planned_start_time format');
  }
  if (!isValidDateOrTimeString(body.planned_end_time)) {
    throw new ApiError(400, 'Invalid planned_end_time format');
  }
  if (body.status && !VISIT_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${VISIT_STATUSES.join(', ')}`);
  }
}

function assertVisitUpdate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (body.party_type !== undefined) {
    if (!VISIT_PARTY_TYPES.includes(String(body.party_type))) {
      throw new ApiError(400, `party_type must be one of: ${VISIT_PARTY_TYPES.join(', ')}`);
    }
  }
  const partyType = normalizePartyType(body);
  if (partyType === 'existing' || body.party !== undefined) {
    if (body.party !== undefined && body.party !== null && body.party !== '') {
      assertObjectId(body.party, 'party');
    }
  }
  if (body.party_name !== undefined && !String(body.party_name || '').trim()) {
    throw new ApiError(400, 'party_name is required');
  }
  if (body.contact_person !== undefined && !String(body.contact_person || '').trim()) {
    throw new ApiError(400, 'contact_person is required');
  }
  if (body.contact_number !== undefined && !String(body.contact_number || '').trim()) {
    throw new ApiError(400, 'contact_number is required');
  }
  if (body.contact_email !== undefined) {
    assertEmail(body.contact_email);
  }
  if (body.sequence !== undefined) {
    const seq = Number(body.sequence);
    if (!Number.isInteger(seq) || seq < 1) {
      throw new ApiError(400, 'sequence must be a positive integer');
    }
  }
  if (body.planned_start_time !== undefined && !isValidDateOrTimeString(body.planned_start_time)) {
    throw new ApiError(400, 'Invalid planned_start_time format');
  }
  if (body.planned_end_time !== undefined && !isValidDateOrTimeString(body.planned_end_time)) {
    throw new ApiError(400, 'Invalid planned_end_time format');
  }
  if (body.status !== undefined && !VISIT_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${VISIT_STATUSES.join(', ')}`);
  }
}

function assertReject(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (!body.rejection_reason || typeof body.rejection_reason !== 'string' || !body.rejection_reason.trim()) {
    throw new ApiError(400, 'rejection_reason is required');
  }
}

const COMPLETE_VISIT_YES_NO_FIELDS = [
  'meeting_with_doctor',
  'meeting_with_purchase',
  'meeting_with_finance',
  'meeting_with_engineer',
  'new_product_introduced',
  'order_received',
];

function assertCompleteVisit(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : '';
  if (!outcome) {
    throw new ApiError(400, 'outcome is required');
  }
  for (const key of COMPLETE_VISIT_YES_NO_FIELDS) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') {
      throw new ApiError(400, `${key} must be true or false`);
    }
  }
}

function assertScheduleNextVisit(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (!body.plan_date) {
    throw new ApiError(400, 'plan_date is required');
  }
  if (isNaN(Date.parse(body.plan_date))) {
    throw new ApiError(400, 'Invalid plan_date format');
  }
}

function assertExpenseCreate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (!body.expense_date) {
    throw new ApiError(400, 'expense_date is required');
  }
  if (isNaN(Date.parse(body.expense_date))) {
    throw new ApiError(400, 'Invalid expense_date format');
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, 'amount must be a non-negative number');
  }
  const category = String(body.category || '').trim();
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
  }
  if (category === 'Travel') {
    const sub = String(body.sub_category || '').trim();
    if (!TRAVEL_SUB_CATEGORIES.includes(sub)) {
      throw new ApiError(
        400,
        `sub_category must be one of: ${TRAVEL_SUB_CATEGORIES.join(', ')} when category is Travel`,
      );
    }
  }
  const mode = String(body.payment_mode || '').trim();
  if (!EXPENSE_PAYMENT_MODES.includes(mode)) {
    throw new ApiError(400, `payment_mode must be one of: ${EXPENSE_PAYMENT_MODES.join(', ')}`);
  }
  if (body.work_plan_visit) {
    assertObjectId(body.work_plan_visit, 'work_plan_visit');
  }
  if (body.bill_date !== undefined && body.bill_date !== null && body.bill_date !== '') {
    if (isNaN(Date.parse(body.bill_date))) {
      throw new ApiError(400, 'Invalid bill_date format');
    }
  }
  const hasAttachments =
    Boolean(body.receipt_attachment) ||
    (Array.isArray(body.attachments) && body.attachments.length > 0);
  if (amount > 200 && !hasAttachments) {
    throw new ApiError(400, 'Document upload is required for expenses greater than ₹200');
  }
  if (body.receipt_attachment) {
    assertObjectId(body.receipt_attachment, 'receipt_attachment');
  }
  if (Array.isArray(body.attachments)) {
    for (const attId of body.attachments) {
      if (attId) assertObjectId(attId, 'attachments');
    }
  }
  if (body.start_reading_image) {
    assertObjectId(body.start_reading_image, 'start_reading_image');
  }
  if (body.end_reading_image) {
    assertObjectId(body.end_reading_image, 'end_reading_image');
  }
  if (category === 'Travel' && String(body.sub_category || '').trim() === 'Private Bike') {
    const start = Number(body.start_reading);
    const closing = Number(body.closing_reading);
    if (!Number.isFinite(start) || start < 0) {
      throw new ApiError(400, 'start_reading is required for Private Bike expenses');
    }
    if (!Number.isFinite(closing) || closing < 0) {
      throw new ApiError(400, 'closing_reading is required for Private Bike expenses');
    }
    if (closing < start) {
      throw new ApiError(400, 'closing_reading must be greater than or equal to start_reading');
    }
  }
}

function assertExpenseUpdate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (body.expense_date !== undefined && isNaN(Date.parse(body.expense_date))) {
    throw new ApiError(400, 'Invalid expense_date format');
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ApiError(400, 'amount must be a non-negative number');
    }
  }
  if (body.category !== undefined) {
    const category = String(body.category || '').trim();
    if (!EXPENSE_CATEGORIES.includes(category)) {
      throw new ApiError(400, `category must be one of: ${EXPENSE_CATEGORIES.join(', ')}`);
    }
    if (category === 'Travel') {
      const sub = String(body.sub_category || '').trim();
      if (!TRAVEL_SUB_CATEGORIES.includes(sub)) {
        throw new ApiError(
          400,
          `sub_category must be one of: ${TRAVEL_SUB_CATEGORIES.join(', ')} when category is Travel`,
        );
      }
    }
  }
  if (body.sub_category !== undefined && body.sub_category !== null && body.sub_category !== '') {
    const sub = String(body.sub_category).trim();
    if (!TRAVEL_SUB_CATEGORIES.includes(sub)) {
      throw new ApiError(
        400,
        `sub_category must be one of: ${TRAVEL_SUB_CATEGORIES.join(', ')}`,
      );
    }
  }
  if (body.payment_mode !== undefined) {
    const mode = String(body.payment_mode).trim();
    if (!EXPENSE_PAYMENT_MODES.includes(mode)) {
      throw new ApiError(400, `payment_mode must be one of: ${EXPENSE_PAYMENT_MODES.join(', ')}`);
    }
  }
  if (body.work_plan_visit !== undefined && body.work_plan_visit !== null && body.work_plan_visit !== '') {
    assertObjectId(body.work_plan_visit, 'work_plan_visit');
  }
  if (body.bill_date !== undefined && body.bill_date !== null && body.bill_date !== '') {
    if (isNaN(Date.parse(body.bill_date))) {
      throw new ApiError(400, 'Invalid bill_date format');
    }
  }
  if (
    body.receipt_attachment !== undefined &&
    body.receipt_attachment !== null &&
    body.receipt_attachment !== ''
  ) {
    assertObjectId(body.receipt_attachment, 'receipt_attachment');
  }
  if (Array.isArray(body.attachments)) {
    for (const attId of body.attachments) {
      if (attId) assertObjectId(attId, 'attachments');
    }
  }
  if (
    body.start_reading_image !== undefined &&
    body.start_reading_image !== null &&
    body.start_reading_image !== ''
  ) {
    assertObjectId(body.start_reading_image, 'start_reading_image');
  }
  if (
    body.end_reading_image !== undefined &&
    body.end_reading_image !== null &&
    body.end_reading_image !== ''
  ) {
    assertObjectId(body.end_reading_image, 'end_reading_image');
  }
  if (body.start_reading !== undefined && body.start_reading !== null && body.start_reading !== '') {
    const start = Number(body.start_reading);
    if (!Number.isFinite(start) || start < 0) {
      throw new ApiError(400, 'start_reading must be a non-negative number');
    }
  }
  if (body.closing_reading !== undefined && body.closing_reading !== null && body.closing_reading !== '') {
    const closing = Number(body.closing_reading);
    if (!Number.isFinite(closing) || closing < 0) {
      throw new ApiError(400, 'closing_reading must be a non-negative number');
    }
  }
}

function assertWorkCreate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (!body.title || !body.title.trim()) {
    throw new ApiError(400, 'title is required');
  }
  if (body.sequence !== undefined) {
    const seq = Number(body.sequence);
    if (!Number.isInteger(seq) || seq < 1) {
      throw new ApiError(400, 'sequence must be a positive integer');
    }
  }
  if (!isValidDateOrTimeString(body.planned_start_time)) {
    throw new ApiError(400, 'Invalid planned_start_time format');
  }
  if (!isValidDateOrTimeString(body.planned_end_time)) {
    throw new ApiError(400, 'Invalid planned_end_time format');
  }
  if (body.status && !WORK_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${WORK_STATUSES.join(', ')}`);
  }
}

function assertWorkUpdate(body) {
  if (!body || typeof body !== 'object') {
    throw new ApiError(400, 'JSON body required');
  }
  if (body.title !== undefined && !body.title.trim()) {
    throw new ApiError(400, 'title cannot be empty');
  }
  if (body.sequence !== undefined) {
    const seq = Number(body.sequence);
    if (!Number.isInteger(seq) || seq < 1) {
      throw new ApiError(400, 'sequence must be a positive integer');
    }
  }
  if (body.planned_start_time !== undefined && !isValidDateOrTimeString(body.planned_start_time)) {
    throw new ApiError(400, 'Invalid planned_start_time format');
  }
  if (body.planned_end_time !== undefined && !isValidDateOrTimeString(body.planned_end_time)) {
    throw new ApiError(400, 'Invalid planned_end_time format');
  }
  if (body.status !== undefined && !WORK_STATUSES.includes(body.status)) {
    throw new ApiError(400, `status must be one of: ${WORK_STATUSES.join(', ')}`);
  }
  if (body.completion_remarks !== undefined && body.completion_remarks !== null) {
    if (typeof body.completion_remarks !== 'string') {
      throw new ApiError(400, 'completion_remarks must be a string');
    }
  }
  if (body.status === 'completed') {
    const remarks =
      (typeof body.completion_remarks === 'string' && body.completion_remarks.trim()) ||
      (typeof body.outcome === 'string' && body.outcome.trim()) ||
      (typeof body.manager_remarks === 'string' && body.manager_remarks.trim()) ||
      '';
    if (!remarks) {
      throw new ApiError(400, 'completion remarks are required to complete a work task');
    }
  }
}

module.exports = {
  assertCreate,
  assertUpdate,
  assertVisitCreate,
  assertVisitUpdate,
  assertReject,
  assertCompleteVisit,
  assertScheduleNextVisit,
  assertExpenseCreate,
  assertExpenseUpdate,
  assertWorkCreate,
  assertWorkUpdate,
};
