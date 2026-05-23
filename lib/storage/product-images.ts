import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const cuidPattern = /^c[a-z0-9]{24}$/;
const validExtensions = ["jpg", "png", "webp"] as const;

export type ProductImageExtension = (typeof validExtensions)[number];

function assertValidProductId(productId: string) {
  if (!cuidPattern.test(productId)) {
    throw new Error(`invalid_product_id: ${productId}`);
  }
}

function assertValidExtension(ext: string): asserts ext is ProductImageExtension {
  if (!validExtensions.includes(ext as ProductImageExtension)) {
    throw new Error(`invalid_image_extension: ${ext}`);
  }
}

export function getStorageRoot(): string {
  return process.env.UPLOADS_DIR || "/app/uploads";
}

function getProductsDirectory(): string {
  return path.join(getStorageRoot(), "products");
}

export function getProductImagePath(productId: string, ext: string): string {
  assertValidProductId(productId);
  assertValidExtension(ext);
  return path.join(getProductsDirectory(), `${productId}.${ext}`);
}

export function getProductPublicPath(productId: string, ext: string): string {
  assertValidProductId(productId);
  assertValidExtension(ext);
  return `/uploads/products/${productId}.${ext}`;
}

async function ensureProductsDirectory(): Promise<void> {
  await mkdir(getProductsDirectory(), { recursive: true });
}

async function unlinkIfExists(targetPath: string): Promise<void> {
  try {
    await unlink(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export async function findProductImageOnDisk(
  productId: string,
): Promise<{ ext: ProductImageExtension; absolutePath: string } | null> {
  assertValidProductId(productId);

  for (const ext of validExtensions) {
    const candidatePath = getProductImagePath(productId, ext);

    try {
      await access(candidatePath);
      return { ext, absolutePath: candidatePath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }

      throw error;
    }
  }

  return null;
}

export async function saveProductImageAtomic(
  productId: string,
  ext: string,
  buffer: Buffer,
): Promise<{ absolutePath: string; publicPath: string }> {
  assertValidProductId(productId);
  assertValidExtension(ext);

  await ensureProductsDirectory();

  const finalPath = getProductImagePath(productId, ext);
  const tmpPath = `${finalPath}.tmp`;

  try {
    await writeFile(tmpPath, buffer);
    await rename(tmpPath, finalPath);
  } catch (error) {
    await unlinkIfExists(tmpPath);
    throw error;
  }

  for (const otherExt of validExtensions) {
    if (otherExt === ext) {
      continue;
    }

    await unlinkIfExists(getProductImagePath(productId, otherExt));
  }

  return {
    absolutePath: finalPath,
    publicPath: getProductPublicPath(productId, ext),
  };
}

export async function removeProductImageFiles(productId: string): Promise<void> {
  assertValidProductId(productId);

  for (const ext of validExtensions) {
    await unlinkIfExists(getProductImagePath(productId, ext));
  }
}
