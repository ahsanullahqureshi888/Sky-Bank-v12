/**
 * Text truncation utilities for responsive UI
 */

/**
 * Truncate text to a maximum length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 50, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Get truncated text for different screen sizes
 * @param {string} text - Original text
 * @param {object} limits - Object with xs, sm, md, lg keys for max length per breakpoint
 * @returns {object} Truncated text for each breakpoint
 */
export const getTruncatedVariants = (
  text,
  limits = { xs: 15, sm: 25, md: 40, lg: 60 }
) => {
  return {
    xs: truncateText(text, limits.xs),
    sm: truncateText(text, limits.sm),
    md: truncateText(text, limits.md),
    lg: truncateText(text, limits.lg),
  };
};

/**
 * Format text for table cells with smart truncation
 * @param {string} text - Text to format
 * @param {number} chars - Characters to show
 * @returns {string} Formatted text
 */
export const formatTableCell = (text, chars = 20) => {
  if (!text) return '—';
  return truncateText(String(text).trim(), chars);
};

/**
 * Create accessible truncated content
 * Used for screen reader announcements
 * @param {string} text - Original text
 * @param {string} truncated - Truncated text
 * @returns {string} ARIA label
 */
export const createTruncationAriaLabel = (text, truncated) => {
  return text !== truncated ? `${truncated} (full text: ${text})` : text;
};

export default {
  truncateText,
  getTruncatedVariants,
  formatTableCell,
  createTruncationAriaLabel,
};
