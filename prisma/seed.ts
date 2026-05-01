import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, StockMovementReason } from "@prisma/client";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://delavibe:delavibe@localhost:5432/delavibe?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
const seedAdmin = {
  name: "Administrador",
  username: "admin",
  passwordHash: "$2b$12$eieT.r5Us5V8wMs3zH9su.8kiQERmBsKo7KViueSCxOhJbpVZlfW6",
};

const workbookSeedCatalog = [
  { category: "CERVEJA", name: "Heinken lata", stockQty: 96, priceCents: 500 },
  { category: "CERVEJA", name: "Heineken caixa", stockQty: 12, priceCents: 3600 },
  { category: "CERVEJA", name: "Original lata", stockQty: 120, priceCents: 450 },
  { category: "CERVEJA", name: "Original caixa", stockQty: 8, priceCents: 5300 },
  { category: "CERVEJA", name: "Amstel lata", stockQty: 96, priceCents: 400 },
  { category: "CERVEJA", name: "Amstel caixa", stockQty: 8, priceCents: 3700 },
  { category: "CERVEJA", name: "Skol lata", stockQty: 44, priceCents: 350 },
  { category: "CERVEJA", name: "Skol caixinha", stockQty: 3, priceCents: 4100 },
  { category: "CERVEJA", name: "Imperio lata", stockQty: 45, priceCents: 350 },
  { category: "CERVEJA", name: "Imperio caixa", stockQty: 3, priceCents: 3800 },
  { category: "CERVEJA", name: "Heineken Log", stockQty: 72, priceCents: 850 },
  { category: "CERVEJA", name: "Heineken caixa", stockQty: 12, priceCents: 4000 },
  { category: "CERVEJA", name: "Heneiken Zero Log", stockQty: 24, priceCents: 1000 },
  { category: "CERVEJA", name: "Heneiken Zero caixa", stockQty: 4, priceCents: 4400 },
  { category: "CERVEJA", name: "Corona Long", stockQty: 48, priceCents: 1000 },
  { category: "CERVEJA", name: "Corona Long caixa", stockQty: 8, priceCents: 4600 },
  { category: "DESLITADOS E WHISKIY", name: "Ice Smirnoff Long", stockQty: 24, priceCents: 1000 },
  { category: "DESLITADOS E WHISKIY", name: "Drafit", stockQty: 6, priceCents: 1300 },
  { category: "DESLITADOS E WHISKIY", name: "Vinho Pergola", stockQty: 2, priceCents: 2500 },
  { category: "DESLITADOS E WHISKIY", name: "Vinho cantinho do vale", stockQty: 5, priceCents: 700 },
  { category: "DESLITADOS E WHISKIY", name: "Drea", stockQty: 3, priceCents: 2500 },
  { category: "DESLITADOS E WHISKIY", name: "Velho Barreiro", stockQty: 3, priceCents: 1800 },
  { category: "DESLITADOS E WHISKIY", name: "Garrafa 51", stockQty: 1, priceCents: 1800 },
  { category: "DESLITADOS E WHISKIY", name: "Vodka tradicional Askov", stockQty: 1, priceCents: 2000 },
  { category: "DESLITADOS E WHISKIY", name: "Vodka tradicional Smirnoff", stockQty: 1, priceCents: 4000 },
  { category: "DESLITADOS E WHISKIY", name: "Vodka Sabor Askov", stockQty: 3, priceCents: 2000 },
  { category: "DESLITADOS E WHISKIY", name: "Corote", stockQty: 6, priceCents: 500 },
  { category: "DESLITADOS E WHISKIY", name: "Pitu", stockQty: 6, priceCents: 700 },
  { category: "DESLITADOS E WHISKIY", name: "Cavalo branco", stockQty: 3, priceCents: 9000 },
  { category: "DESLITADOS E WHISKIY", name: "Jack Daniels", stockQty: 3, priceCents: 15000 },
  { category: "DESLITADOS E WHISKIY", name: "Jack Daniels maça", stockQty: 1, priceCents: 18000 },
  { category: "DESLITADOS E WHISKIY", name: "Red Label", stockQty: 2, priceCents: 10000 },
  { category: "DESLITADOS E WHISKIY", name: "Chanceler", stockQty: 4, priceCents: 3000 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Coca-cola 2L", stockQty: 6, priceCents: 1300 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Dolly 2L", stockQty: 4, priceCents: 800 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Itubaina 2L", stockQty: 2, priceCents: 800 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Coca-cola lata", stockQty: 12, priceCents: 500 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Guarana lata", stockQty: 12, priceCents: 500 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Agua", stockQty: 24, priceCents: 300 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Energetico monster lata", stockQty: 12, priceCents: 1200 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Energetico Redbul", stockQty: 48, priceCents: 1200 },
  { category: "REFRIGERANTE / AGUA / ENERGETICO", name: "Energetico garrafa", stockQty: 66, priceCents: 1200 },
  { category: "WHISKY DOSE E COMBO", name: "Cavalo branco dose C/RedBull", stockQty: 0, priceCents: 2500 },
  { category: "WHISKY DOSE E COMBO", name: "Cavalo branco dose C/Vibe", stockQty: 0, priceCents: 2000 },
  { category: "WHISKY DOSE E COMBO", name: "Cavalo branco combo C/RedBull", stockQty: 0, priceCents: 13000 },
  { category: "WHISKY DOSE E COMBO", name: "Cavalo branco combo C/Vibe", stockQty: 0, priceCents: 10000 },
  { category: "WHISKY DOSE E COMBO", name: "Jack Daniels dose C/RedBull", stockQty: 0, priceCents: 4000 },
  { category: "WHISKY DOSE E COMBO", name: "Jack Daniels combo C/RedBull", stockQty: 0, priceCents: 20000 },
  { category: "WHISKY DOSE E COMBO", name: "Jack Daniels maça dose C/Redbull", stockQty: 0, priceCents: 4500 },
  { category: "WHISKY DOSE E COMBO", name: "Jack Daniels maça combo C/RedBull", stockQty: 0, priceCents: 22000 },
  { category: "WHISKY DOSE E COMBO", name: "Red Label dose C/RedBull", stockQty: 0, priceCents: 3000 },
  { category: "WHISKY DOSE E COMBO", name: "Red Label dose C/Vibe", stockQty: 0, priceCents: 2500 },
  { category: "WHISKY DOSE E COMBO", name: "Red Label combo C/RedBull", stockQty: 0, priceCents: 15000 },
  { category: "WHISKY DOSE E COMBO", name: "Red Label combo C/Vibe", stockQty: 0, priceCents: 12000 },
  { category: "WHISKY DOSE E COMBO", name: "Chanceler dose C/Vibe", stockQty: 0, priceCents: 1000 },
  { category: "WHISKY DOSE E COMBO", name: "Chanceler Combo C/Vibe", stockQty: 0, priceCents: 5000 },
  { category: "COMBO E DOSE GIN", name: "Gin Dose", stockQty: 0, priceCents: 1000 },
  { category: "COMBO E DOSE GIN", name: "Gin Combo", stockQty: 0, priceCents: 5000 },
  { category: "TABACARIA", name: "Cigarro Eight Solto", stockQty: 20, priceCents: 70 },
  { category: "TABACARIA", name: "Cigarro Rotmans Global Azul Solto", stockQty: 20, priceCents: 100 },
  { category: "TABACARIA", name: "Cigarro Eight", stockQty: 9, priceCents: 700 },
  { category: "TABACARIA", name: "Cigarro Rotmans Global Azul", stockQty: 9, priceCents: 1000 },
  { category: "DOCES E SALGADINHOS", name: "Salgadinho Lula", stockQty: 30, priceCents: 250 },
  { category: "DOCES E SALGADINHOS", name: "Salgadinho Torcida", stockQty: 10, priceCents: 400 },
  { category: "DOCES E SALGADINHOS", name: "Amendoin Tritus S/casca", stockQty: 18, priceCents: 150 },
  { category: "DOCES E SALGADINHOS", name: "Amendoin Vanhuarda C/casca", stockQty: 20, priceCents: 150 },
  { category: "DOCES E SALGADINHOS", name: "Pururuca", stockQty: 10, priceCents: 200 },
  { category: "DOCES E SALGADINHOS", name: "Batatinha Chips", stockQty: 16, priceCents: 300 },
  { category: "DOCES E SALGADINHOS", name: "Chiclete Trindent", stockQty: 21, priceCents: 400 },
  { category: "DOCES E SALGADINHOS", name: "Chiclete Poosh", stockQty: 42, priceCents: 50 },
  { category: "DOCES E SALGADINHOS", name: "Bala Halls", stockQty: 21, priceCents: 250 },
  { category: "DOCES E SALGADINHOS", name: "Fini", stockQty: 12, priceCents: 450 },
  { category: "DOCES E SALGADINHOS", name: "Gelo sabor", stockQty: 390, priceCents: 300 },
  { category: "DOCES E SALGADINHOS", name: "Gelo saco 5kg", stockQty: 10, priceCents: 1200 },
] as const;

