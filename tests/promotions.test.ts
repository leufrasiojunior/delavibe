import assert from "node:assert/strict";
import test from "node:test";

import { PromotionType } from "@prisma/client";

import { createPromotionInputSchema } from "@/lib/schemas/promotion";
import {
  getPromotionStatus,
  periodsOverlap,
  promotionAppliesToTarget,
  promotionTypesOverlap,
  selectActivePromotionForTarget,
} from "@/lib/services/promotion-service";

const basePromotion = {
  id: "promotion-1",
  promotionalPriceCents: 900,
  startsAt: new Date("2026-06-10T10:00:00.000Z"),
  endsAt: new Date("2026-06-10T20:00:00.000Z"),
  isActive: true,
};

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
