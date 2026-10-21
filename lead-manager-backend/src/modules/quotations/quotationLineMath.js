/**
 * Quotation line amounts — signed qty for returns / replacement credits.
 */

function parseQuotationLineQuantity(raw, fallback = 1) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function computeQuotationLineAmounts(item, options = {}) {
  const qty = parseQuotationLineQuantity(item.quantity, 1);
  const rate = Number(item.rate ?? item.unit_price) || 0;
  const grossAmount = Math.round(qty * rate * 100) / 100;

  let discountPercent = Number(item.discount_percent) || 0;
  let discountAmount = Number(item.discount_amount) || 0;

  if (discountPercent !== 0) {
    discountAmount = Math.round(((grossAmount * discountPercent) / 100) * 100) / 100;
  } else if (discountAmount !== 0 && grossAmount !== 0) {
    discountPercent = Math.round(((discountAmount / grossAmount) * 100) * 100) / 100;
  } else {
    discountPercent = 0;
    discountAmount = 0;
  }

  const taxableAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  const gstEnabled = options.gstEnabled !== false && item.gst_enabled !== false;
  const gstRate = gstEnabled ? (Number(item.gst_rate ?? item.gst_percent) || 0) : 0;

  return {
    qty,
    rate,
    grossAmount,
    discountPercent,
    discountAmount,
    taxableAmount,
    gstRate,
  };
}

function isValidQuotationLineQuantity(qty) {
  return Number.isFinite(qty) && qty !== 0;
}

module.exports = {
  parseQuotationLineQuantity,
  isValidQuotationLineQuantity,
  computeQuotationLineAmounts,
};
