/**
 * Core validation and sanitization utilities with strict character limits
 * and HTML/script injection prevention for ClassMate.
 */

export const LIMITS = {
  ANNOUNCEMENT_TITLE: 150,
  ANNOUNCEMENT_BODY: 250,
  ANNOUNCEMENT_TOPIC: 250,
  ANNOUNCEMENT_DESCRIPTION: 250,
  COURSE_NAME: 100,
  COURSE_CODE: 50,
  TEACHER_NAME: 100,
  SECTION: 50,
  COMMENT: 250,
  SEARCH_INPUT: 100,
  USER_DISPLAY_NAME: 100,
  CATEGORY: 50,
  ADMIN_NOTES: 250,
  URL: 2000,
  CLASS_NAME: 100,
  GROUP_CODE: 10,
  DATE: 50,
  TIME: 50,
} as const;

/**
 * Sanitizes user-entered text by stripping HTML tags and script injections
 * while strictly preserving Bangla/Unicode characters, emojis, math symbols,
 * standard punctuation, newlines, and academic notation.
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return '';
  let str = input.toString();

  // Strip HTML tags (<script>, <iframe>, <a>, <img>, etc.)
  str = str.replace(/<[^>]*>?/gm, '');

  // Strip dangerous javascript: pseudo-protocol strings
  str = str.replace(/javascript\s*:/gi, '');

  // Strip inline event handler patterns (e.g. onerror=, onload=)
  str = str.replace(/\bon[a-z]+\s*=/gi, '');

  return str.trim();
}

/**
 * Validates whether a string is a well-formed HTTP/HTTPS URL within character limits.
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return true; // Optional field
  const trimmed = url.trim();
  if (trimmed.length > LIMITS.URL) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized: string;
}

/**
 * Validates text length, required non-whitespace character presence,
 * and sanitizes the content.
 */
export function validateText(
  value: string | null | undefined,
  options: {
    fieldName: string;
    maxLength: number;
    minLength?: number;
    required?: boolean;
  }
): ValidationResult {
  const { fieldName, maxLength, minLength = 0, required = false } = options;
  const raw = value || '';
  const trimmed = raw.trim();

  if (required && trimmed.length === 0) {
    return {
      isValid: false,
      error: `${fieldName} is required.`,
      sanitized: '',
    };
  }

  if (trimmed.length > 0 && minLength > 0 && trimmed.length < minLength) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${minLength} characters long.`,
      sanitized: trimmed,
    };
  }

  if (raw.length > maxLength) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed ${maxLength} characters (currently ${raw.length}).`,
      sanitized: trimmed,
    };
  }

  const sanitized = sanitizeText(trimmed);
  if (required && sanitized.length === 0) {
    return {
      isValid: false,
      error: `${fieldName} contains only invalid characters or HTML tags.`,
      sanitized: '',
    };
  }

  return {
    isValid: true,
    sanitized,
  };
}

/**
 * Validates external resource URLs
 */
export function validateUrl(url: string | null | undefined, fieldName = 'Resource Link'): ValidationResult {
  if (!url || !url.trim()) {
    return { isValid: true, sanitized: '' };
  }
  const trimmed = url.trim();
  if (trimmed.length > LIMITS.URL) {
    return {
      isValid: false,
      error: `${fieldName} cannot exceed ${LIMITS.URL} characters.`,
      sanitized: trimmed,
    };
  }
  if (!isValidUrl(trimmed)) {
    return {
      isValid: false,
      error: `${fieldName} must be a valid URL starting with http:// or https://`,
      sanitized: trimmed,
    };
  }
  return {
    isValid: true,
    sanitized: trimmed,
  };
}
