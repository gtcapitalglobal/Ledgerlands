/**
 * Date formatting utilities for consistent display across the application
 * All dates are displayed in mm/dd/yyyy format (US standard)
 */

/**
 * Format a date value to mm/dd/yyyy format
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted date string in mm/dd/yyyy format, or empty string if invalid
 */
export function formatDate(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch {
    return '';
  }
}

/**
 * Format a date value to ISO date string (yyyy-mm-dd) for input fields
 * @param date - Date object, ISO string, or timestamp
 * @returns ISO date string, or empty string if invalid
 */
export function formatDateForInput(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
}

/**
 * Format a date-time value to mm/dd/yyyy, hh:mm:ss format
 * @param date - Date object, ISO string, or timestamp
 * @returns Formatted datetime string, or empty string if invalid
 */
export function formatDateTime(date: Date | string | number | null | undefined): string {
  if (!date) return '';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const dateStr = formatDate(d);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${dateStr}, ${hours}:${minutes}:${seconds}`;
  } catch {
    return '';
  }
}