function buildSeedBarcode(index: number) {
  return String(7890000000000 + index + 1);
}

async function main() {
  await prisma.user.upsert({
    where: { username: seedAdmin.username },
    update: {
      name: seedAdmin.name,
      passwordHash: seedAdmin.passwordHash,
      role: Role.admin,
      isActive: true,
    },
    create: {
      name: seedAdmin.name,
      username: seedAdmin.username,
      passwordHash: seedAdmin.passwordHash,
      role: Role.admin,
    },
  });

  const hasProducts = await prisma.product.count();

  if (hasProducts === 0) {
    const admin = await prisma.user.findFirstOrThrow({
      where: { username: seedAdmin.username },
    });

    const seedProducts = workbookSeedCatalog.map((product, index) => ({
      name: product.name,
      sku: null,
      barcode: buildSeedBarcode(index),
      category: product.category,
      imagePath: "/catalog-placeholder.jpg",
      unit: "un",
      priceCents: product.priceCents,
      costCents: null,
      stockQty: product.stockQty,
      minimumStock: 0,
    }));

    const products = [];

    for (const productData of seedProducts) {
      const product = await prisma.product.create({
        data: productData,
      });

      products.push(product);
    }

    await prisma.stockMovement.createMany({
      data: products.map((product) => ({
        productId: product.id,
        actorUserId: admin.id,
        quantityDelta: product.stockQty,
        resultingStock: product.stockQty,
        reason: StockMovementReason.manual_entry,
        notes: "Carga inicial do seed a partir da tabela valor Adega",
        referenceType: "seed",
      })),
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
