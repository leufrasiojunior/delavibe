import assert from "node:assert/strict";
import test from "node:test";

import { PromotionType } from "@prisma/client";

import { updateAppSettingsInputSchema } from "@/lib/schemas/app-settings";
import { type PublicProductDto } from "@/lib/schemas/product";
import {
  filterPublicCatalogProducts,
  getDefaultPublicCatalogTab,
  PUBLIC_CATALOG_ALL_TAB,
  PUBLIC_CATALOG_PROMOTIONS_TAB,
} from "@/lib/utils/public-catalog";
import { buildWhatsappUrl, normalizeWhatsappPhone } from "@/lib/utils/whatsapp";

function product(overrides: Partial<PublicProductDto>): PublicProductDto {
  return {
    id: "product-1",
    name: "Produto",
    category: "Categoria",
    imagePath: null,
    unit: "un",
    priceCents: 1000,
    stockQty: 10,
    minimumStock: 1,
    isActive: true,
    activeLocalPromotion: null,
    updatedAt: "2026-06-10T10:00:00.000Z",
    effectivePriceCents: 1000,
    promotion: null,
    ...overrides,
  };
}

test("buildWhatsappUrl monta wa.me com duas barras e pais 55", () => {
  assert.equal(normalizeWhatsappPhone("(11) 91234-5678"), "5511912345678");
  assert.equal(
    buildWhatsappUrl("(11) 91234-5678"),
    "https://wa.me//5511912345678",
  );
  assert.equal(
    buildWhatsappUrl("5511912345678"),
    "https://wa.me//5511912345678",
  );
});

test("buildWhatsappUrl adiciona text encoded somente quando mensagem existe", () => {
  assert.equal(
    buildWhatsappUrl("11912345678", "Tenho interesse em comprar seu carro"),
    "https://wa.me//5511912345678?text=Tenho%20interesse%20em%20comprar%20seu%20carro",
  );
  assert.equal(buildWhatsappUrl("11912345678", "   "), "https://wa.me//5511912345678");
  assert.equal(buildWhatsappUrl("12345"), null);
});

test("updateAppSettingsInputSchema aceita campos vazios e normaliza WhatsApp", () => {
  const empty = updateAppSettingsInputSchema.parse({
    whatsappContactPhone: "",
    webOrderWhatsappMessage: "",
  });

  assert.equal(empty.whatsappContactPhone, null);
  assert.equal(empty.webOrderWhatsappMessage, null);

  const parsed = updateAppSettingsInputSchema.parse({
    whatsappContactPhone: "(11) 91234-5678",
    webOrderWhatsappMessage: "  Olá, tudo bem?  ",
  });

  assert.equal(parsed.whatsappContactPhone, "5511912345678");
  assert.equal(parsed.webOrderWhatsappMessage, "Olá, tudo bem?");
});

test("catalogo publico inicia em promocoes quando houver desconto ativo", () => {
  const products = [
    product({ id: "normal", name: "Normal" }),
    product({
      id: "promo",
      name: "Promo",
      effectivePriceCents: 800,
      promotion: {
        id: "promotion-1",
        type: PromotionType.site,
        promotionalPriceCents: 800,
        startsAt: "2026-06-10T10:00:00.000Z",
        endsAt: "2026-06-11T10:00:00.000Z",
      },
    }),
  ];

  assert.equal(getDefaultPublicCatalogTab(products), PUBLIC_CATALOG_PROMOTIONS_TAB);
  assert.deepEqual(
    filterPublicCatalogProducts(products, {
      activeTab: PUBLIC_CATALOG_PROMOTIONS_TAB,
      search: "",
    }).map((item) => item.id),
    ["promo"],
  );
});

test("catalogo publico inicia em todas quando nao houver desconto ativo", () => {
  const products = [product({ id: "normal" })];

  assert.equal(getDefaultPublicCatalogTab(products), PUBLIC_CATALOG_ALL_TAB);
});
