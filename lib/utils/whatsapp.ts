import { normalizePhone } from "@/lib/utils/strings";

export function normalizeWhatsappPhone(value?: string | null) {
  const digits = normalizePhone(value ?? "");

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  return null;
}

export function buildWhatsappUrl(phone?: string | null, message?: string | null) {
  const normalizedPhone = normalizeWhatsappPhone(phone);

  if (!normalizedPhone) {
    return null;
  }

  const trimmedMessage = message?.trim();
  const baseUrl = `https://wa.me//${normalizedPhone}`;

  if (!trimmedMessage) {
    return baseUrl;
  }

  return `${baseUrl}?text=${encodeURIComponent(trimmedMessage)}`;
}
