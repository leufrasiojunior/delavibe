import type { ProductDto } from "@/lib/schemas/product";
import { formatCurrency } from "@/lib/utils/money";

function escapeCsvCell(value: string) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function buildProductsCsv(products: readonly ProductDto[]) {
  const header = [
    "Nome",
    "SKU",
    "Codigo de barras",
    "Categoria",
    "Unidade",
    "Preco de venda",
    "Custo",
    "Estoque atual",
    "Estoque minimo",
    "Status",
  ];

  const lines = [
    header,
    ...products.map((product) => [
      product.name,
      product.sku ?? "",
      product.barcode,
      product.category ?? "",
      product.unit,
      formatCurrency(product.priceCents),
      product.costCents == null ? "" : formatCurrency(product.costCents),
      String(product.stockQty),
      String(product.minimumStock),
      product.isActive ? "Ativo" : "Inativo",
    ]),
  ];

  return `\uFEFF${lines
    .map((row) => row.map((value) => escapeCsvCell(value)).join(";"))
    .join("\r\n")}\r\n`;
}
