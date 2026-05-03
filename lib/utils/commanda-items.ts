export function buildCommandaItemAddition(currentQuantity: number, addedQuantity: number, unitPriceCents: number) {
  const nextQuantity = currentQuantity + addedQuantity;

  return {
    nextQuantity,
    subtotalCents: nextQuantity * unitPriceCents,
    stockDelta: -addedQuantity,
  };
}

export function buildCommandaItemQuantityUpdate(currentQuantity: number, nextQuantity: number, unitPriceCents: number) {
  const quantityDelta = nextQuantity - currentQuantity;

  return {
    nextQuantity,
    quantityDelta,
    subtotalCents: nextQuantity * unitPriceCents,
    stockDelta: -quantityDelta,
  };
}
