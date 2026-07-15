// Author-based exclusion of commits from commitlint, keyed by email address.

// Parse the newline-separated `ignore-emails` input into a list of addresses.
// Blank lines and surrounding whitespace are dropped; an empty input yields an
// empty list, meaning no author is excluded.
export const parseIgnoreEmails = (raw: string): string[] => raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

// Whether an author is excluded, comparing the email case-insensitively against
// the ignore list.
export const isIgnoredEmail = (email: string, ignoreEmails: string[]): boolean => {
  const normalized = email.toLowerCase();
  return ignoreEmails.some((e) => e.toLowerCase() === normalized);
};
