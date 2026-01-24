/**
 * Shared utility functions used across client and server
 */

/**
 * Normalize property ID to consistent format: "#XX"
 * 
 * Accepts various formats:
 * - "33" → "#33"
 * - "#33" → "#33"
 * - "Property 33" → "#33"
 * - "  #33  " → "#33"
 * - "PROP 33" → "#33"
 * 
 * Prevents duplicates in CSV import and database
 */
export function normalizePropertyId(input: string): string {
  if (!input) return '';
  
  // Remove all spaces, #, and common prefixes
  let normalized = input
    .trim()
    .replace(/\s+/g, '')           // Remove all spaces
    .replace(/#/g, '')             // Remove all #
    .replace(/^property/i, '')     // "Property33" → "33"
    .replace(/^prop/i, '');        // "Prop33" → "33"
  
  // Add # prefix if normalized is not empty
  return normalized ? `#${normalized}` : '';
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Parse decimal string to number, normalizing comma/dot separators
 * Handles both US (1,234.56) and European (1.234,56) formats
 * 
 * Examples:
 * - "1,234.56" → 1234.56
 * - "1.234,56" → 1234.56
 * - "1234.56" → 1234.56
 * - "1234,56" → 1234.56
 */
export function parseDecimal(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value).trim();
  
  // Count occurrences of comma and dot
  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;
  
  // If both present, determine which is thousands separator
  if (commaCount > 0 && dotCount > 0) {
    // Find last occurrence of each
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    // The one that appears last is the decimal separator
    if (lastComma > lastDot) {
      // European format: 1.234,56
      return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      // US format: 1,234.56
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
  }
  
  // Only comma: could be thousands (1,234) or decimal (1,56)
  if (commaCount > 0 && dotCount === 0) {
    // If multiple commas, it's thousands separator
    if (commaCount > 1) {
      return parseFloat(str.replace(/,/g, '')) || 0;
    }
    // Single comma: check position to determine if thousands or decimal
    const parts = str.split(',');
    if (parts[1] && parts[1].length <= 2) {
      // Likely decimal: 1,56
      return parseFloat(str.replace(',', '.')) || 0;
    } else {
      // Likely thousands: 1,234
      return parseFloat(str.replace(',', '')) || 0;
    }
  }
  
  // Only dot or no separator: standard parsing
  return parseFloat(str) || 0;
}

/**
 * Compute effective down payment from contract + payments
 * 
 * Logic:
 * 1. Check if there's a payment with memo containing "down payment" or "entrada" (case-insensitive)
 * 2. If found, use that payment's principal as DP (and DO NOT add contract.downPayment)
 * 3. Else, use contract.downPayment (if > 0)
 * 
 * This prevents double-counting when DP is recorded both in contract field AND as a payment.
 * 
 * @param contract Contract object with downPayment and contractDate
 * @param paymentsInScope Array of payments to search for DP payment
 * @returns Object with { effectiveDP: number, dpPaymentId: number | null, dpDate: Date }
 */
export function computeEffectiveDownPayment(
  contract: { downPayment: string | number; contractDate: Date | string },
  paymentsInScope: Array<{ id: number; principalAmount: string | number; memo?: string | null }>
): { effectiveDP: number; dpPaymentId: number | null; dpDate: Date } {
  // Search for DP payment in memo
  const dpPayment = paymentsInScope.find(p => {
    if (!p.memo) return false;
    const memoLower = p.memo.toLowerCase();
    return memoLower.includes('down payment') || memoLower.includes('entrada');
  });

  if (dpPayment) {
    // Use payment principal as DP
    return {
      effectiveDP: parseDecimal(dpPayment.principalAmount),
      dpPaymentId: dpPayment.id,
      dpDate: new Date(contract.contractDate),
    };
  }

  // Use contract downPayment field
  const contractDP = parseDecimal(contract.downPayment);
  return {
    effectiveDP: contractDP,
    dpPaymentId: null,
    dpDate: new Date(contract.contractDate),
  };
}
