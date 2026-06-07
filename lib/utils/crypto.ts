import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

import { AppError } from "@/lib/api/response";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Validates that `APP_ENCRYPTION_KEY` env var exists and decodes from base64
 * to exactly 32 bytes. Throws AppError(500) if missing or invalid.
 */
export function assertEncryptionKeyAvailable(): void {
  const raw = process.env.APP_ENCRYPTION_KEY;

  if (!raw) {
    throw new AppError(
      500,
      "encryption_config_missing",
      "Configuracao de criptografia ausente ou invalida",
    );
  }

  const buf = Buffer.from(raw, "base64");

  if (buf.length !== KEY_LENGTH) {
    throw new AppError(
      500,
      "encryption_config_missing",
      "Configuracao de criptografia ausente ou invalida",
    );
  }
}

function getKey(): Buffer {
  assertEncryptionKeyAvailable();
  return Buffer.from(process.env.APP_ENCRYPTION_KEY!, "base64");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns `iv:authTag:ciphertext` with each part hex-encoded.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a blob in format `iv:authTag:ciphertext` (hex-encoded parts)
 * back to plaintext. Throws AppError if format is invalid or GCM detects tampering.
 */
export function decryptApiKey(blob: string): string {
  const key = getKey();

  const parts = blob.split(":");

  if (parts.length !== 3) {
    throw new AppError(
      500,
      "invalid_ciphertext_format",
      "Formato de ciphertext invalido",
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    throw new AppError(
      500,
      "ciphertext_tampered",
      "Falha na autenticacao do ciphertext",
    );
  }
}
