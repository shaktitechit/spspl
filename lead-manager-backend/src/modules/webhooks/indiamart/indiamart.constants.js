/**
 * @fileoverview IndiaMART Push API Constants & Code Maps.
 * @module modules/webhooks/indiamart/indiamart.constants
 */

const QUERY_TYPES = {
  W: 'Direct Enquiry',
  B: 'Buy-Lead',
  P: 'PNS Call',
  BIZ: 'Catalog View',
  WA: 'WhatsApp Enquiry',
};

const DEFAULT_SOURCE_NAME = 'IndiaMART';
const DEFAULT_SOURCE_CODE = 'indiamart';

const PRIORITY_MAP = {
  B: 'high',   // Paid Buy-Leads require immediate callback
  WA: 'high',  // WhatsApp inquiries expect fast response
  W: 'medium', // Direct inquiries
  P: 'high',   // Phone call inquiries
  BIZ: 'low',  // Catalog views / cold browsing
};

module.exports = {
  QUERY_TYPES,
  DEFAULT_SOURCE_NAME,
  DEFAULT_SOURCE_CODE,
  PRIORITY_MAP,
};
