/**
 * @fileoverview Normalizes and maps IndiaMART Push API payloads into canonical Lead documents.
 * @module modules/webhooks/indiamart/indiamart.mapper
 */
const { QUERY_TYPES, DEFAULT_SOURCE_NAME, PRIORITY_MAP } = require('./indiamart.constants');

/**
 * Extracts the inner RESPONSE object regardless of outer webhook wrapper formatting.
 * Handles:
 *   1. req.body.RESPONSE
 *   2. req.body.body.RESPONSE
 *   3. req.body.body (if flat)
 *   4. req.body (if flat)
 */
function extractIndiaMartData(rawBody) {
  if (!rawBody || typeof rawBody !== 'object') return null;

  if (rawBody.RESPONSE && typeof rawBody.RESPONSE === 'object') {
    return rawBody.RESPONSE;
  }

  if (rawBody.body && typeof rawBody.body === 'object') {
    if (rawBody.body.RESPONSE && typeof rawBody.body.RESPONSE === 'object') {
      return rawBody.body.RESPONSE;
    }
    if (rawBody.body.UNIQUE_QUERY_ID) {
      return rawBody.body;
    }
  }

  if (rawBody.UNIQUE_QUERY_ID) {
    return rawBody;
  }

  return null;
}

/**
 * Parses IndiaMART query date string safely into a JS Date object.
 * Format is typically "YYYY-MM-DD HH:mm:ss" or "YYYYMMDDHHmmss" or ISO string.
 */
function parseQueryTime(queryTimeStr) {
  if (!queryTimeStr) return new Date();
  if (queryTimeStr instanceof Date && !isNaN(queryTimeStr)) return queryTimeStr;

  const str = String(queryTimeStr).trim();

  // Try standard Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try compact YYYYMMDDHHmmss
  const compactMatch = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, yr, mo, da, hr, mi, se] = compactMatch;
    return new Date(Date.UTC(+yr, +mo - 1, +da, +hr - 5, +mi - 30, +se)); // adjust IST to UTC
  }

  return new Date();
}

/**
 * Extracts approximate quantity and unit from inquiry message string if present.
 * Example: "Quantity: 100000 Piece"
 */
function extractQuantityAndUnit(message = '') {
  const match = message.match(/Quantity:\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?/i);
  if (match) {
    const qty = parseFloat(match[1]);
    const unit = match[2] ? match[2].trim().toLowerCase() : 'pcs';
    return { quantity: isNaN(qty) ? 1 : qty, unit };
  }
  return { quantity: 1, unit: 'pcs' };
}

/**
 * Maps raw IndiaMART data fields to OPMS Lead Manager fields.
 */
