import assert from "node:assert/strict";
import test from "node:test";

import { PromotionType } from "@prisma/client";

import { createPromotionInputSchema, type PromotionDto } from "@/lib/schemas/promotion";
import {
  getPromotionStatus,
  periodsOverlap,
  promotionAppliesToTarget,
  promotionTypesOverlap,
  selectActivePromotionForTarget,
} from "@/lib/services/promotion-service";
import {
  filterPromotionsForAdmin,
  findPromotionConflict,
} from "@/lib/utils/promotion-admin";
import {
  calculatePromotionSavings,
  formatPromotionSavingsLine,
} from "@/lib/utils/promotion-display";
import { formatCurrency } from "@/lib/utils/money";

const basePromotion = {
  id: "promotion-1",
  promotionalPriceCents: 900,
  startsAt: new Date("2026-06-10T10:00:00.000Z"),
  endsAt: new Date("2026-06-10T20:00:00.000Z"),
  isActive: true,
};

function buildPromotion(
  overrides: Partial<Omit<PromotionDto, "product">> & {
    product?: Partial<PromotionDto["product"]>;
  },
): PromotionDto {
  const { product: productOverrides, ...promotionOverrides } = overrides;
  const id = overrides.id ?? "promotion-admin-1";
  const productId = overrides.productId ?? "product-1";

  return {
    id,
    productId,
    product: {
      id: productId,
      name: "Produto teste",
      sku: "SKU-TESTE",
      barcode: "7890000000000",
      category: "Categoria",
      priceCents: 1000,
      imagePath: null,
      updatedAt: "2026-06-10T09:00:00.000Z",
      ...productOverrides,
    },
    type: PromotionType.site,
    promotionalPriceCents: 800,
    startsAt: "2026-06-10T10:00:00.000Z",
    endsAt: "2026-06-10T20:00:00.000Z",
    isActive: true,
    createdAt: "2026-06-10T09:00:00.000Z",
    updatedAt: "2026-06-10T09:00:00.000Z",
    ...promotionOverrides,
  };
}

test("promotionAppliesToTarget mantém local fora do site público", () => {
  assert.equal(promotionAppliesToTarget(PromotionType.local, "local"), true);
  assert.equal(promotionAppliesToTarget(PromotionType.local, "site"), false);
  assert.equal(promotionAppliesToTarget(PromotionType.site, "site"), true);
  assert.equal(promotionAppliesToTarget(PromotionType.site, "local"), false);
  assert.equal(promotionAppliesToTarget(PromotionType.both, "site"), true);
  assert.equal(promotionAppliesToTarget(PromotionType.both, "local"), true);
});

test("promotionTypesOverlap permite site e local simultâneos, mas bloqueia ambos", () => {
  assert.equal(promotionTypesOverlap(PromotionType.site, PromotionType.local), false);
  assert.equal(promotionTypesOverlap(PromotionType.site, PromotionType.both), true);
  assert.equal(promotionTypesOverlap(PromotionType.local, PromotionType.both), true);
  assert.equal(promotionTypesOverlap(PromotionType.both, PromotionType.both), true);
});

test("periodsOverlap trata fim igual ao início seguinte como sem conflito", () => {
  assert.equal(
    periodsOverlap(
      new Date("2026-06-10T10:00:00.000Z"),
      new Date("2026-06-10T12:00:00.000Z"),
      new Date("2026-06-10T12:00:00.000Z"),
      new Date("2026-06-10T14:00:00.000Z"),
    ),
    false,
  );

  assert.equal(
    periodsOverlap(
      new Date("2026-06-10T10:00:00.000Z"),
      new Date("2026-06-10T12:00:00.000Z"),
      new Date("2026-06-10T11:59:59.000Z"),
      new Date("2026-06-10T14:00:00.000Z"),
    ),
    true,
  );
});

test("selectActivePromotionForTarget aplica somente promoções do canal correto", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const promotions = [
    { ...basePromotion, id: "local", type: PromotionType.local, promotionalPriceCents: 700 },
    { ...basePromotion, id: "site", type: PromotionType.site, promotionalPriceCents: 800 },
  ];

  const sitePromotion = selectActivePromotionForTarget(promotions, "site", 1000, now);
  const localPromotion = selectActivePromotionForTarget(promotions, "local", 1000, now);

  assert.equal(sitePromotion?.id, "site");
  assert.equal(localPromotion?.id, "local");
});

test("selectActivePromotionForTarget ignora preço promocional inválido", () => {
  const selected = selectActivePromotionForTarget(
    [{ ...basePromotion, type: PromotionType.site, promotionalPriceCents: 1200 }],
    "site",
    1000,
    new Date("2026-06-10T12:00:00.000Z"),
  );

  assert.equal(selected, null);
});

