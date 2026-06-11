import { formatCurrency } from "@/lib/utils/money";

export type PromotionSavings = {
  savingsCents: number;
  discountPercent: number;
  discountLabel: string;
};

export function calculatePromotionSavings(
  originalPriceCents: number,
  promotionalPriceCents: number,
): PromotionSavings | null {
  if (
    !Number.isFinite(originalPriceCents) ||
    !Number.isFinite(promotionalPriceCents) ||
    originalPriceCents <= 0 ||
    promotionalPriceCents < 0 ||
    promotionalPriceCents >= originalPriceCents
  ) {
    return null;
  }

  const savingsCents = originalPriceCents - promotionalPriceCents;
  const rawPercent = (savingsCents / originalPriceCents) * 100;
  const roundedPercent = Math.round(rawPercent);

  return {
    savingsCents,
    discountPercent: rawPercent,
    discountLabel: roundedPercent < 1 ? "<1% OFF" : `${roundedPercent}% OFF`,
  };
}

export function formatPromotionSavingsLine(
  originalPriceCents: number,
  promotionalPriceCents: number,
) {
  const savings = calculatePromotionSavings(originalPriceCents, promotionalPriceCents);

  if (!savings) {
    return null;
  }

  return `De ${formatCurrency(originalPriceCents)} por ${formatCurrency(promotionalPriceCents)} · ${savings.discountLabel}`;
}
