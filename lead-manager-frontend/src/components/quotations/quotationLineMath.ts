/**
 * Shared quotation line math — supports negative qty (returns / replacement credits).
 */

export type QuotationLineInput = {
  quantity?: number | string | null;
  rate?: number | string | null;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  gst_rate?: number | string | null;
  gst_enabled?: boolean | null;
};

export function parseQuotationLineQuantity(raw: unknown, fallback = 1): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Zero is invalid; negative qty is allowed for return / replacement lines. */
export function isValidQuotationLineQuantity(qty: number): boolean {
  return Number.isFinite(qty) && qty !== 0;
}

export type QuotationMathOptions = {
  gstEnabled?: boolean;
};

export function computeQuotationLineAmounts(
  item: QuotationLineInput,
  options?: QuotationMathOptions
) {
  const qty = parseQuotationLineQuantity(item.quantity, 1);
  const rate = Number(item.rate) || 0;
  const gross = Math.round(qty * rate * 100) / 100;

  let discPercent = Number(item.discount_percent) || 0;
  let discAmt = Number(item.discount_amount) || 0;

  if (discPercent !== 0) {
    discAmt = Math.round(((gross * discPercent) / 100) * 100) / 100;
  } else if (discAmt !== 0 && gross !== 0) {
    discPercent = Math.round(((discAmt / gross) * 100) * 100) / 100;
  } else {
    discPercent = 0;
    discAmt = 0;
  }

  const taxable = Math.round((gross - discAmt) * 100) / 100;
  const isGstActive = options?.gstEnabled !== false && item.gst_enabled !== false;
  const gstRate = isGstActive ? (Number(item.gst_rate) || 0) : 0;
  const gstAmt = isGstActive ? Math.round(((taxable * gstRate) / 100) * 100) / 100 : 0;
  const lineTotal = Math.round((taxable + gstAmt) * 100) / 100;

  return {
    qty,
    rate,
    gross,
    discPercent,
    discAmt,
    taxable,
    gstRate,
    gstAmt,
    lineTotal,
    gstEnabled: isGstActive,
  };
}

export function computeQuotationTotals(
  items: QuotationLineInput[],
  options?: QuotationMathOptions
) {
  const isGstActive = options?.gstEnabled !== false;
  const computedItems = items.map((item) => {
    const amounts = computeQuotationLineAmounts(item, options);
    return { item, ...amounts };
  });

  const totalGross =
    Math.round(computedItems.reduce((acc, it) => acc + it.gross, 0) * 100) / 100;
  const totalDiscount =
    Math.round(computedItems.reduce((acc, it) => acc + it.discAmt, 0) * 100) / 100;
  const subtotal =
    Math.round(computedItems.reduce((acc, it) => acc + it.taxable, 0) * 100) / 100;
  const totalGst = isGstActive
    ? Math.round(computedItems.reduce((acc, it) => acc + it.gstAmt, 0) * 100) / 100
    : 0;
  const rawGrandTotal = subtotal + totalGst;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;
  const amount_in_words = numberToIndianWords(grandTotal);

  return {
    computedItems,
    totalGross,
    totalDiscount,
    subtotal,
    totalGst,
    roundOff,
    grandTotal,
    amount_in_words,
  };
}

/**
 * Converts a number to Indian currency words format (e.g. Rupees One Lakh Twenty-Five Thousand Only).
 */
export function numberToIndianWords(num: number | null | undefined): string {
  if (num == null || Number.isNaN(num)) return "";
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero Rupees Only";

  const units = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertTwoDigits(val: number): string {
    if (val < 20) return units[val];
    const rem = val % 10;
    return tens[Math.floor(val / 10)] + (rem ? " " + units[rem] : "");
  }

  function convertThreeDigits(val: number): string {
    let str = "";
    if (Math.floor(val / 100) > 0) {
      str += units[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val > 0) {
      str += convertTwoDigits(val);
    }
    return str.trim();
  }

  let crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  let thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  let hundred = rem;

  let result = "";
  if (crore > 0) {
    result += (crore < 100 ? convertTwoDigits(crore) : convertThreeDigits(crore)) + " Crore ";
  }
  if (lakh > 0) {
    result += convertTwoDigits(lakh) + " Lakh ";
  }
  if (thousand > 0) {
    result += convertTwoDigits(thousand) + " Thousand ";
  }
  if (hundred > 0) {
    result += convertThreeDigits(hundred) + " ";
  }

  const rupeeStr = result.trim() ? `Rupees ${result.trim()}` : "Zero Rupees";

  // Handle paise
  const decimal = Math.round((Math.abs(num) - n) * 100);
  if (decimal > 0) {
    return `${rupeeStr} and ${convertTwoDigits(decimal)} Paise Only`;
  }

  return `${rupeeStr} Only`;
}