test("getPromotionStatus cobre ativa, agendada, vencida e inativa", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");

  assert.equal(getPromotionStatus({ ...basePromotion }, now), "active");
  assert.equal(
    getPromotionStatus({ ...basePromotion, startsAt: new Date("2026-06-10T13:00:00.000Z") }, now),
    "scheduled",
  );
  assert.equal(
    getPromotionStatus({ ...basePromotion, endsAt: new Date("2026-06-10T12:00:00.000Z") }, now),
    "expired",
  );
  assert.equal(getPromotionStatus({ ...basePromotion, isActive: false }, now), "inactive");
});

test("createPromotionInputSchema converte preço e rejeita período invertido", async () => {
  const parsed = await createPromotionInputSchema.parseAsync({
    productId: "ckxyz0000000000000000000a",
    type: PromotionType.site,
    promotionalPrice: "R$ 9,90",
    startsAt: "2026-06-10T10:00",
    endsAt: "2026-06-10T20:00",
    isActive: true,
  });

  assert.equal(parsed.promotionalPriceCents, 990);
  assert.equal(parsed.type, PromotionType.site);

  await assert.rejects(
    createPromotionInputSchema.parseAsync({
      productId: "ckxyz0000000000000000000a",
      type: PromotionType.site,
      promotionalPrice: "R$ 9,90",
      startsAt: "2026-06-10T20:00",
      endsAt: "2026-06-10T10:00",
      isActive: true,
    }),
    /fim da promoção/i,
  );
});

test("calculatePromotionSavings mostra economia e ignora preço sem desconto", () => {
  const savings = calculatePromotionSavings(1000, 800);

  assert.equal(savings?.savingsCents, 200);
  assert.equal(savings?.discountLabel, "20% OFF");
  assert.equal(
    formatPromotionSavingsLine(1000, 800),
    `De ${formatCurrency(1000)} por ${formatCurrency(800)} · 20% OFF`,
  );
  assert.equal(calculatePromotionSavings(1000, 1000), null);
  assert.equal(calculatePromotionSavings(1000, 1200), null);
});

test("findPromotionConflict replica conflito preventivo da tela admin", () => {
  const existingSite = buildPromotion({
    id: "site",
    productId: "product-1",
    type: PromotionType.site,
    startsAt: "2026-06-10T10:00:00.000Z",
    endsAt: "2026-06-10T20:00:00.000Z",
  });

  assert.equal(
    findPromotionConflict([existingSite], {
      id: null,
      productId: "product-1",
      type: PromotionType.local,
      startsAt: "2026-06-10T12:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
      isActive: true,
    }),
    null,
  );

  assert.equal(
    findPromotionConflict([existingSite], {
      id: null,
      productId: "product-1",
      type: PromotionType.both,
      startsAt: "2026-06-10T12:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
      isActive: true,
    })?.id,
    "site",
  );

  assert.equal(
    findPromotionConflict([existingSite], {
      id: null,
      productId: "product-1",
      type: PromotionType.site,
      startsAt: "2026-06-10T12:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
      isActive: true,
    })?.id,
    "site",
  );

  assert.equal(
    findPromotionConflict([existingSite], {
      id: "site",
      productId: "product-1",
      type: PromotionType.site,
      startsAt: "2026-06-10T12:00:00.000Z",
      endsAt: "2026-06-10T13:00:00.000Z",
      isActive: true,
    }),
    null,
  );
});

test("filterPromotionsForAdmin combina filtros e ordena por prioridade operacional", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const promotions = [
    buildPromotion({
      id: "inactive",
      type: PromotionType.site,
      isActive: false,
      endsAt: "2026-06-10T13:00:00.000Z",
      updatedAt: "2026-06-10T12:30:00.000Z",
    }),
    buildPromotion({
      id: "expired-old",
      type: PromotionType.local,
      endsAt: "2026-06-10T09:00:00.000Z",
    }),
    buildPromotion({
      id: "scheduled",
      type: PromotionType.both,
      startsAt: "2026-06-10T13:00:00.000Z",
      endsAt: "2026-06-10T14:00:00.000Z",
    }),
    buildPromotion({
      id: "active-later",
      type: PromotionType.site,
      product: { sku: "SKU-SITE" },
      endsAt: "2026-06-10T20:00:00.000Z",
    }),
    buildPromotion({
      id: "expired-recent",
      type: PromotionType.local,
      endsAt: "2026-06-10T11:00:00.000Z",
    }),
    buildPromotion({
      id: "active-near",
      type: PromotionType.local,
      endsAt: "2026-06-10T13:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    filterPromotionsForAdmin(promotions, { status: "all", type: "all", search: "", now }).map(
      (promotion) => promotion.id,
    ),
    ["active-near", "active-later", "scheduled", "expired-recent", "expired-old", "inactive"],
  );

  assert.deepEqual(
    filterPromotionsForAdmin(promotions, {
      status: "active",
      type: PromotionType.site,
      search: "sku-site",
      now,
    }).map((promotion) => promotion.id),
    ["active-later"],
  );
});
