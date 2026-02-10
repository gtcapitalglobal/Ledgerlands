/**
 * CSV utility functions compliant with RFC4180
 * https://datatracker.ietf.org/doc/html/rfc4180
 */

/**
 * Escape a single CSV field value according to RFC4180
 * Rules:
 * - Convert null/undefined to empty string
 * - If value contains comma, quote, or newline: wrap in quotes
 * - If value contains quotes: escape by doubling ("")
 */
export function csvEscape(value: any): string {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '';
  }

  // Convert to string
  const str = String(value);

  // Check if escaping is needed (contains comma, quote, or newline)
  const needsEscaping = str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r');

  if (needsEscaping) {
    // Escape quotes by doubling them
    const escaped = str.replace(/"/g, '""');
    // Wrap in quotes
    return `"${escaped}"`;
  }

  return str;
}

/**
 * Convert headers and rows to CSV string
 * @param headers Array of header strings
 * @param rows Array of objects where keys match headers
 */
export function toCSV(headers: string[], rows: Record<string, any>[]): string {
  // Build header row
  const headerRow = headers.map(h => csvEscape(h)).join(',');

  // Build data rows
  const dataRows = rows.map(row => {
    return headers.map(header => csvEscape(row[header])).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}
