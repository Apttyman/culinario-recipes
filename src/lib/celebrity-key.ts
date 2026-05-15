/**
 * Mirrors the edge-function logic for deriving a celebrity_key from a display name.
 * lowercase, whitespace -> underscore, strip non-alphanumeric (and non-underscore).
 * e.g. "Aaron Franklin" -> "aaron_franklin"
 */
export function toCelebrityKey(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
