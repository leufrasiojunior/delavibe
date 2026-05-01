export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
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
  return value.replace(/\s+/g, "").trim();
}
