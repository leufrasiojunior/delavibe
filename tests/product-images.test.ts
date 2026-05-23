import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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

const validProductId = "cabc1234567890abcdefghijk";

function withTempUploadsDir<T>(callback: () => Promise<T> | T): Promise<T> {
  const tempDir = mkdtempSync(path.join(tmpdir(), "delavibe-uploads-"));
  const previous = process.env.UPLOADS_DIR;
  process.env.UPLOADS_DIR = tempDir;

  return Promise.resolve()
    .then(() => callback())
    .finally(() => {
      if (previous === undefined) {
        delete process.env.UPLOADS_DIR;
      } else {
        process.env.UPLOADS_DIR = previous;
      }
    });
}

function buildJpgBuffer(payloadSize = 4) {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(payloadSize)]);
}

function buildPngBuffer(payloadSize = 8) {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(payloadSize),
  ]);
}

function buildWebpBuffer(payloadSize = 8) {
  const header = Buffer.alloc(12);
  header.write("RIFF", 0);
  header.writeUInt32LE(0, 4); // tamanho file fake
  header.write("WEBP", 8);
  return Buffer.concat([header, Buffer.alloc(payloadSize)]);
}

test("detectImageType reconhece JPG via magic bytes", () => {
  assert.equal(detectImageType(buildJpgBuffer()), "jpg");
});

test("detectImageType reconhece PNG via magic bytes", () => {
  assert.equal(detectImageType(buildPngBuffer()), "png");
});

test("detectImageType reconhece WebP via magic bytes (RIFF + WEBP)", () => {
  assert.equal(detectImageType(buildWebpBuffer()), "webp");
});

test("detectImageType retorna null para buffer aleatorio", () => {
  assert.equal(detectImageType(Buffer.from([0x00, 0x01, 0x02, 0x03])), null);
});

test("detectImageType retorna null para magic de executavel (MZ)", () => {
  assert.equal(detectImageType(Buffer.from([0x4d, 0x5a, 0x90, 0x00])), null);
});

test("contentTypeForExtension mapeia corretamente cada tipo aceito", () => {
  assert.equal(contentTypeForExtension("jpg"), "image/jpeg");
  assert.equal(contentTypeForExtension("png"), "image/png");
  assert.equal(contentTypeForExtension("webp"), "image/webp");
});

test("isAcceptedContentType filtra Content-Types aceitos", () => {
  for (const accepted of ACCEPTED_CONTENT_TYPES) {
    assert.equal(isAcceptedContentType(accepted), true);
  }

  assert.equal(isAcceptedContentType("image/gif"), false);
  assert.equal(isAcceptedContentType("application/pdf"), false);
});

test("MAX_IMAGE_BYTES eh 2 MB", () => {
  assert.equal(MAX_IMAGE_BYTES, 2 * 1024 * 1024);
});

test("getProductImagePath e getProductPublicPath rejeitam productId invalido", () => {
  assert.throws(() => getProductImagePath("../etc/passwd", "jpg"), /invalid_product_id/);
  assert.throws(() => getProductImagePath(validProductId, "gif" as never), /invalid_image_extension/);
  assert.throws(() => getProductPublicPath("not-a-cuid", "jpg"), /invalid_product_id/);
});

test("getProductPublicPath produz URL relativa esperada", () => {
  assert.equal(
    getProductPublicPath(validProductId, "webp"),
    `/uploads/products/${validProductId}.webp`,
  );
});

test("saveProductImageAtomic cria arquivo no path destino", async () => {
  await withTempUploadsDir(async () => {
    const buffer = buildJpgBuffer(16);
    const result = await saveProductImageAtomic(validProductId, "jpg", buffer);

    assert.equal(result.publicPath, `/uploads/products/${validProductId}.jpg`);
    assert.equal(existsSync(result.absolutePath), true);
    const written = readFileSync(result.absolutePath);
    assert.deepEqual(Buffer.from(written), buffer);
  });
});

test("saveProductImageAtomic sobrescreve quando extensao igual", async () => {
  await withTempUploadsDir(async () => {
    const first = buildJpgBuffer(8);
    const second = buildJpgBuffer(32);

    await saveProductImageAtomic(validProductId, "jpg", first);
    const result = await saveProductImageAtomic(validProductId, "jpg", second);

    const written = readFileSync(result.absolutePath);
    assert.equal(written.length, second.length);
  });
});

test("saveProductImageAtomic em troca de extensao apaga arquivo anterior", async () => {
  await withTempUploadsDir(async () => {
    const jpgBuffer = buildJpgBuffer(8);
    const webpBuffer = buildWebpBuffer(8);

    await saveProductImageAtomic(validProductId, "jpg", jpgBuffer);
    const oldPath = getProductImagePath(validProductId, "jpg");
    assert.equal(existsSync(oldPath), true);

    await saveProductImageAtomic(validProductId, "webp", webpBuffer);
    const newPath = getProductImagePath(validProductId, "webp");

    assert.equal(existsSync(newPath), true);
    assert.equal(existsSync(oldPath), false);
  });
});

