import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import { AppError, handleRoute } from "@/lib/api/response";
import {
  getProductImagePath,
  getStorageRoot,
} from "@/lib/storage/product-images";
import {
  type DetectedImageType,
  contentTypeForExtension,
} from "@/lib/utils/image-validation";

type RouteContext = {
  params: Promise<{ file: string }>;
};

const filePattern = /^(c[a-z0-9]{24})\.(jpg|png|webp)$/;

export async function GET(request: NextRequest, context: RouteContext) {
  return handleRoute(request, async (_currentRequest, requestId) => {
    const { file } = await context.params;

    const match = file.match(filePattern);

    if (!match) {
      throw new AppError(
        400,
        "invalid_image_path",
        "Caminho de imagem inválido.",
        null,
        "Verifique o link da imagem.",
      );
    }

    const [, productId, ext] = match as unknown as [string, string, DetectedImageType];
    const absolutePath = getProductImagePath(productId, ext);

    const storageRoot = path.resolve(getStorageRoot());
    const resolved = path.resolve(absolutePath);

    if (!resolved.startsWith(`${storageRoot}${path.sep}`) && resolved !== storageRoot) {
      throw new AppError(
        400,
        "invalid_image_path",
        "Caminho de imagem inválido.",
        null,
        "Verifique o link da imagem.",
      );
    }

    let buffer: Buffer;

    try {
      buffer = await readFile(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new NextResponse("Imagem não encontrada.", {
          status: 404,
          headers: { "X-Request-Id": requestId },
        });
      }

      throw error;
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentTypeForExtension(ext),
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=60, must-revalidate",
        "X-Request-Id": requestId,
      },
    });
  });
}
