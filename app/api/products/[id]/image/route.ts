import { Buffer } from "node:buffer";

import type { NextRequest } from "next/server";

import { handleProtectedRoute } from "@/lib/api/route-security";
import { AppError, ok } from "@/lib/api/response";
import { productSchema } from "@/lib/schemas/product";
import {
  removeProductImage,
  uploadProductImage,
} from "@/lib/services/product-image-service";
import { MAX_IMAGE_BYTES } from "@/lib/utils/image-validation";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const cuidPattern = /^c[a-z0-9]{24}$/;

function assertValidProductId(id: string) {
  if (!cuidPattern.test(id)) {
    throw new AppError(
      400,
      "invalid_product_id",
      "Identificador de produto inválido.",
      null,
      "Verifique o produto selecionado e tente novamente.",
    );
  }
}

function assertContentLengthWithinLimit(request: NextRequest) {
  const header = request.headers.get("content-length");

  if (!header) {
    return;
  }

  const length = Number(header);

  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES) {
    throw new AppError(
      413,
      "image_too_large",
      "A imagem excede o tamanho máximo permitido.",
      { maxBytes: MAX_IMAGE_BYTES, declared: length },
      "Reduza a imagem para no máximo 2 MB e tente novamente.",
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      roles: ["admin"],
      requireMultipart: true,
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ request: currentRequest, requestId, session, ipAddress }) => {
      const { id } = await context.params;
      assertValidProductId(id);
      assertContentLengthWithinLimit(currentRequest);

      const formData = await currentRequest.formData().catch(() => {
        throw new AppError(
          400,
          "invalid_multipart",
          "Não foi possível interpretar o conteúdo enviado.",
          null,
          "Reenvie a imagem usando o formulário do sistema.",
        );
      });

      const fileEntry = formData.get("file");

      if (!(fileEntry instanceof File)) {
        throw new AppError(
          400,
          "missing_image_file",
          "Nenhuma imagem foi enviada.",
          null,
          "Selecione uma imagem antes de enviar.",
        );
      }

      if (fileEntry.size > MAX_IMAGE_BYTES) {
        throw new AppError(
          413,
          "image_too_large",
          "A imagem excede o tamanho máximo permitido.",
          { maxBytes: MAX_IMAGE_BYTES, declared: fileEntry.size },
          "Reduza a imagem para no máximo 2 MB e tente novamente.",
        );
      }

      const buffer = Buffer.from(await fileEntry.arrayBuffer());
      const product = await uploadProductImage(id, buffer, fileEntry.type, {
        actorUserId: session!.user.id,
        ipAddress,
      });

      return ok(productSchema.parse(product), requestId);
    },
  );
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return handleProtectedRoute(
    request,
    {
      auth: "required",
      roles: ["admin"],
      requireOrigin: true,
      requireCsrf: true,
      rateLimitPolicy: "write_authenticated",
    },
    async ({ requestId, session, ipAddress }) => {
      const { id } = await context.params;
      assertValidProductId(id);

      const product = await removeProductImage(id, {
        actorUserId: session!.user.id,
        ipAddress,
      });

      return ok(productSchema.parse(product), requestId);
    },
  );
}