test("removeProductImageFiles eh idempotente quando nada existe", async () => {
  await withTempUploadsDir(async () => {
    await assert.doesNotReject(removeProductImageFiles(validProductId));
  });
});

test("removeProductImageFiles apaga candidato existente", async () => {
  await withTempUploadsDir(async () => {
    await saveProductImageAtomic(validProductId, "png", buildPngBuffer(8));
    const pngPath = getProductImagePath(validProductId, "png");
    assert.equal(existsSync(pngPath), true);

    await removeProductImageFiles(validProductId);
    assert.equal(existsSync(pngPath), false);
  });
});

test("findProductImageOnDisk retorna null quando nao existe arquivo", async () => {
  await withTempUploadsDir(async () => {
    const found = await findProductImageOnDisk(validProductId);
    assert.equal(found, null);
  });
});

test("findProductImageOnDisk encontra arquivo apos save", async () => {
  await withTempUploadsDir(async () => {
    await saveProductImageAtomic(validProductId, "webp", buildWebpBuffer(8));
    const found = await findProductImageOnDisk(validProductId);
    assert.notEqual(found, null);
    assert.equal(found?.ext, "webp");
  });
});

test("saveProductImageAtomic limpa .tmp quando rename falha", async () => {
  await withTempUploadsDir(async () => {
    // Cria o destino como diretorio para forcar EISDIR em rename
    const finalPath = getProductImagePath(validProductId, "jpg");
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.dirname(finalPath), { recursive: true });
    mkdirSync(finalPath, { recursive: true });

    await assert.rejects(saveProductImageAtomic(validProductId, "jpg", buildJpgBuffer(4)));
    assert.equal(existsSync(`${finalPath}.tmp`), false);
  });
});

test("saveProductImageAtomic cria diretorio products se nao existir", async () => {
  await withTempUploadsDir(async () => {
    const result = await saveProductImageAtomic(validProductId, "jpg", buildJpgBuffer(4));
    assert.equal(existsSync(result.absolutePath), true);
  });
});

test("uploads route handler rejeita filename com path traversal", async () => {
  const { GET } = await import("@/app/uploads/products/[file]/route");
  const { NextRequest } = await import("next/server");

  const response = await GET(
    new NextRequest("http://localhost/uploads/products/..%2F..%2Fetc%2Fpasswd"),
    { params: Promise.resolve({ file: "../../etc/passwd" }) },
  );

  assert.equal(response.status, 400);
});

test("uploads route handler retorna 404 quando arquivo nao existe", async () => {
  await withTempUploadsDir(async () => {
    const { GET } = await import("@/app/uploads/products/[file]/route");
    const { NextRequest } = await import("next/server");
    const filename = `${validProductId}.jpg`;

    const response = await GET(
      new NextRequest(`http://localhost/uploads/products/${filename}`),
      { params: Promise.resolve({ file: filename }) },
    );

    assert.equal(response.status, 404);
  });
});

test("uploads route handler serve arquivo existente com content-type correto", async () => {
  await withTempUploadsDir(async () => {
    const buffer = buildPngBuffer(8);
    await saveProductImageAtomic(validProductId, "png", buffer);

    const { GET } = await import("@/app/uploads/products/[file]/route");
    const { NextRequest } = await import("next/server");
    const filename = `${validProductId}.png`;

    const response = await GET(
      new NextRequest(`http://localhost/uploads/products/${filename}`),
      { params: Promise.resolve({ file: filename }) },
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=60, must-revalidate");
  });
});

test("route-security retorna 400 quando esperado multipart e recebe JSON", async () => {
  const { handleProtectedRoute } = await import("@/lib/api/route-security");
  const { NextRequest } = await import("next/server");

  const request = new NextRequest("http://localhost/api/products/test/image", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ foo: "bar" }),
  });

  const response = await handleProtectedRoute(
    request,
    {
      auth: "none",
      requireMultipart: true,
      requireOrigin: true,
    },
    async ({ requestId }) => {
      const { ok } = await import("@/lib/api/response");
      return ok({ ok: true }, requestId);
    },
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, "invalid_content_type");
});

test("route-security retorna 500 quando configurado com requireJsonBody e requireMultipart simultaneos", async () => {
  // Suprime log de erro do handleRoute para esta verificacao
  const { handleProtectedRoute } = await import("@/lib/api/route-security");
  const { NextRequest } = await import("next/server");

  const request = new NextRequest("http://localhost/api/products/test/image", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({}),
  });

  const response = await handleProtectedRoute(
    request,
    {
      auth: "none",
      requireJsonBody: true,
      requireMultipart: true,
      requireOrigin: true,
    },
    async ({ requestId }) => {
      const { ok } = await import("@/lib/api/response");
      return ok({ ok: true }, requestId);
    },
  );

  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, "route_misconfigured");
});

