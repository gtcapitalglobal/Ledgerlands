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
  
  // Remove common prefixes and whitespace
  let normalized = input
    .trim()
    .replace(/^property\s*/i, '') // "Property 33" → "33"
    .replace(/^prop\s*/i, '')     // "Prop 33" → "33"
    .replace(/^#/, '');            // "#33" → "33"
  
  // Add # prefix
  return `#${normalized}`;
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
 * Parse decimal string to number
 */
export function parseDecimal(value: string | number): number {
  if (typeof value === 'number') return value;
  return parseFloat(value) || 0;
}
