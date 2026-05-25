const PLACEHOLDER_IMAGE = "/catalog-placeholder.jpg";

type ProductMediaInput = {
  name: string;
  imagePath?: string | null;
  updatedAt?: string | Date | null;
};

type ProductMediaProps = {
  product: ProductMediaInput;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function buildSrc(product: ProductMediaInput): string {
  if (!product.imagePath) return PLACEHOLDER_IMAGE;
  const updatedAt = product.updatedAt;
  const versionSource =
    updatedAt instanceof Date ? updatedAt.getTime() : updatedAt ? Date.parse(updatedAt) : NaN;
  const version = Number.isFinite(versionSource) ? versionSource : 0;
  return `${product.imagePath}?v=${version}`;
}

export function ProductMedia({ product, size = "md", className }: ProductMediaProps) {
  const classes = ["product-media", `product-media--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      src={buildSrc(product)}
      alt={product.name}
      loading="lazy"
      className={classes}
    />
  );
}
