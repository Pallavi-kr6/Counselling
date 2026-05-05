/**
 * Date/Time Helper Utility
 * Handles all date/time operations with consistent India-local scheduling.
 * Appointment date/time fields are entered and displayed as Asia/Kolkata
 * wall-clock values, while datetime fields store the matching UTC instant.
 */

const APP_TIMEZONE_OFFSET = '+05:30';

/**
 * Combine date and time into a proper DateTime object
 * @param {string} date - Date in format YYYY-MM-DD
 * @param {string} time - Time in format HH:MM or HH:MM:SS
 * @returns {Date} DateTime object representing the combined value
 */
function getDateTime(date, time) {
  if (!date || !time) {
    throw new Error(`Invalid date/time: date=${date}, time=${time}`);
  }

  // Normalize time to HH:MM:SS format
  const timeParts = String(time).split(':');
  const normalizedTime = [
    String(timeParts[0]).padStart(2, '0'),
    String(timeParts[1] || '00').padStart(2, '0'),
    String(timeParts[2] || '00').padStart(2, '0')
  ].join(':');

  const isoString = `${date}T${normalizedTime}${APP_TIMEZONE_OFFSET}`;
  return new Date(isoString);
}

/**
 * Classify a session based on its date/time
 * @param {Date} startDateTime - Session start datetime
 * @param {Date} endDateTime - Session end datetime
 * @param {Date} referenceTime - Time to compare against (default: now)
 * @returns {string} 'upcoming' | 'ongoing' | 'past'
 */
function classifySession(startDateTime, endDateTime, referenceTime = new Date()) {
  if (!(startDateTime instanceof Date) || !(endDateTime instanceof Date)) {
    throw new Error('startDateTime and endDateTime must be Date objects');
  }

  if (endDateTime < referenceTime) {
    return 'past';
  } else if (startDateTime > referenceTime) {
    return 'upcoming';
  } else {
    return 'ongoing';
  }
}

/**
 * Check if a time slot is available (doesn't overlap with existing appointment)
 * @param {Date} slotStart - Available slot start
 * @param {Date} slotEnd - Available slot end
 * @param {Date} appointmentStart - Existing appointment start
 * @param {Date} appointmentEnd - Existing appointment end
 * @returns {boolean} True if slot is available (no overlap)
 */
function isTimeSlotAvailable(slotStart, slotEnd, appointmentStart, appointmentEnd) {
  return slotEnd <= appointmentStart || slotStart >= appointmentEnd;
}

/**
 * Format date for logging/debugging
 * @param {string} date - Date in format YYYY-MM-DD
 * @param {string} time - Time in format HH:MM or HH:MM:SS
 * @returns {string} Human-readable format
 */
function formatDateTimeForLog(date, time) {
  try {
    const dt = getDateTime(date, time);
    return dt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return `${date} ${time}`;
  }
}

/**
 * Normalize time string to HH:MM format
 * @param {string} time - Time in various formats
 * @returns {string} Normalized HH:MM format
 */
function normalizeTime(time) {
  if (!time) return null;
  const parts = String(time).split(':');
  return `${String(parts[0] || '00').padStart(2, '0')}:${String(parts[1] || '00').padStart(2, '0')}`;
}

module.exports = {
  getDateTime,
  classifySession,
  isTimeSlotAvailable,
  formatDateTimeForLog,
  normalizeTime
};
