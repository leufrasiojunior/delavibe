const controlCharacterPattern = /[\u0000-\u001F\u007F-\u009F]/g;
const anyWhitespacePattern = /\s+/g;

export function normalizeUnicode(value: string) {
  return value.normalize("NFKC");
}

export function removeControlCharacters(value: string) {
  return normalizeUnicode(value).replace(controlCharacterPattern, "");
}

export function hasControlCharacters(value: string) {
  return controlCharacterPattern.test(normalizeUnicode(value));
}

export function normalizeText(value: string) {
  return normalizeUnicode(value).replace(anyWhitespacePattern, " ").trim();
}

export function normalizeOptionalText(value?: string | null) {
  const normalized = normalizeText(value ?? "");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeCode(value: string) {
  return normalizeText(value).toUpperCase();
}

export function normalizeOptionalCode(value?: string | null) {
  const normalized = normalizeText(value ?? "");
  return normalized.length > 0 ? normalized.toUpperCase() : null;
}

export function normalizeBarcode(value: string) {
  return normalizeUnicode(value).replace(anyWhitespacePattern, "").trim().toUpperCase();
}

export function normalizePath(value: string) {
  return normalizeUnicode(value).trim();
}

export function normalizeEmail(value: string) {
  return normalizeText(value).toLowerCase();
}

export function normalizePhone(value: string) {
  return normalizeUnicode(value).replace(/\D+/g, "");
}

export function normalizeCep(value: string) {
  return normalizeUnicode(value).replace(/\D+/g, "");
}
