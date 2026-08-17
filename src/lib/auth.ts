export const DIU_EMAIL_DOMAIN = '@diu.edu.bd';
export const DIU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@diu\.edu\.bd$/i;

/**
 * Validates if the email belongs strictly and exactly to the @diu.edu.bd university domain
 * (Case-insensitive, rejects subdomains, prefixes, or attacker suffixes like .attacker.com)
 */
export function isDiuEmail(email: string): boolean {
  if (!email) return false;
  const trimmed = email.trim().toLowerCase();
  return DIU_EMAIL_REGEX.test(trimmed);
}

/**
 * Automatically extracts the student or faculty username prefix from the email.
 * E.g. "251-35-114@diu.edu.bd" -> "251-35-114"
 */
export function extractUsernameFromEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (!isDiuEmail(trimmed)) {
    throw new Error('Only verified DIU accounts (@diu.edu.bd) can access ClassMate.');
  }
  return trimmed.replace('@diu.edu.bd', '');
}

/**
 * Generates a clean, unambiguous 6-character uppercase alphanumeric group code
 * (avoiding confusing glyphs like 0, O, 1, I).
 */
export function generateGroupCode(length = 6): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Calculates exactly 4 months expiration from a given creation date
 */
export function calculateExpirationDate(createdAt: Date = new Date()): string {
  const exp = new Date(createdAt);
  exp.setMonth(exp.getMonth() + 4);
  return exp.toISOString();
}

/**
 * Checks if a group is expired based on current timestamp
 */
export function isGroupExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Human-friendly short relative time formatter (e.g. "Just now", "2h ago", "2d ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays}d ago`;
  }
  const diffInMonths = Math.floor(diffInDays / 30);
  return `${diffInMonths}mo ago`;
}

/**
 * Human-friendly date formatter (e.g. "Nov 30, 2026")
 */
export function formatFriendlyDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}
