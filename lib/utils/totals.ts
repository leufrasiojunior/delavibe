export function sumByCents(items: Array<{ subtotalCents: number }>) {
  return items.reduce((sum, item) => sum + item.subtotalCents, 0);
}

export function sumPaymentCents(payments: Array<{ amountCents: number }>) {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function calculateCommandaTotals(items: Array<{ subtotalCents: number }>, discountCents = 0) {
  const subtotalCents = sumByCents(items);
  const totalCents = Math.max(subtotalCents - discountCents, 0);

  return {
    subtotalCents,
    discountCents,
    totalCents,
  };
}