function mapIndiaMartToLead({ rawData, defaultDepartment = 'UPS/Batteries', sourceDoc = null }) {
  const uniqueQueryId = String(rawData.UNIQUE_QUERY_ID || '').trim();
  const queryType = String(rawData.QUERY_TYPE || 'W').trim().toUpperCase();
  const queryTypeLabel = QUERY_TYPES[queryType] || queryType;

  const senderName = String(rawData.SENDER_NAME || 'IndiaMART Buyer').trim();
  const senderCompany = String(rawData.SENDER_COMPANY || '').trim();

  // Normalize phone & alternate phone
  const rawMobile = String(rawData.SENDER_MOBILE || rawData.SENDER_PHONE || '').trim();
  const rawMobileAlt = String(rawData.SENDER_MOBILE_ALT || rawData.SENDER_PHONE_ALT || '').trim();
  const phone = rawMobile.replace(/[^\d+]/g, '');
  const alternatePhone = rawMobileAlt.replace(/[^\d+]/g, '');

  // Normalize email & alternate email
  const email = String(rawData.SENDER_EMAIL || '').trim().toLowerCase();
  const emailAlt = String(rawData.SENDER_EMAIL_ALT || '').trim().toLowerCase();

  // Location / Billing Address
  const countryIso = String(rawData.SENDER_COUNTRY_ISO || 'IN').trim().toUpperCase();
  const country = countryIso === 'IN' ? 'India' : (rawData.SENDER_COUNTRY || countryIso);
  const city = String(rawData.SENDER_CITY || '').trim();
  const state = String(rawData.SENDER_STATE || '').trim();
  const pincode = String(rawData.SENDER_PINCODE || '').trim();
  const addressLine1 = String(rawData.SENDER_ADDRESS || '').trim();

  // Requirement & Products
  const productName = String(rawData.QUERY_PRODUCT_NAME || rawData.SUBJECT || 'IndiaMART Inquiry').trim();
  const queryMessage = String(rawData.QUERY_MESSAGE || '').trim();
  const mcatName = String(rawData.QUERY_MCAT_NAME || '').trim();
  const subject = String(rawData.SUBJECT || '').trim();

  const { quantity, unit } = extractQuantityAndUnit(queryMessage);

  const requirement = queryMessage || subject || productName;

  // Build notes with comprehensive metadata
  const notesLines = [
    `[IndiaMART Inbound Push Lead]`,
    `Query Type: ${queryTypeLabel} (${queryType})`,
    `IndiaMART Query ID: ${uniqueQueryId}`,
    `Inquiry Time: ${rawData.QUERY_TIME || new Date().toISOString()}`,
    mcatName ? `Category (MCAT): ${mcatName}` : null,
    subject ? `Subject: ${subject}` : null,
    rawData.RECEIVER_MOBILE ? `Receiver Mobile: ${rawData.RECEIVER_MOBILE}` : null,
    rawData.CALL_DURATION ? `Call Duration: ${rawData.CALL_DURATION}s` : null,
  ].filter(Boolean);

  const notes = notesLines.join('\n');

  // Priority
  const priority = PRIORITY_MAP[queryType] || 'medium';

  // Contacts array
  const contacts = [];
  if (senderName || phone || email) {
    contacts.push({
      name: senderName,
      phone,
      email,
      alternate_phone: alternatePhone,
      is_primary: true,
      department: 'Procurement / Buyer',
    });
  }
  if (emailAlt && emailAlt !== email) {
    contacts.push({
      name: senderName ? `${senderName} (Alt)` : 'Secondary Contact',
      phone: alternatePhone,
      email: emailAlt,
      is_primary: false,
    });
  }

  // Tags
  const tags = [
    'indiamart',
    queryTypeLabel.toLowerCase().replace(/[\s-]+/g, '_'),
  ];
  if (mcatName) tags.push(mcatName.toLowerCase().replace(/[\s-]+/g, '_'));

  // Department
  const department = defaultDepartment || 'UPS/Batteries';

  return {
    name: senderName,
    company_name: senderCompany,
    email,
    phone,
    alternate_phone: alternatePhone,
    contacts,
    billing_address: {
      address_line_1: addressLine1,
      city,
      state,
      pincode,
      country,
    },
    requirement,
    products: [
      {
        product_name: productName,
        quantity,
        unit,
        target_price: 0,
        remarks: mcatName ? `MCAT: ${mcatName}` : '',
      },
    ],
    source: sourceDoc?.name || DEFAULT_SOURCE_NAME,
    source_id: sourceDoc?._id || undefined,
    department,
    departments: [department],
    status: 'new',
    priority,
    notes,
    tags,
    indiamart_meta: {
      unique_query_id: uniqueQueryId,
      query_type: queryType,
      query_time: parseQueryTime(rawData.QUERY_TIME),
      subject,
      mcat_name: mcatName,
      receiver_mobile: String(rawData.RECEIVER_MOBILE || '').trim(),
      call_duration: String(rawData.CALL_DURATION || '').trim(),
      raw_payload: rawData,
    },
  };
}

module.exports = {
  extractIndiaMartData,
  parseQueryTime,
  extractQuantityAndUnit,
  mapIndiaMartToLead,
};
