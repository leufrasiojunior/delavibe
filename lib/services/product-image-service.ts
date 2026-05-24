import { AppError } from "@/lib/api/response";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type ProductDto, productSchema } from "@/lib/schemas/product";
import {
  findProductImageOnDisk,
  getProductImagePath,
  getProductPublicPath,
  removeProductImageFiles,
  saveProductImageAtomic,
} from "@/lib/storage/product-images";
import {
  ACCEPTED_CONTENT_TYPES,
  MAX_IMAGE_BYTES,
  contentTypeForExtension,
  detectImageType,
  isAcceptedContentType,
} from "@/lib/utils/image-validation";
import { logAuditEvent } from "@/lib/services/audit-service";
import { unlink } from "node:fs/promises";

type AuditableActor = {
  actorUserId: string;
  ipAddress: string;
};

async function loadProductOrThrow(productId: string) {
  const product = await db.product.findUnique({ where: { id: productId } });

  if (!product) {
    throw new AppError(
      404,
      "product_not_found",
      "Produto não encontrado.",
      null,
      "Verifique o produto e tente novamente.",
    );
  }

  return product;
}

function unlinkSafe(path: string) {
  return unlink(path).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    logger.warn("product_image_cleanup_failed", {
      path,
      error: (error as Error).message,
    });
  });
}

export async function uploadProductImage(
  productId: string,
  buffer: Buffer,
  declaredContentType: string,
  { actorUserId, ipAddress }: AuditableActor,
): Promise<ProductDto> {
  if (!isAcceptedContentType(declaredContentType.toLowerCase())) {
    throw new AppError(
      400,
      "invalid_image_type",
      "Formato de imagem não suportado.",
      { acceptedContentTypes: ACCEPTED_CONTENT_TYPES },
      "Envie uma imagem JPG, PNG ou WebP.",
    );
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new AppError(
      413,
      "image_too_large",
      "A imagem excede o tamanho máximo permitido.",
      { maxBytes: MAX_IMAGE_BYTES },
      "Reduza a imagem para no máximo 2 MB e tente novamente.",
    );
  }

  const detected = detectImageType(buffer);

  if (!detected) {
    throw new AppError(
      400,
      "invalid_image_payload",
      "O conteúdo enviado não foi reconhecido como uma imagem válida.",
      null,
      "Verifique o arquivo enviado e tente novamente.",
    );
  }

  const detectedContentType = contentTypeForExtension(detected);

  if (detectedContentType !== declaredContentType.toLowerCase()) {
    throw new AppError(
      400,
      "image_type_mismatch",
      "O tipo declarado não corresponde ao conteúdo da imagem.",
      { declared: declaredContentType, detected: detectedContentType },
      "Reenvie a imagem mantendo o Content-Type correto.",
    );
  }

  const existingProduct = await loadProductOrThrow(productId);
  const existingOnDisk = await findProductImageOnDisk(productId);
  const isReplace = existingOnDisk !== null || existingProduct.imagePath !== null;

  const finalPath = getProductImagePath(productId, detected);
  const tmpPath = `${finalPath}.tmp`;

  let updatedProduct;

  try {
    await saveProductImageAtomic(productId, detected, buffer);

    try {
      updatedProduct = await db.product.update({
        where: { id: productId },
        data: { imagePath: getProductPublicPath(productId, detected) },
      });
    } catch (dbError) {
      await unlinkSafe(finalPath);
      throw dbError;
    }
  } catch (error) {
    await unlinkSafe(tmpPath);
    throw error;
  }

  await logAuditEvent({
    actorUserId,
    action: isReplace ? "product.image.replace" : "product.image.upload",
    entityType: "product",
    entityId: productId,
    ipAddress,
    metadata: {
      ext: detected,
      bytes: buffer.length,
    },
  });

  logger.info("product_image_saved", {
    userId: actorUserId,
    entityId: productId,
    ext: detected,
    bytes: buffer.length,
    replace: isReplace,
  });

  return productSchema.parse({
    ...updatedProduct,
    createdAt: updatedProduct.createdAt.toISOString(),
    updatedAt: updatedProduct.updatedAt.toISOString(),
  });
}

export async function removeProductImage(
  productId: string,
  { actorUserId, ipAddress }: AuditableActor,
): Promise<ProductDto> {
  await loadProductOrThrow(productId);

  await removeProductImageFiles(productId);

  const updatedProduct = await db.product.update({
    where: { id: productId },
    data: { imagePath: null },
  });

  await logAuditEvent({
    actorUserId,
    action: "product.image.remove",
    entityType: "product",
    entityId: productId,
    ipAddress,
  });

  logger.info("product_image_removed", {
    userId: actorUserId,
    entityId: productId,
  });

  return productSchema.parse({
    ...updatedProduct,
    createdAt: updatedProduct.createdAt.toISOString(),
    updatedAt: updatedProduct.updatedAt.toISOString(),
  });
}

