// ISO 639-1 codes for the languages this site is likely to host that read
// right-to-left. Extend this set rather than special-casing "he" elsewhere.
const RTL_LANGUAGES = new Set(["ar", "he", "fa", "ur", "yi", "ps", "dv"]);

/**
 * Whether a book's `language` frontmatter value (e.g. "he", "en") should be
 * rendered right-to-left. Defaults to false for missing/unrecognized codes,
 * so existing English-only content is unaffected.
 */
export function isRtlLanguage(language: string | undefined): boolean {
  if (!language) return false;
  return RTL_LANGUAGES.has(language.trim().toLowerCase());
}

/** The HTML `dir` attribute value to use for a book's language. */
export function bookDir(language: string | undefined): "rtl" | "ltr" {
  return isRtlLanguage(language) ? "rtl" : "ltr";
}
