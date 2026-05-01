const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function toCents(value: number) {
  if (!Number.isFinite(value)) {
    throw new TypeError("Valor monetário inválido.");
  }

  return Math.round(value * 100);
}

export function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function parseNumberish(value: string | number) {
  if (typeof value === "number") {
    return value;
  }

  return parseMoneyValue(value);
}

export function parseMoneyValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return Number.NaN;
  }

  const cleaned = trimmed.replace(/^R\$\s*/i, "").replace(/[^\d,.\-]/g, "");

  if (!cleaned) {
    return Number.NaN;
  }

  const isNegative = cleaned.startsWith("-");
  const normalized = cleaned.replace(/-/g, "");
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex >= 0) {
    const integerPart = normalized.slice(0, decimalIndex).replace(/[.,]/g, "");
    const decimalPart = normalized.slice(decimalIndex + 1).replace(/[.,]/g, "");
    const canonical = `${isNegative ? "-" : ""}${integerPart || "0"}.${decimalPart || "0"}`;
    return Number(canonical);
  }

  return Number(`${isNegative ? "-" : ""}${normalized.replace(/[.,]/g, "")}`);
}

export function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  return formatCurrency(Number(digits));
}

export function centsToCurrencyInput(value: number | null | undefined) {
  if (value == null) {
    return "";
  }

  return formatCurrency(value);
}

export function parseCurrencyInputToCents(value: string) {
  const parsed = parseMoneyValue(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return toCents(parsed);
}
