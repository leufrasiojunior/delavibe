import { type PublicProductDto } from "@/lib/schemas/product";
import { normalizeText } from "@/lib/utils/text";

export const PUBLIC_CATALOG_ALL_TAB = "__all__";
export const PUBLIC_CATALOG_PROMOTIONS_TAB = "__promotions__";
export const PUBLIC_CATALOG_UNCATEGORIZED = "Outros";

export function getPublicCatalogCategoryKey(product: Pick<PublicProductDto, "category">) {
  return product.category?.trim() || PUBLIC_CATALOG_UNCATEGORIZED;
}

export function getDefaultPublicCatalogTab(products: PublicProductDto[]) {
  return products.some((product) => product.promotion)
    ? PUBLIC_CATALOG_PROMOTIONS_TAB
    : PUBLIC_CATALOG_ALL_TAB;
}

export function filterPublicCatalogProducts(
  products: PublicProductDto[],
  input: {
    activeTab: string;
    search: string;
  },
) {
  const term = normalizeText(input.search.trim());

  return products.filter((product) => {
    if (input.activeTab === PUBLIC_CATALOG_PROMOTIONS_TAB && !product.promotion) {
      return false;
    }

    if (
      input.activeTab !== PUBLIC_CATALOG_ALL_TAB &&
      input.activeTab !== PUBLIC_CATALOG_PROMOTIONS_TAB &&
      getPublicCatalogCategoryKey(product) !== input.activeTab
    ) {
      return false;
    }

    if (!term) {
      return true;
    }

    const matchesName = normalizeText(product.name).includes(term);
    const matchesCategory = normalizeText(product.category ?? "").includes(term);
    return matchesName || matchesCategory;
  });
}

export function groupPublicCatalogProducts(products: PublicProductDto[]) {
  const map = new Map<string, PublicProductDto[]>();

  for (const product of products) {
    const key = getPublicCatalogCategoryKey(product);
    const list = map.get(key) ?? [];
    list.push(product);
    map.set(key, list);
  }

  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
}
