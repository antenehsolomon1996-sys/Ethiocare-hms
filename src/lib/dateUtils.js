import { format, isValid } from 'date-fns';

/**
 * Parses any date input safely into a Date object adjusted for Ethiopian Local Time (EAT / UTC+3).
 * Solves the issue where ISO strings without time (e.g., "2026-09-17") get parsed as UTC midnight
 * and display as the previous day in timezones behind UTC, or UTC midnight displaying early in EAT.
 */
export function toEATDate(dateInput) {
  if (!dateInput) return new Date();

  // 1. If it's already a valid Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();

    // 2. Plain Date string: "YYYY-MM-DD"
    // Treat as midday (12:00:00) in local time to avoid midnight UTC boundary rollover
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0);
    }

    // 3. ISO timestamp or custom datetime string
    const parsed = new Date(trimmed);
    if (isValid(parsed) && !isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

/**
 * Format date in Ethiopian local date format: "dd/MM/yyyy"
 */
export function formatDateEAT(dateInput, formatPattern = 'dd/MM/yyyy') {
  try {
    const d = toEATDate(dateInput);
    return format(d, formatPattern);
  } catch {
    return String(dateInput || '');
  }
}

/**
 * Format date and time: "dd/MM/yyyy hh:mm a"
 */
export function formatDateTimeEAT(dateInput, formatPattern = 'dd/MM/yyyy hh:mm a') {
  try {
    const d = toEATDate(dateInput);
    return format(d, formatPattern);
  } catch {
    return String(dateInput || '');
  }
}

/**
 * Format relative time or friendly date (Today, Yesterday, or dd/MM/yyyy)
 */
export function formatFriendlyDateEAT(dateInput) {
  try {
    const d = toEATDate(dateInput);
    const now = new Date();

    const isToday = 
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today at ${format(d, 'hh:mm a')}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = 
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday at ${format(d, 'hh:mm a')}`;
    }

    return format(d, 'dd/MM/yyyy hh:mm a');
  } catch {
    return String(dateInput || '');
  }
}

/**
 * Get today's date in YYYY-MM-DD string
 */
export function getTodayEATString() {
  return format(new Date(), 'yyyy-MM-dd');
}
